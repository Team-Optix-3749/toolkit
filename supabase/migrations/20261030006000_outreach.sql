create extension if not exists btree_gist with schema extensions;
alter table public.outreach_events alter column description set not null;
alter table public.outreach_events alter column location set not null;
alter table public.outreach_events alter column season_id set not null;
alter table public.outreach_events alter column ends_at set not null;
alter table public.outreach_events add constraint outreach_valid_event check(length(btrim(title))>0 and length(btrim(description))>0 and length(btrim(location))>0 and ends_at>starts_at and isfinite(starts_at) and isfinite(ends_at));
alter table public.outreach_attendance alter column event_id set not null;
alter table public.outreach_attendance alter column member_id set not null;
create unique index outreach_one_attendance on public.outreach_attendance(event_id,member_id);
create or replace function toolkit_private.compute_outreach_credit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.departure is not null and new.departure<=new.arrival then raise exception 'Departure must be later than arrival'; end if;
 new.credit_enabled:=not (select cancelled from public.outreach_events where id=new.event_id);
 new.credited_minutes:=case when new.credit_enabled and new.departure is not null then extract(epoch from(new.departure-new.arrival))/60.0 else 0 end;
 new.credit_interval:=case when new.credit_enabled and new.departure is not null then tstzrange(new.arrival,new.departure,'[)') else null end;
 return new;
end $$;
update public.outreach_attendance set arrival=arrival;
alter table public.outreach_attendance add constraint outreach_no_credit_overlap exclude using gist(member_id with =,credit_interval with &&) where(credit_enabled);
create or replace function toolkit_private.validate_event(value jsonb) returns jsonb language plpgsql stable set search_path='' as $$
declare season uuid; field text; start_time timestamptz; end_time timestamptz;
begin
 foreach field in array array['title','description','location'] loop
  if jsonb_typeof(value->field) is distinct from 'string' or nullif(btrim(value->>field),'') is null then raise exception '% is required',field; end if;
 end loop;
 foreach field in array array['starts_at','ends_at'] loop
  if coalesce(value->>field,'') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception '% requires an offset-qualified timestamp',field; end if;
 end loop;
 start_time:=(value->>'starts_at')::timestamptz;end_time:=(value->>'ends_at')::timestamptz;
 if not isfinite(start_time) or not isfinite(end_time) or end_time<=start_time then raise exception 'End must be later than start'; end if;
 if value ? 'season_id' then season:=(value->>'season_id')::uuid;else select id into season from public.seasons where is_current;end if;
 if season is null or not exists(select 1 from public.seasons where id=season) then raise exception 'Select an existing season';end if;
 if (value->>'latitude') is null <> ((value->>'longitude') is null) then raise exception 'Coordinates must be paired';end if;
 if value->>'latitude' is not null and (abs((value->>'latitude')::double precision)>90 or abs((value->>'longitude')::double precision)>180 or (value->>'latitude')::double precision='NaN'::double precision or (value->>'longitude')::double precision='NaN'::double precision) then raise exception 'Invalid coordinates';end if;
 return value || jsonb_build_object('season_id',season,'title',btrim(value->>'title'),'description',btrim(value->>'description'),'location',btrim(value->>'location'));
end $$;
create or replace function toolkit_private.create_outreach_event(payload jsonb,actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare fields jsonb; result public.outreach_events;
begin
 if actor is distinct from auth.uid() or not public.is_member() then raise exception 'Invalid event actor';end if;
 fields:=toolkit_private.validate_event(payload);
 insert into public.outreach_events(title,description,location,starts_at,ends_at,season_id,latitude,longitude,created_by)
 values(fields->>'title',fields->>'description',fields->>'location',(fields->>'starts_at')::timestamptz,(fields->>'ends_at')::timestamptz,(fields->>'season_id')::uuid,(fields->>'latitude')::double precision,(fields->>'longitude')::double precision,actor) returning * into result;
 return to_jsonb(result);
end $$;
create or replace function public.outreach_action(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare operation text:=payload->>'action'; event public.outreach_events; result jsonb; fields jsonb; target uuid; person uuid; start_time timestamptz; end_time timestamptz; patch jsonb; unknown text[]; ids uuid[];
begin
 if not public.is_member() then raise exception 'Active verified admission and valid session required';end if;
 if jsonb_typeof(payload) is distinct from 'object' or operation is null or operation not in ('create','edit','cancel','restore','leads','rsvp','attendance') then raise exception 'Unknown outreach action';end if;
 select array_agg(key) into unknown from jsonb_object_keys(payload) key where not(key=any(case operation
 when 'create' then array['action','title','description','location','starts_at','ends_at','season_id','latitude','longitude']
 when 'edit' then array['action','id','title','description','location','starts_at','ends_at','season_id','latitude','longitude','attendance_corrections']
 when 'leads' then array['action','id','member_ids'] when 'rsvp' then array['action','event_id','planned'] when 'attendance' then array['action','event_id','member_id','arrival','departure'] else array['action','id'] end));
 if unknown is not null then raise exception 'Unsupported outreach fields: %',unknown;end if;
 if operation in ('create','edit','cancel','restore','leads') and not public.has_perm('manage_outreach_events') then raise exception 'Manage outreach events permission required';end if;
 if operation='create' then return toolkit_private.create_outreach_event(payload,auth.uid());end if;
 target:=coalesce(payload->>'id',payload->>'event_id')::uuid;
 select * into event from public.outreach_events where id=target for update;
 if not found then raise exception 'Event not found';end if;
 if operation='rsvp' then
  if event.cancelled or clock_timestamp()>=event.starts_at then raise exception 'RSVP changes close when the event starts';end if;
  if jsonb_typeof(payload->'planned') is distinct from 'boolean' then raise exception 'planned must be boolean';end if;
  if (payload->>'planned')::boolean then insert into public.outreach_rsvps(event_id,member_id,planned) values(target,auth.uid(),true) on conflict(event_id,member_id) do update set planned=true;
  else delete from public.outreach_rsvps where event_id=target and member_id=auth.uid();end if;
  return jsonb_build_object('event_id',target,'planned',payload->'planned');
 elsif operation='leads' then
  if jsonb_typeof(payload->'member_ids') is distinct from 'array' then raise exception 'member_ids array required';end if;
  select coalesce(array_agg(distinct value::uuid),'{}') into ids from jsonb_array_elements_text(payload->'member_ids');
  if exists(select 1 from unnest(ids) selected(member_id) left join public.profiles p on p.id=selected.member_id left join auth.users u on u.id=p.id where p.id is null or p.account_status<>'active' or p.role='PENDING' or u.email_confirmed_at is null) then raise exception 'Selected leads must be active admitted verified accounts';end if;
  delete from public.outreach_leads where event_id=target;
  insert into public.outreach_leads(event_id,member_id) select target,unnest(ids);
 elsif operation in ('cancel','restore') then
  if event.cancelled=(operation='cancel') then raise exception 'Event state is stale';end if;
  update public.outreach_events set cancelled=(operation='cancel') where id=target;
  update public.outreach_attendance set arrival=arrival where event_id=target;
 elsif operation='edit' then
  fields:=toolkit_private.validate_event(to_jsonb(event)||payload);
  if payload ? 'attendance_corrections' then
   if not public.has_perm('manage_outreach_attendance') then raise exception 'Attendance corrections require global attendance authority';end if;
   if jsonb_typeof(payload->'attendance_corrections') is distinct from 'array' then raise exception 'Complete attendance corrections required';end if;
   if (select count(*) from public.outreach_attendance where event_id=target)<>jsonb_array_length(payload->'attendance_corrections') or exists(select 1 from public.outreach_attendance a where event_id=target and not exists(select 1 from jsonb_array_elements(payload->'attendance_corrections') p where (p->>'member_id')::uuid=a.member_id)) then raise exception 'Corrections must cover every existing attendance row exactly once';end if;
  elsif exists(select 1 from public.outreach_attendance where event_id=target and (arrival<(fields->>'starts_at')::timestamptz or arrival>(fields->>'ends_at')::timestamptz or departure>(fields->>'ends_at')::timestamptz)) then raise exception 'Window change invalidates attendance; supply complete global correction';end if;
  update public.outreach_events set title=fields->>'title',description=fields->>'description',location=fields->>'location',starts_at=(fields->>'starts_at')::timestamptz,ends_at=(fields->>'ends_at')::timestamptz,season_id=(fields->>'season_id')::uuid,latitude=(fields->>'latitude')::double precision,longitude=(fields->>'longitude')::double precision where id=target;
  for patch in select value from jsonb_array_elements(coalesce(payload->'attendance_corrections','[]')) loop
   if jsonb_typeof(patch) is distinct from 'object' or exists(select 1 from jsonb_object_keys(patch) k where k not in ('member_id','arrival','departure')) or coalesce(patch->>'arrival','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' or (patch->>'departure' is not null and patch->>'departure' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$') then raise exception 'Correction requires member and offset-qualified timestamps only';end if;
   start_time:=(patch->>'arrival')::timestamptz;end_time:=(patch->>'departure')::timestamptz;
   if start_time is null or not isfinite(start_time) or (end_time is not null and (not isfinite(end_time) or end_time<=start_time)) then raise exception 'Invalid correction interval';end if;
   update public.outreach_attendance set arrival=start_time,departure=end_time where event_id=target and member_id=(patch->>'member_id')::uuid;
  end loop;
 elsif operation='attendance' then
  person:=(payload->>'member_id')::uuid;
  if not public.has_perm('manage_outreach_attendance') and not exists(select 1 from public.outreach_leads where event_id=target and member_id=auth.uid()) then raise exception 'Assigned event lead or global attendance authority required';end if;
  if not exists(select 1 from public.profiles where id=person and role<>'PENDING') then raise exception 'Admitted member required';end if;
  if coalesce(payload->>'arrival','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' or (payload->>'departure' is not null and payload->>'departure' !~ '(Z|[+-][0-9]{2}:[0-9]{2})$') then raise exception 'Attendance requires offset-qualified timestamps';end if;
  start_time:=(payload->>'arrival')::timestamptz;end_time:=(payload->>'departure')::timestamptz;
  if not isfinite(start_time) or (end_time is not null and (not isfinite(end_time) or end_time<=start_time)) then raise exception 'Departure must be later than arrival';end if;
  if not public.has_perm('manage_outreach_attendance') and (event.cancelled or start_time<event.starts_at or start_time>=event.ends_at or end_time>event.ends_at) then raise exception 'Event leads may enter only in-window attendance';end if;
  perform pg_advisory_xact_lock(hashtextextended(person::text,0));
  insert into public.outreach_attendance(event_id,member_id,arrival,departure) values(target,person,start_time,end_time) on conflict(event_id,member_id) do update set arrival=excluded.arrival,departure=excluded.departure returning to_jsonb(outreach_attendance.*) into result;
  return result;
 end if;
 select to_jsonb(e) into result from public.outreach_events e where id=target;return result;
end $$;
revoke insert,update,delete on public.outreach_events,public.outreach_leads,public.outreach_rsvps,public.outreach_attendance from authenticated,anon,public;
do $$ declare p record;begin for p in select policyname,tablename from pg_policies where schemaname='public' and tablename in ('outreach_events','outreach_leads','outreach_rsvps','outreach_attendance') loop execute format('drop policy %I on public.%I',p.policyname,p.tablename);end loop;end $$;
create policy outreach_events_read on public.outreach_events for select to authenticated using(public.is_member());
create policy outreach_leads_read on public.outreach_leads for select to authenticated using(public.is_member());
create policy outreach_rsvps_read on public.outreach_rsvps for select to authenticated using(public.is_member());
create or replace function toolkit_private.can_view_event_attendance(event_id uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_member() and (public.has_perm('manage_outreach_attendance') or exists(select 1 from public.outreach_leads l where l.event_id=$1 and l.member_id=auth.uid()))$$;
grant execute on function toolkit_private.can_view_event_attendance(uuid) to authenticated;
create policy outreach_attendance_read on public.outreach_attendance for select to authenticated using(public.is_member() and(member_id=auth.uid() or toolkit_private.can_view_event_attendance(event_id)));
revoke all on function toolkit_private.validate_event(jsonb),toolkit_private.create_outreach_event(jsonb,uuid) from public,anon,authenticated;
revoke all on function public.outreach_action(jsonb) from public,anon,authenticated;
grant execute on function public.outreach_action(jsonb) to authenticated;
notify pgrst,'reload schema';
