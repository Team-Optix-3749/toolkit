-- Identity authority is server-owned; configurable grants are independent of titles.
-- Source snapshots remain private even after the obsolete public field is removed.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema toolkit_private revoke execute on functions from public, anon, authenticated;

drop trigger if exists guard_profile_privileges_trg on public.profiles;
drop function if exists public.guard_profile_privileges();
insert into toolkit_upgrade.source_rows(source_table,source_key,payload)
select 'profiles',id::text,to_jsonb(p) from public.profiles p
on conflict(source_table,source_key) do nothing;

do $$
declare invalid jsonb;
begin
  select jsonb_agg(jsonb_build_object('id',id,'account_type',account_type,'role',role)) into invalid
  from public.profiles where account_type is null or account_type not in ('member','mentor')
    or (role in ('LEADERSHIP','OFFICER','OWNER') and account_type <> 'member');
  if invalid is not null then raise exception 'Explicit account-type correction required: %',invalid; end if;
  select jsonb_agg(jsonb_build_object('id',p.id,'unknown_permissions',bad.values)) into invalid
  from public.profiles p cross join lateral (
    select array_agg(distinct value) as values from unnest(p.permissions || p.special_perms) value
    where value is null or value <> all(array['manage_accounts','manage_invitations','manage_tasks','manage_groups',
      'manage_seasons','manage_outreach_events','manage_outreach_attendance','manage_build_hours','manage_opis',
      'export_records','manage_scouting','manage_purchases']::text[])
  ) bad where bad.values is not null;
  if invalid is not null then raise exception 'Unrecognized permission values require correction: %',invalid; end if;
  select jsonb_agg(id) into invalid from public.profiles where role='OWNER' and account_status='active';
  if jsonb_array_length(invalid)>1 then raise exception 'Explicit President selection required: %',invalid; end if;
end $$;
update public.profiles p set permissions=(select coalesce(array_agg(distinct value order by value),'{}'::text[])
  from unnest(p.permissions || p.special_perms) value);
alter table public.profiles drop column special_perms;
alter table public.profiles alter column account_type set default 'member';
alter table public.profiles alter column account_type set not null;
alter table public.profiles add constraint profiles_student_administrator_type
  check(role not in ('LEADERSHIP','OFFICER','OWNER') or account_type='member');
alter table public.profiles add constraint profiles_configurable_permissions check(
  permissions <@ array['manage_accounts','manage_invitations','manage_tasks','manage_groups','manage_seasons',
    'manage_outreach_events','manage_outreach_attendance','manage_build_hours','manage_opis','export_records',
    'manage_scouting','manage_purchases']::text[] and array_position(permissions,null) is null);
create unique index profiles_one_active_president on public.profiles(role) where role='OWNER' and account_status='active';

-- Missing, malformed, expired, revoked, and other-account session IDs all fail closed.
create or replace function toolkit_private.has_auth_session() returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare sid uuid;
begin
  begin sid := nullif(auth.jwt()->>'session_id','')::uuid;
  exception when invalid_text_representation then return false; end;
  if auth.uid() is null or sid is null then return false; end if;
  return exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    where s.id=sid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>statement_timestamp()));
end $$;
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = '' as $$
  select toolkit_private.has_auth_session() and exists(
    select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=auth.uid() and p.role in ('MEMBER','LEADERSHIP','OFFICER','OWNER')
      and p.account_status='active' and u.email_confirmed_at is not null);
$$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member() and exists(select 1 from public.profiles where id=auth.uid() and role='OWNER');
$$;
create or replace function public.is_student_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member() and exists(select 1 from public.profiles where id=auth.uid()
    and account_type='member' and role in ('LEADERSHIP','OFFICER','OWNER'));
$$;
create or replace function public.has_perm(perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member() and perm=any(array['manage_accounts','manage_invitations','manage_tasks','manage_groups',
    'manage_seasons','manage_outreach_events','manage_outreach_attendance','manage_build_hours','manage_opis',
    'export_records','manage_scouting','manage_purchases']::text[]) and exists(
    select 1 from public.profiles where id=auth.uid() and (role='OWNER' or perm=any(permissions)));
$$;

-- These policies formerly used title-based helpers; settings without a delegated
-- capability remain President-only. Remove the obsolete authority entry points.
drop policy if exists baseline_org_settings_read on public.org_settings;
create policy identity_org_settings_read on public.org_settings for select to authenticated using(public.is_owner());
drop policy if exists baseline_email_templates_read on public.email_templates;
create policy identity_email_templates_read on public.email_templates for select to authenticated using(public.is_owner());
drop function if exists public.is_leadership();
drop function if exists public.is_admin();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name,role,account_status,account_type,permissions)
  values(new.id,coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'),''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'),''),nullif(btrim(new.raw_user_meta_data->>'name'),''),
    nullif(split_part(new.email,'@',1),''),'New account'),
    'PENDING','active',case when new.raw_user_meta_data->>'account_type'='mentor' then 'mentor' else 'member' end,'{}');
  return new;
end $$;

-- No client role can read or mutate the base authority/contact record.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='profiles' loop
    execute format('drop policy %I on public.profiles',p.policyname);
  end loop;
end $$;
revoke all on public.profiles from public,anon,authenticated;

create or replace function toolkit_private.profile_json(profile_id uuid, include_email boolean default false) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',p.id,'created_at',p.created_at,'display_name',p.display_name,
    'role',p.role,'account_type',p.account_type,'account_status',p.account_status,'permissions',p.permissions,
    'displayed_role',p.displayed_role,'department',p.department,'grade',p.grade,'avatar_url',p.avatar_url,'bio',p.bio,
    'hours_public',p.hours_public,'verified',u.email_confirmed_at is not null)
    || case when include_email then jsonb_build_object('email',u.email) else '{}'::jsonb end
  from public.profiles p join auth.users u on u.id=p.id where p.id=profile_id;
$$;
create or replace function public.profile_action(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare operation text := payload->>'action'; unknown text[]; result jsonb;
begin
  if not toolkit_private.has_auth_session() then raise exception using errcode='28000',message='A valid sign-in session is required'; end if;
  if jsonb_typeof(payload) is distinct from 'object' then raise exception using errcode='22023',message='An action object is required'; end if;
  if operation not in ('get_self','edit_self') or operation is null then
    raise exception using errcode='22023',message='Unknown profile action';
  end if;
  select array_agg(key) into unknown from jsonb_object_keys(payload) key where not(key=any(
    case when operation='get_self' then array['action'] else array['action','display_name','department','grade','avatar_url','bio','displayed_role'] end));
  if unknown is not null then raise exception using errcode='42501',message='Unsupported profile fields: ' || unknown::text; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  if not found then raise exception using errcode='P0002',message='Account profile is unavailable; retry loading'; end if;
  if operation='edit_self' then
    if exists(select 1 from jsonb_each(payload) e where e.key<>'action' and jsonb_typeof(e.value) not in ('string','null')) then
      raise exception using errcode='22023',message='Profile fields must be text or null';
    end if;
    if payload ? 'display_name' and (payload->>'display_name' is null or length(btrim(payload->>'display_name')) not between 1 and 120) then
      raise exception using errcode='22023',message='Name must contain between 1 and 120 characters';
    end if;
    if nullif(payload->>'avatar_url','') is not null and (payload->>'avatar_url') !~* '^https?://[^/[:space:]]+(/[^[:space:]]*)?$' then
      raise exception using errcode='22023',message='Avatar URL must use HTTP or HTTPS';
    end if;
    update public.profiles p set
      display_name=case when payload ? 'display_name' then btrim(payload->>'display_name') else p.display_name end,
      department=case when payload ? 'department' then payload->>'department' else p.department end,
      grade=case when payload ? 'grade' then payload->>'grade' else p.grade end,
      avatar_url=case when payload ? 'avatar_url' then nullif(payload->>'avatar_url','') else p.avatar_url end,
      bio=case when payload ? 'bio' then payload->>'bio' else p.bio end,
      displayed_role=case when payload ? 'displayed_role' then payload->>'displayed_role' else p.displayed_role end
    where p.id=auth.uid();
  end if;
  result := toolkit_private.profile_json(auth.uid(),true);
  return result;
end $$;

create or replace function public.account_directory(payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare administer boolean; result jsonb;
begin
  if not toolkit_private.has_auth_session() then raise exception using errcode='28000',message='A valid sign-in session is required'; end if;
  if not public.is_member() then raise exception using errcode='42501',message='Active verified admission is required'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or payload<>'{}'::jsonb then
    raise exception using errcode='22023',message='Account directory accepts an empty object';
  end if;
  administer := public.is_student_admin() or public.has_perm('manage_accounts');
  select coalesce(jsonb_agg(toolkit_private.profile_json(p.id,administer) order by p.display_name,p.id),'[]'::jsonb)
    into result from public.profiles p where administer or p.id=auth.uid();
  return result;
end $$;

-- Lock actor and target in one UUID order before reading authority or state.
create or replace function public.account_action(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare operation text := payload->>'action'; target_id uuid; actor public.profiles; target public.profiles;
  unknown text[]; grants text[]; dependency record; has_history boolean;
begin
  if not toolkit_private.has_auth_session() then raise exception using errcode='28000',message='A valid sign-in session is required'; end if;
  if jsonb_typeof(payload) is distinct from 'object' then raise exception using errcode='22023',message='An action object is required'; end if;
  if operation is null or operation not in ('approve','reject','deactivate','reactivate','set_permissions','make_administrator','remove_administrator','transfer_presidency') then
    raise exception using errcode='22023',message='Unknown account action';
  end if;
  select array_agg(key) into unknown from jsonb_object_keys(payload) key where not(key=any(
    case operation when 'set_permissions' then array['action','id','permissions']
      when 'make_administrator' then array['action','id','role'] else array['action','id'] end));
  if unknown is not null then raise exception using errcode='22023',message='Unsupported account fields: ' || unknown::text; end if;
  begin target_id := (payload->>'id')::uuid;
  exception when invalid_text_representation then raise exception using errcode='22023',message='A valid account id is required'; end;
  if target_id is null then raise exception using errcode='22023',message='Account id is required'; end if;
  perform p.id from public.profiles p where p.id in (auth.uid(),target_id) order by p.id for update;
  select * into actor from public.profiles where id=auth.uid();
  if not public.is_member() then raise exception using errcode='42501',message='Active verified admission is required'; end if;
  select * into target from public.profiles where id=target_id;
  if not found then raise exception using errcode='P0002',message='Account does not exist'; end if;

  if operation in ('approve','reject','deactivate','reactivate') then
    if not public.has_perm('manage_accounts') or target.role not in ('PENDING','MEMBER') then
      raise exception using errcode='42501',message='Account managers may act only on ordinary accounts';
    end if;
    case operation
      when 'approve' then
        if target.role<>'PENDING' or target.account_status<>'active' then raise exception using errcode='22023',message='Only a prospective active account can be approved'; end if;
        if not exists(select 1 from auth.users where id=target_id and email_confirmed_at is not null) then
          raise exception using errcode='22023',message='Verified email is required for admission';
        end if;
        update public.profiles set role='MEMBER',permissions='{}' where id=target_id;
      when 'reject' then
        if target.role<>'PENDING' or target.account_status<>'active' then raise exception using errcode='22023',message='Only a prospective active account can be rejected'; end if;
        -- No operational history can be silently cascaded or orphaned by rejection.
        for dependency in select distinct ns.nspname as schema_name,c.relname as table_name,a.attname as column_name
          from pg_constraint fk join pg_class c on c.oid=fk.conrelid join pg_namespace ns on ns.oid=c.relnamespace
          join pg_attribute a on a.attrelid=c.oid and a.attnum=any(fk.conkey)
          where fk.contype='f' and fk.confrelid='public.profiles'::regclass
            and not(ns.nspname='public' and c.relname in ('notifications','notification_preferences','login_events'))
        loop
          execute format('select exists(select 1 from %I.%I where %I=$1)',dependency.schema_name,dependency.table_name,dependency.column_name)
            into has_history using target_id;
          if has_history then raise exception using errcode='22023',message='Prospective account has retained records and cannot be rejected'; end if;
        end loop;
        if exists(select 1 from public.individual_outreach where user_id=target_id or reviewer_id=target_id)
          or exists(select 1 from public.purchases where user_id=target_id or reviewer_id=target_id) then
          raise exception using errcode='22023',message='Prospective account has retained records and cannot be rejected';
        end if;
        delete from auth.refresh_tokens where user_id::text=target_id::text;
        delete from auth.sessions where user_id=target_id;
        delete from public.notifications where user_id=target_id;
        delete from public.notification_preferences where user_id=target_id;
        delete from public.login_events where user_id=target_id;
        delete from public.profiles where id=target_id;
        delete from auth.users where id=target_id;
        return jsonb_build_object('id',target_id,'rejected',true);
      when 'deactivate' then
        if target.role<>'MEMBER' or target.account_status<>'active' then raise exception using errcode='22023',message='Only an active ordinary admitted account can be deactivated'; end if;
        update public.profiles set account_status='deactivated' where id=target_id;
        delete from auth.refresh_tokens where user_id::text=target_id::text;
        delete from auth.sessions where user_id=target_id;
      when 'reactivate' then
        if target.role<>'MEMBER' or target.account_status<>'deactivated' then raise exception using errcode='22023',message='Only a deactivated ordinary admitted account can be reactivated'; end if;
        update public.profiles set account_status='active' where id=target_id;
    end case;
  elsif operation='set_permissions' then
    if not public.is_student_admin() or target.role='OWNER' or target.account_status<>'active' then
      raise exception using errcode='42501',message='Student administrators may assign grants only to active non-President accounts';
    end if;
    if jsonb_typeof(payload->'permissions') is distinct from 'array' or exists(
      select 1 from jsonb_array_elements(payload->'permissions') e where jsonb_typeof(e)<>'string') then
      raise exception using errcode='22023',message='Permissions must be an array of canonical identifiers';
    end if;
    select coalesce(array_agg(distinct value order by value),'{}'::text[]) into grants from jsonb_array_elements_text(payload->'permissions') value;
    if not(grants <@ array['manage_accounts','manage_invitations','manage_tasks','manage_groups','manage_seasons',
      'manage_outreach_events','manage_outreach_attendance','manage_build_hours','manage_opis','export_records','manage_scouting','manage_purchases']::text[]) then
      raise exception using errcode='22023',message='Unknown configurable permission';
    end if;
    update public.profiles set permissions=grants where id=target_id;
  else
    if not public.is_owner() then raise exception using errcode='42501',message='Only the President may change administrator status or transfer Presidency'; end if;
    if target.account_type<>'member' or target.account_status<>'active' or not exists(
      select 1 from auth.users where id=target_id and email_confirmed_at is not null) then
      raise exception using errcode='22023',message='An active verified student account is required';
    end if;
    case operation
      when 'make_administrator' then
        if target.role<>'MEMBER' or payload->>'role' is null or payload->>'role' not in ('LEADERSHIP','OFFICER') then
          raise exception using errcode='22023',message='Choose LEADERSHIP or OFFICER for an ordinary student member';
        end if;
        update public.profiles set role=payload->>'role' where id=target_id;
      when 'remove_administrator' then
        if target.role not in ('LEADERSHIP','OFFICER') then raise exception using errcode='22023',message='Only a student administrator can be removed'; end if;
        update public.profiles set role='MEMBER' where id=target_id;
      when 'transfer_presidency' then
        if target_id=actor.id or target.role not in ('MEMBER','LEADERSHIP','OFFICER') then
          raise exception using errcode='22023',message='Choose a different active student member';
        end if;
        update public.profiles set role='OFFICER' where id=actor.id;
        update public.profiles set role='OWNER' where id=target_id;
    end case;
  end if;
  return toolkit_private.profile_json(target_id,true);
end $$;

-- Deliberately definer-owned views: their sole projections omit contact/authority
-- data and their explicit predicates recheck the caller, not the view owner.
create view public.public_directory with (security_barrier=true) as
select p.id,p.display_name,p.role,p.displayed_role,p.account_type,p.department,p.grade,p.avatar_url,p.bio,p.account_status
from public.profiles p join auth.users u on u.id=p.id
where public.is_member() and p.account_status='active' and p.role<>'PENDING' and u.email_confirmed_at is not null;
create view public.historical_profiles with (security_barrier=true) as
select p.id,p.display_name from public.profiles p where public.is_member() and p.role<>'PENDING';
revoke all on public.public_directory,public.historical_profiles from public,anon,authenticated;
grant select on public.public_directory,public.historical_profiles to authenticated;

-- Preserve existing domain relationship policies, intersected with one compulsory
-- session/admission gate. Restrictive policies cannot be bypassed by an OR policy.
do $$ declare t record; begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
  loop
    execute format('alter table public.%I enable row level security',t.relname);
    execute format('create policy identity_active_session on public.%I as restrictive for all to public using(public.is_member()) with check(public.is_member())',t.relname);
  end loop;
end $$;
create policy identity_active_session on storage.objects as restrictive for all to public
  using(public.is_member()) with check(public.is_member());
update storage.buckets set public=false where id in ('task-evidence','outreach-proofs','receipts');

-- Private attachments retain their existing object keys. Task objects use the
-- existing task ID folder and participant/reviewer relationship model until the
-- owning-group workflow migration replaces it; management alone cannot forge work.
drop policy if exists baseline_attachment_read on storage.objects;
drop policy if exists baseline_attachment_insert on storage.objects;
drop policy if exists baseline_attachment_delete on storage.objects;
create or replace function toolkit_private.can_read_task_file(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member() and exists(select 1 from public.tasks t
    where t.id::text in (split_part(object_name,'/',1),split_part(object_name,'/',2))
    and (public.has_perm('manage_tasks') or exists(select 1 from public.task_assignees a where a.task_id=t.id and a.user_id=auth.uid())
      or exists(select 1 from public.task_reviewers r where r.task_id=t.id and r.user_id=auth.uid())));
$$;
create or replace function toolkit_private.can_upload_task_file(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_member() and split_part(object_name,'/',1)=auth.uid()::text
    and exists(select 1 from public.task_assignees a
      where a.task_id::text=split_part(object_name,'/',2) and a.user_id=auth.uid());
$$;
-- Policy helpers live in the non-exposed schema; execution is granted only where
-- PostgreSQL must evaluate them as the caller. They reveal no record data.
grant usage on schema toolkit_private to authenticated;
grant execute on function toolkit_private.can_read_task_file(text),toolkit_private.can_upload_task_file(text) to authenticated;
create policy identity_storage_read on storage.objects for select to authenticated using(
  (bucket_id='task-evidence' and toolkit_private.can_read_task_file(name))
  or (bucket_id='outreach-proofs' and (split_part(name,'/',1)=auth.uid()::text or public.has_perm('manage_outreach_attendance')))
  or (bucket_id='receipts' and (split_part(name,'/',1)=auth.uid()::text or public.has_perm('manage_purchases'))));
create policy identity_storage_insert on storage.objects for insert to authenticated with check(
  (bucket_id='task-evidence' and toolkit_private.can_upload_task_file(name))
  or (bucket_id in ('outreach-proofs','receipts') and split_part(name,'/',1)=auth.uid()::text));
create policy identity_storage_delete on storage.objects for delete to authenticated using(
  (bucket_id='task-evidence' and (public.has_perm('manage_tasks') or (owner_id=auth.uid()::text and toolkit_private.can_upload_task_file(name))))
  or (bucket_id in ('outreach-proofs','receipts') and split_part(name,'/',1)=auth.uid()::text));

-- Retained operational rows have no generic deletion path. Relationship
-- replacement, RSVP withdrawal and authorized evidence removal remain available.
revoke delete on public.profiles,public.tasks,public.task_history,public.opis,public.opi_versions,public.opi_feedback,
  public.outreach_events,public.outreach_attendance,public.build_sessions,public.build_records,
  public.individual_outreach,public.purchases,public.match_scouting,public.pit_scouting from authenticated,anon;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('owner_delete_row','owner_delete_member')
  loop execute format('drop function %s',f.signature); end loop;
end $$;

-- A purchase reviewer is an independently granted manager, not an officer title.
drop policy if exists baseline_purchases_read on public.purchases;
drop policy if exists baseline_purchases_update on public.purchases;
create policy identity_purchases_read on public.purchases for select to authenticated
  using(user_id=auth.uid() or public.has_perm('manage_purchases'));
create policy identity_purchases_update on public.purchases for update to authenticated
  using((user_id=auth.uid() and status='PENDING') or public.has_perm('manage_purchases'))
  with check((user_id=auth.uid() and status='PENDING') or public.has_perm('manage_purchases'));

-- Existing aggregate callers keep their wire shape until season reporting lands.
-- The view owner may read profiles, but the caller must pass active-session checks.
create or replace view public.hours_summary with (security_invoker=false,security_barrier=true) as
select p.id as user_id,p.display_name,
  round(coalesce(b.minutes,0)/60.0,1) as build_hours,
  round((coalesce(o.minutes,0)+least(coalesce(i.hours,0),6)*60)/60.0,1) as outreach_hours,
  round((coalesce(b.minutes,0)+coalesce(o.minutes,0)+least(coalesce(i.hours,0),6)*60)/60.0,1) as total_hours
from public.profiles p
left join (select member_id,sum(coalesce(credited_minutes,0)) as minutes from public.build_records where credit_enabled group by member_id) b on b.member_id=p.id
left join (select member_id,sum(coalesce(credited_minutes,0)) as minutes from public.outreach_attendance where credit_enabled group by member_id) o on o.member_id=p.id
left join (select user_id,sum(coalesce(credited_hours,hours,0)) as hours from public.individual_outreach where status='APPROVED' group by user_id) i on i.user_id=p.id
where public.is_member() and p.role<>'PENDING'
  and (p.id=auth.uid() or public.has_perm('manage_accounts') or public.has_perm('export_records'));
revoke all on public.hours_summary from public,anon;

revoke all on function toolkit_private.has_auth_session(),toolkit_private.profile_json(uuid,boolean) from public,anon,authenticated;
revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.is_member(),public.is_owner(),public.has_perm(text),public.is_student_admin(),
  public.profile_action(jsonb),public.account_directory(jsonb),public.account_action(jsonb) from public,anon,authenticated;
grant execute on function public.is_member(),public.is_owner(),public.has_perm(text),public.is_student_admin(),
  public.profile_action(jsonb),public.account_directory(jsonb),public.account_action(jsonb) to authenticated;
notify pgrst,'reload schema';
