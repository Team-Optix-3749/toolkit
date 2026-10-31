-- Exact, season-bound individual outreach; original source values remain private.
insert into toolkit_upgrade.source_rows(source_table,source_key,payload)
select 'individual_outreach',id::text,to_jsonb(i) from public.individual_outreach i
on conflict(source_table,source_key) do nothing;

do $$ begin
  if exists(select 1 from public.individual_outreach where season_id is null) then
    raise exception 'Individual outreach requires explicit season mapping; no date-based attribution is permitted';
  end if;
end $$;
alter table public.individual_outreach add column claimed_minutes numeric;
alter table public.individual_outreach add column approved_minutes numeric;
update public.individual_outreach set claimed_minutes=hours*60,
  approved_minutes=case when status='APPROVED' then coalesce(credited_hours,hours)*60 else null end;
alter table public.individual_outreach alter column season_id set not null;
alter table public.individual_outreach alter column claimed_minutes set not null;
alter table public.individual_outreach add constraint individual_valid_minutes check (
  claimed_minutes > 0 and claimed_minutes < 'Infinity'::numeric and
  (approved_minutes is null or (approved_minutes >= 0 and approved_minutes <= claimed_minutes and approved_minutes < 'Infinity'::numeric)) and
  ((status='APPROVED' and approved_minutes is not null) or (status<>'APPROVED' and approved_minutes is null))
);
-- Map only known bucket URLs to retained keys; fail instead of discarding links.
do $$ declare r record; ref text; key text; keys text[]; begin
  for r in select id,proof_urls from public.individual_outreach loop
    keys := '{}';
    foreach ref in array r.proof_urls loop
      key := ref;
      if ref ~ '^https?://' then
        key := substring(ref from '/storage/v1/object/(?:public|authenticated)/outreach-proofs/(.+)$');
        if key is null then raise exception 'Unmappable individual proof % on request %',ref,r.id; end if;
      end if;
      if not exists(select 1 from storage.objects where bucket_id='outreach-proofs' and name=key) then
        raise exception 'Missing individual proof object % on request %',key,r.id;
      end if;
      keys := array_append(keys,key);
    end loop;
    update public.individual_outreach set proof_urls=keys where id=r.id;
  end loop;
end $$;

create or replace function public.trg_notify_individual_outreach() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    perform public.notify_many('manage_outreach_attendance','outreach_event','Individual outreach to review',
      coalesce(new.full_name,'A member') || ' — ' || new.event_name,'/admin/outreach/individual/' || new.id || '/review');
  elsif new.status is distinct from old.status and new.status in ('APPROVED','REJECTED') then
    perform public.notify(new.user_id,'outreach_event',case when new.status='APPROVED' then 'Outreach hours approved' else 'Outreach hours rejected' end,
      'Your individual outreach for "' || new.event_name || '" was ' || lower(new.status) ||
      case when new.status='APPROVED' then ' — ' || (new.approved_minutes/60)::text || ' hr approved before the season cap.' else '.' end,'/outreach');
  end if;
  return new;
end $$;

drop view public.hours_summary;
alter table public.individual_outreach drop column hours;
alter table public.individual_outreach drop column credited_hours;
revoke insert,update,delete,truncate,references,trigger on public.individual_outreach from public,anon,authenticated;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='individual_outreach' loop
    execute format('drop policy %I on public.individual_outreach',p.policyname);
  end loop;
end $$;
create policy individual_scoped_read on public.individual_outreach for select to authenticated
using (public.is_member() and (user_id=auth.uid() or public.has_perm('manage_outreach_attendance')));

update storage.buckets set public=false,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/webm','video/quicktime'],
  file_size_limit=coalesce(file_size_limit,52428800) where id='outreach-proofs';
-- Restrictive domain guard intersects the existing shared attachment policies.
create policy individual_proof_read on storage.objects as restrictive for select to authenticated using (
 bucket_id<>'outreach-proofs' or (public.is_member() and
   ((storage.foldername(name))[1]=auth.uid()::text or
     (public.has_perm('manage_outreach_attendance') and exists(select 1 from public.individual_outreach i where storage.objects.name=any(i.proof_urls)))))
);
create policy individual_proof_upload on storage.objects as restrictive for insert to authenticated with check (
 bucket_id<>'outreach-proofs' or (public.is_member() and (storage.foldername(name))[1]=auth.uid()::text)
);
create policy individual_proof_cleanup on storage.objects as restrictive for delete to authenticated using (
 bucket_id<>'outreach-proofs' or (public.is_member() and (storage.foldername(name))[1]=auth.uid()::text
   and not exists(select 1 from public.individual_outreach i where storage.objects.name=any(i.proof_urls)))
);
create policy individual_proof_no_update on storage.objects as restrictive for update to authenticated
using (bucket_id<>'outreach-proofs') with check(bucket_id<>'outreach-proofs');

create function public.individual_outreach_action(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 operation text := payload->>'action'; season uuid; request public.individual_outreach;
 amount numeric; people integer; event_day date; proofs text[]; proof text; unknown text[];
begin
 if not public.is_member() then raise exception 'Active verified admission and valid session required'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or operation is null or operation not in ('submit','approve','reject','set_cap') then raise exception 'Unknown individual outreach action'; end if;
 select array_agg(key) into unknown from jsonb_object_keys(payload) key where not(key=any(case operation
   when 'submit' then array['action','full_name','department','event_name','what_you_did','impact','event_date','people_impacted','proof_urls','claimed_minutes','season_id']
   when 'approve' then array['action','id','approved_minutes'] when 'reject' then array['action','id']
   else array['action','season_id','cap_minutes'] end));
 if unknown is not null then raise exception 'Unsupported individual outreach fields: %',unknown; end if;
 if operation<>'submit' and not public.has_perm('manage_outreach_attendance') then raise exception 'Manage outreach attendance permission required'; end if;
 if operation='set_cap' then
   season := (payload->>'season_id')::uuid; amount := (payload->>'cap_minutes')::numeric;
   if amount is null or amount<0 or amount>='Infinity'::numeric then raise exception 'Cap minutes must be finite and nonnegative'; end if;
   update public.seasons set individual_outreach_cap_minutes=amount where id=season returning id into season;
   if not found then raise exception 'Season not found'; end if;
   return jsonb_build_object('season_id',season,'cap_minutes',amount);
 elsif operation='submit' then
   if payload ? 'season_id' then season := (payload->>'season_id')::uuid;
   else select id into season from public.seasons where is_current; end if;
   if season is null or not exists(select 1 from public.seasons where id=season) then raise exception 'Select an existing season'; end if;
   if exists(select 1 from unnest(array['full_name','event_name','what_you_did','impact']) field where nullif(btrim(payload->>field),'') is null) then raise exception 'Name, event, activity description and community impact are required'; end if;
   amount := (payload->>'claimed_minutes')::numeric;
   if amount is null or amount<=0 or amount>='Infinity'::numeric then raise exception 'Claimed minutes must be finite and positive'; end if;
   if coalesce(payload->>'event_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Event date required as YYYY-MM-DD'; end if;
   event_day := (payload->>'event_date')::date;
   if not isfinite(event_day) then raise exception 'Finite event date required'; end if;
   if coalesce(payload->>'people_impacted','') !~ '^\d+$' then raise exception 'People impacted must be a nonnegative integer'; end if;
   people := (payload->>'people_impacted')::integer;
   if jsonb_typeof(payload->'proof_urls') is distinct from 'array' then raise exception 'Visual proof required'; end if;
   if jsonb_array_length(payload->'proof_urls') not between 1 and 5 then raise exception 'Provide one to five visual proofs'; end if;
   if exists(select 1 from jsonb_array_elements(payload->'proof_urls') p where jsonb_typeof(p)<>'string') then raise exception 'Invalid proof paths'; end if;
   select array_agg(value) into proofs from jsonb_array_elements_text(payload->'proof_urls');
   if cardinality(proofs)<>(select count(distinct p) from unnest(proofs) p) then raise exception 'Duplicate proof paths'; end if;
   foreach proof in array proofs loop
     if split_part(proof,'/',1)<>auth.uid()::text or proof ~ '(^|/)\.\.(/|$)' or not exists(
       select 1 from storage.objects o where o.bucket_id='outreach-proofs' and o.name=proof and o.owner=auth.uid()
       and o.metadata->>'mimetype'=any(array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/webm','video/quicktime'])
       and (o.metadata->>'size')::numeric>0 and (o.metadata->>'size')::numeric<=52428800
     ) then raise exception 'Proof must be an owned uploaded visual object in outreach-proofs'; end if;
   end loop;
   insert into public.individual_outreach(user_id,season_id,full_name,department,event_name,what_you_did,impact,event_date,people_impacted,proof_urls,claimed_minutes)
   values(auth.uid(),season,btrim(payload->>'full_name'),nullif(btrim(payload->>'department'),''),btrim(payload->>'event_name'),btrim(payload->>'what_you_did'),btrim(payload->>'impact'),event_day,people,proofs,amount)
   returning * into request;
 else
   select * into request from public.individual_outreach where id=(payload->>'id')::uuid for update;
   if not found then raise exception 'Individual outreach request not found'; end if;
   if request.status<>'PENDING' then raise exception 'Request already decided'; end if;
   if operation='approve' then
     amount := (payload->>'approved_minutes')::numeric;
     if amount is null or amount<0 or amount>request.claimed_minutes or amount>='Infinity'::numeric then raise exception 'Approved minutes must be finite between zero and claimed minutes'; end if;
   else amount := null; end if;
   update public.individual_outreach set status=case operation when 'approve' then 'APPROVED' else 'REJECTED' end,
     approved_minutes=amount,reviewer_id=auth.uid(),decided_at=now() where id=request.id returning * into request;
 end if;
 return to_jsonb(request);
end $$;

create function public.individual_credit(payload jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare season uuid := (payload->>'season_id')::uuid; member uuid := coalesce((payload->>'member_id')::uuid,auth.uid()); cap numeric; raw numeric; events numeric;
begin
 if not public.is_member() then raise exception 'Active verified admission and valid session required'; end if;
 if jsonb_typeof(payload) is distinct from 'object' or exists(select 1 from jsonb_object_keys(payload) k where k not in ('season_id','member_id')) then raise exception 'Invalid individual credit payload'; end if;
 if member<>auth.uid() and not public.has_perm('manage_outreach_attendance') then raise exception 'Cannot read another member individual credit'; end if;
 select individual_outreach_cap_minutes into cap from public.seasons where id=season;
 if not found then raise exception 'Season not found'; end if;
 if not exists(select 1 from public.profiles where id=member and role<>'PENDING') then raise exception 'Member not found'; end if;
 select coalesce(sum(approved_minutes),0) into raw from public.individual_outreach where user_id=member and season_id=season and status='APPROVED';
 select coalesce(sum(a.credited_minutes),0) into events from public.outreach_attendance a join public.outreach_events e on e.id=a.event_id
 where a.member_id=member and e.season_id=season and not e.cancelled and a.departure is not null;
 return jsonb_build_object('season_id',season,'member_id',member,'raw_approved_minutes',raw,'cap_minutes',cap,
 'counted_individual_minutes',least(raw,cap),'event_minutes',events,'official_outreach_minutes',events+least(raw,cap));
end $$;
revoke all on function public.individual_outreach_action(jsonb),public.individual_credit(jsonb) from public,anon,authenticated;
grant execute on function public.individual_outreach_action(jsonb),public.individual_credit(jsonb) to authenticated;

-- Interim compatibility shape; cap each season independently, never event minutes.
create view public.hours_summary with (security_invoker=false,security_barrier=true) as
select p.id as user_id,p.display_name,coalesce(b.minutes,0)/60.0 as build_hours,
 (coalesce(o.minutes,0)+coalesce(i.minutes,0))/60.0 as outreach_hours,
 (coalesce(b.minutes,0)+coalesce(o.minutes,0)+coalesce(i.minutes,0))/60.0 as total_hours
from public.profiles p
left join (select member_id,sum(credited_minutes) as minutes from public.build_records where credit_enabled group by member_id) b on b.member_id=p.id
left join (select a.member_id,sum(a.credited_minutes) as minutes from public.outreach_attendance a join public.outreach_events e on e.id=a.event_id where not e.cancelled and a.departure is not null group by a.member_id) o on o.member_id=p.id
left join (select credits.user_id,sum(least(credits.minutes,s.individual_outreach_cap_minutes)) as minutes from
 (select user_id,season_id,sum(approved_minutes) as minutes from public.individual_outreach where status='APPROVED' group by user_id,season_id) credits
 join public.seasons s on s.id=credits.season_id group by credits.user_id) i on i.user_id=p.id
where public.is_member() and p.role<>'PENDING' and (p.id=auth.uid() or public.has_perm('manage_accounts') or public.has_perm('export_records'));
revoke all on public.hours_summary from public,anon,authenticated;
grant select on public.hours_summary to authenticated;
