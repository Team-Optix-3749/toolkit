alter table public.build_sessions alter column location_id set not null;
alter table public.build_sessions alter column season_id set not null;
alter table public.build_sessions alter column closes_at set not null;
alter table public.build_sessions add constraint build_valid_session check(length(btrim(title))>0 and closes_at>opens_at and isfinite(opens_at) and isfinite(closes_at));
alter table public.build_sessions add constraint build_location_windows exclude using gist(location_id with =,tstzrange(opens_at,closes_at,'[)') with &&);
alter table public.build_locations add constraint build_geofence check((latitude is null and longitude is null and radius_m is null) or(latitude is not null and longitude is not null and radius_m is not null and latitude between -90 and 90 and longitude between -180 and 180 and radius_m>0 and radius_m<'Infinity'::double precision));
create table toolkit_private.build_tokens(session_id uuid primary key references public.build_sessions(id),token_hash text not null,expires_at timestamptz not null);
revoke all on toolkit_private.build_tokens from public,anon,authenticated;
create or replace function toolkit_private.compute_build_credit() returns trigger language plpgsql security definer set search_path='' as $$
declare session public.build_sessions;
begin
 select * into strict session from public.build_sessions where id=new.session_id;
 if new.check_out is not null and new.check_out<=new.check_in then raise exception 'Checkout must be later than check-in';end if;
 new.credit_enabled:=not session.cancelled or coalesce(new.credit_override,false);
 new.reserved_until:=case when new.check_out is null then session.closes_at else null end;
 new.credited_minutes:=case when new.credit_enabled and new.check_out is not null then extract(epoch from(new.check_out-new.check_in))/60.0 else 0 end;
 new.credit_interval:=case when new.credit_enabled then tstzrange(new.check_in,coalesce(new.check_out,new.reserved_until),'[)') else null end;
 return new;
end $$;
update public.build_records set check_in=check_in;
create unique index build_one_open_member on public.build_records(member_id) where check_out is null;
alter table public.build_records add constraint build_no_credit_overlap exclude using gist(member_id with =,credit_interval with &&) where(credit_enabled);
create or replace function toolkit_private.participation_no_overlap() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.member_id::text,0));
 if new.credit_enabled and new.credit_interval is not null then
  if tg_table_name='build_records' then
   if exists(select 1 from public.outreach_attendance where member_id=new.member_id and credit_enabled and credit_interval&&new.credit_interval) then raise exception 'Build overlaps credited outreach';end if;
  elsif exists(select 1 from public.build_records where member_id=new.member_id and credit_enabled and credit_interval&&new.credit_interval) then raise exception 'Outreach overlaps credited or reserved build';end if;
 end if;
 return new;
end $$;
create trigger z_participation_overlap before insert or update on public.build_records for each row execute function toolkit_private.participation_no_overlap();
create trigger z_participation_overlap before insert or update on public.outreach_attendance for each row execute function toolkit_private.participation_no_overlap();
create or replace function toolkit_private.close_due_build_records() returns integer language plpgsql security definer set search_path='' as $$
declare item record; count_closed integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('toolkit-build-domain',0));
 for item in select r.id,r.member_id,s.closes_at from public.build_records r join public.build_sessions s on s.id=r.session_id where r.check_out is null and s.closes_at<=clock_timestamp() order by r.member_id,r.id loop
  perform pg_advisory_xact_lock(hashtextextended(item.member_id::text,0));
  update public.build_records set check_out=item.closes_at,checkout_method='automatic',automatically_closed=true where id=item.id and check_out is null;
  if found then count_closed:=count_closed+1;end if;
 end loop;return count_closed;
end $$;
revoke all on function toolkit_private.close_due_build_records() from public,anon,authenticated;
create or replace function public.build_action(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare operation text:=payload->>'action'; session public.build_sessions; location public.build_locations; record public.build_records; sid uuid; rid uuid; person uuid; result jsonb; token text; expiry timestamptz; first_time timestamptz; last_time timestamptz; latitude double precision; longitude double precision; distance double precision; unknown text[];
begin
 if not public.is_member() then raise exception 'Active verified admission and valid session required';end if;
 perform pg_advisory_xact_lock(hashtextextended('toolkit-build-domain',0));
 if jsonb_typeof(payload) is distinct from 'object' or operation is null or operation not in ('location','session','edit_session','cancel','qr','check_in','check_out','correct','add_record') then raise exception 'Unknown build action';end if;
 select array_agg(key) into unknown from jsonb_object_keys(payload) key where not(key=any(case operation
 when 'location' then array['action','id','name','latitude','longitude','radius_m']
 when 'session' then array['action','title','location_id','season_id','opens_at','closes_at']
 when 'edit_session' then array['action','id','title','location_id','season_id','opens_at','closes_at']
 when 'cancel' then array['action','id'] when 'qr' then array['action','session_id']
 when 'check_in' then array['action','session_id','method','token','latitude','longitude'] when 'check_out' then array['action','id']
 else array['action','id','session_id','member_id','check_in','check_out','credit_override'] end));
 if unknown is not null then raise exception 'Unsupported build fields: %',unknown;end if;
 if operation not in ('check_in','check_out') and not public.has_perm('manage_build_hours') then raise exception 'Manage build hours permission required';end if;
 if operation='location' then
  if nullif(btrim(payload->>'name'),'') is null then raise exception 'Location name required';end if;
  if payload ? 'id' then update public.build_locations set name=btrim(payload->>'name'),latitude=case when payload?'latitude' then(payload->>'latitude')::double precision else build_locations.latitude end,longitude=case when payload?'longitude' then(payload->>'longitude')::double precision else build_locations.longitude end,radius_m=case when payload?'radius_m' then(payload->>'radius_m')::double precision else build_locations.radius_m end where id=(payload->>'id')::uuid returning to_jsonb(build_locations.*) into result;
  else insert into public.build_locations(name,latitude,longitude,radius_m) values(btrim(payload->>'name'),(payload->>'latitude')::double precision,(payload->>'longitude')::double precision,(payload->>'radius_m')::double precision) returning to_jsonb(build_locations.*) into result;end if;
  if result is null then raise exception 'Location not found';end if;return result;
 end if;
 if operation in ('session','edit_session') then
  if operation='edit_session' then select * into session from public.build_sessions where id=(payload->>'id')::uuid for update;if not found then raise exception 'Session not found';end if;end if;
  if operation='session' then
   if payload?'season_id' then session.season_id:=(payload->>'season_id')::uuid;else select id into session.season_id from public.seasons where is_current;end if;
  end if;
  if payload?'title' then session.title:=btrim(payload->>'title');end if;
  if payload?'location_id' then session.location_id:=(payload->>'location_id')::uuid;end if;
  if payload?'season_id' then session.season_id:=(payload->>'season_id')::uuid;end if;
  if payload?'opens_at' then if payload->>'opens_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Open requires offset';end if;session.opens_at:=(payload->>'opens_at')::timestamptz;end if;
  if payload?'closes_at' then if payload->>'closes_at' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Close requires offset';end if;session.closes_at:=(payload->>'closes_at')::timestamptz;end if;
  if nullif(session.title,'') is null or session.location_id is null or session.season_id is null or session.opens_at is null or session.closes_at is null or session.closes_at<=session.opens_at then raise exception 'Title, location, season and valid open/close are required';end if;
  if operation='session' then insert into public.build_sessions(title,location_id,season_id,opens_at,closes_at,created_by) values(session.title,session.location_id,session.season_id,session.opens_at,session.closes_at,auth.uid()) returning * into session;
  else
   select closes_at into last_time from public.build_sessions where id=session.id;
   if exists(select 1 from public.build_records where session_id=session.id and check_out is null and check_in>=session.closes_at) then raise exception 'Close must follow all active check-ins';end if;
   update public.build_sessions set title=session.title,location_id=session.location_id,season_id=session.season_id,opens_at=session.opens_at,closes_at=session.closes_at where id=session.id;
   update public.build_records set check_out=case when check_out is null and session.closes_at<last_time then session.closes_at else check_out end,automatically_closed=automatically_closed or(check_out is null and session.closes_at<last_time),checkout_method=case when check_out is null and session.closes_at<last_time then 'automatic' else checkout_method end where session_id=session.id;
  end if;return to_jsonb(session);
 end if;
 if operation in ('check_in','check_out') then perform toolkit_private.close_due_build_records();end if;
 if operation in ('check_out','correct') then
  rid:=(payload->>'id')::uuid;select * into record from public.build_records where id=rid;
  if not found then raise exception 'Record not found';end if;sid:=record.session_id;person:=record.member_id;
 else sid:=(coalesce(payload->>'session_id',payload->>'id'))::uuid;person:=case when operation='add_record' then(payload->>'member_id')::uuid else auth.uid() end;end if;
 perform pg_advisory_xact_lock(hashtextextended(person::text,0));
 select * into session from public.build_sessions where id=sid for update;if not found then raise exception 'Session not found';end if;
 if operation='cancel' then
  if session.cancelled then raise exception 'Session already cancelled';end if;
  update public.build_sessions set cancelled=true where id=sid;
  update public.build_records set credit_override=null where session_id=sid;
  delete from toolkit_private.build_tokens where session_id=sid;return jsonb_build_object('id',sid,'cancelled',true);
 elsif operation='qr' then
  if session.cancelled or clock_timestamp()>=session.closes_at then raise exception 'Session unavailable';end if;
  token:=encode(extensions.gen_random_bytes(24),'hex');expiry:=least(clock_timestamp()+interval '45 seconds',session.closes_at);
  insert into toolkit_private.build_tokens values(sid,encode(extensions.digest(token,'sha256'),'hex'),expiry) on conflict(session_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at;
  return jsonb_build_object('token',token,'expires_at',expiry,'session_id',sid);
 elsif operation='check_in' then
  if session.cancelled or clock_timestamp()<session.opens_at or clock_timestamp()>=session.closes_at then raise exception 'Session is not currently open';end if;
  if payload->>'method'='qr' then
   if not exists(select 1 from toolkit_private.build_tokens where session_id=sid and expires_at>clock_timestamp() and token_hash=encode(extensions.digest(payload->>'token','sha256'),'hex')) then raise exception 'QR token invalid, rotated or expired';end if;
  elsif payload->>'method'='gps' then
   select * into location from public.build_locations where id=session.location_id;
   if location.latitude is null or location.longitude is null or location.radius_m is null then raise exception 'GPS unavailable for this location; use QR';end if;
   latitude:=(payload->>'latitude')::double precision;longitude:=(payload->>'longitude')::double precision;
   if latitude is null or longitude is null or latitude not between -90 and 90 or longitude not between -180 and 180 then raise exception 'Valid coordinates required';end if;
   distance:=6371000*2*asin(least(1,sqrt(power(sin(radians(latitude-location.latitude)/2),2)+cos(radians(latitude))*cos(radians(location.latitude))*power(sin(radians(longitude-location.longitude)/2),2))));
   if distance>location.radius_m then raise exception 'Outside configured build geofence';end if;
  else raise exception 'Choose QR or GPS admission';end if;
  select * into record from public.build_records where member_id=person and check_out is null for update;
  if found then return to_jsonb(record)||jsonb_build_object('already_active',true);end if;
  insert into public.build_records(session_id,member_id,check_in,checkout_method) values(sid,person,clock_timestamp(),'member') returning * into record;
 elsif operation='check_out' then
  select * into record from public.build_records where id=rid for update;
  if record.member_id<>auth.uid() then raise exception 'Checkout is caller-owned';end if;
  if record.check_out is null then update public.build_records set check_out=least(clock_timestamp(),session.closes_at),checkout_method='member' where id=rid returning * into record;end if;
 elsif operation in ('correct','add_record') then
  if operation='correct' then select * into record from public.build_records where id=rid for update;end if;
  if (payload?'check_in' and coalesce(payload->>'check_in','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$') or (payload?'check_out' and coalesce(payload->>'check_out','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$') then raise exception 'Actual timestamps require explicit offsets';end if;
  first_time:=case when payload?'check_in' then(payload->>'check_in')::timestamptz else record.check_in end;
  last_time:=case when payload?'check_out' then(payload->>'check_out')::timestamptz else record.check_out end;
  if first_time is null or last_time is null or last_time<=first_time or not isfinite(first_time) or not isfinite(last_time) then raise exception 'Actual valid check-in and checkout required';end if;
  if operation='add_record' then insert into public.build_records(session_id,member_id,check_in,check_out,checkout_method,credit_override) values(sid,person,first_time,last_time,'administrative correction',(payload->>'credit_override')::boolean) returning * into record;
  else update public.build_records set check_in=first_time,check_out=last_time,checkout_method='administrative correction',credit_override=case when payload?'credit_override' then(payload->>'credit_override')::boolean else credit_override end where id=rid returning * into record;end if;
 end if;return to_jsonb(record);
end $$;
revoke insert,update,delete on public.build_locations,public.build_sessions,public.build_records from public,anon,authenticated;
revoke all on function public.build_action(jsonb) from public,anon,authenticated;
grant execute on function public.build_action(jsonb) to authenticated;
-- pg_cron is cluster-configured for one database; isolated upgrade fixtures do
-- not own that scheduler. The configured application database installs the job.
do $$ begin
 if current_database()=coalesce(current_setting('cron.database_name',true),'postgres') then
  create extension if not exists pg_cron;
  perform cron.schedule('auto-checkout','* * * * *','select toolkit_private.close_due_build_records()');
 end if;
end $$;
notify pgrst,'reload schema';
