-- ============================================================================
-- Scouting + server-side notifications + cross-account security fixes
-- Applied 2026-10-27. Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. SECURITY FIXES
-- ---------------------------------------------------------------------------

-- profiles: members could grant themselves any permission or reactivate
-- themselves, because the guard only covered role/special_perms.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;  -- SQL Editor / service role: allow
  end if;
  if (new.role is distinct from old.role
      or new.special_perms is distinct from old.special_perms)
     and not public.is_admin() then
    new.role := old.role;
    new.special_perms := old.special_perms;
  end if;
  if (new.permissions is distinct from old.permissions
      or new.account_status is distinct from old.account_status)
     and not public.has_perm('manage_accounts') then
    new.permissions := old.permissions;
    new.account_status := old.account_status;
  end if;
  if new.role in ('OWNER','OFFICER')
     and old.role is distinct from new.role
     and not public.is_owner() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

-- task_evidence insert: `ta.task_id = ta.task_id` let an assignee of ANY task
-- add evidence to every task.
drop policy if exists te_insert on task_evidence;
create policy te_insert on task_evidence for insert to authenticated
  with check (
    user_id = auth.uid() and (
      has_perm('manage_tasks')
      or exists (select 1 from task_assignees ta where ta.task_id = task_evidence.task_id and ta.user_id = auth.uid())
      or exists (select 1 from task_reviewers tr where tr.task_id = task_evidence.task_id and tr.user_id = auth.uid())
    )
  );

-- task_history: anyone could forge history rows for any user/task.
drop policy if exists th_insert on task_history;
create policy th_insert on task_history for insert to authenticated
  with check (user_id = auth.uid());

-- task-evidence storage: only the uploader could read a file, so reviewers and
-- managers could never see pictures. Path layout is <uploader>/<task_id>/<file>.
drop policy if exists te_storage_select on storage.objects;
create policy te_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'task-evidence' and (
      (auth.uid())::text = (storage.foldername(name))[1]
      or public.has_perm('manage_tasks')
      or exists (select 1 from public.task_assignees ta
                 where ta.task_id::text = (storage.foldername(name))[2] and ta.user_id = auth.uid())
      or exists (select 1 from public.task_reviewers tr
                 where tr.task_id::text = (storage.foldername(name))[2] and tr.user_id = auth.uid())
    )
  );

-- Legacy tables were readable/writable/deletable by every signed-in user.
drop policy if exists auth_all_login_events on login_events;
drop policy if exists le_insert on login_events;
drop policy if exists le_read on login_events;
create policy le_insert on login_events for insert to authenticated with check (user_id = auth.uid());
create policy le_read on login_events for select to authenticated using (user_id = auth.uid() or is_admin());

drop policy if exists auth_all_members on members;
drop policy if exists members_admin on members;
create policy members_admin on members for all to authenticated using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- 2. NOTIFICATION FAN-OUT
-- Clients may only insert notifications for themselves (or as admin), so
-- cross-account messages must be created server-side. These triggers are the
-- single source of truth; client code should not insert notifications.
-- ---------------------------------------------------------------------------

create or replace function public.notify(target uuid, ntype text, ntitle text, nbody text, nlink text)
returns void language plpgsql security definer set search_path = public as $$
declare p jsonb;
begin
  if target is null or target = auth.uid() then return; end if;
  if not exists (select 1 from profiles where id = target and account_status = 'active') then return; end if;
  select prefs into p from notification_preferences where user_id = target;
  if p is not null and (p -> ntype ->> 'in_app') = 'false' then return; end if;
  insert into notifications (user_id, type, title, body, link) values (target, ntype, ntitle, nbody, nlink);
end $$;

-- perm = null → every LEADERSHIP+ account. perm = 'members' → every approved member.
create or replace function public.notify_many(perm text, ntype text, ntitle text, nbody text, nlink text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select id from profiles
    where account_status = 'active' and role <> 'PENDING'
      and (
        perm = 'members'
        or (perm is null and role in ('LEADERSHIP','OFFICER','OWNER'))
        or (perm is not null and perm <> 'members' and (role in ('OFFICER','OWNER') or perm = any(permissions)))
      )
  loop
    perform notify(r.id, ntype, ntitle, nbody, nlink);
  end loop;
end $$;

revoke execute on function public.notify(uuid,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.notify_many(text,text,text,text,text) from public, anon, authenticated;

-- OPIs ---------------------------------------------------------------------
create or replace function public.trg_notify_opi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notify_many('manage_opis', 'opi_status', 'New OPI submitted', new.title, '/admin/opi/' || new.id || '/review');
  elsif new.status is distinct from old.status then
    if new.status = 'RESUBMITTED' then
      perform notify_many('manage_opis', 'opi_status', 'OPI resubmitted', new.title, '/admin/opi/' || new.id || '/review');
    elsif new.status in ('CHANGES_REQUESTED','APPROVED','REJECTED','CONVERTED','SUBMITTED') then
      perform notify(new.submitter_id, 'opi_status',
        case new.status
          when 'CHANGES_REQUESTED' then 'Changes requested on your OPI'
          when 'APPROVED' then 'Your OPI was approved'
          when 'REJECTED' then 'Your OPI was rejected'
          when 'CONVERTED' then 'Your OPI became an outreach event'
          else 'Your OPI was reopened for review' end,
        new.title, '/opi/' || new.id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists notify_opi on opis;
create trigger notify_opi after insert or update of status on opis
  for each row execute function trg_notify_opi();

-- Purchases ----------------------------------------------------------------
create or replace function public.trg_notify_purchase() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notify_many(null, 'purchase_status', 'New purchase request',
      coalesce(new.description, 'Purchase') || ' — $' || coalesce(new.amount::text, '?'),
      '/admin/purchases/' || new.id || '/review');
  elsif new.status is distinct from old.status and new.status in ('APPROVED','REJECTED') then
    perform notify(new.user_id, 'purchase_status',
      case new.status when 'APPROVED' then 'Purchase approved' else 'Purchase rejected' end,
      coalesce(new.description, 'Purchase') || ' — $' || coalesce(new.amount::text, '?'),
      '/purchases/' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists notify_purchase on purchases;
create trigger notify_purchase after insert or update of status on purchases
  for each row execute function trg_notify_purchase();

-- Individual outreach ------------------------------------------------------
create or replace function public.trg_notify_individual_outreach() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notify_many('manage_outreach_attendance', 'outreach_event', 'Individual outreach to review',
      coalesce(new.full_name, 'A member') || ' — ' || coalesce(new.event_name, ''),
      '/admin/outreach/individual/' || new.id || '/review');
  elsif new.status is distinct from old.status and new.status in ('APPROVED','REJECTED') then
    perform notify(new.user_id, 'outreach_event',
      case new.status when 'APPROVED' then 'Outreach hours approved' else 'Outreach hours rejected' end,
      case new.status
        when 'APPROVED' then 'Your individual outreach for "' || coalesce(new.event_name,'') || '" was approved — '
                             || coalesce(new.credited_hours, 0) || ' hr credited.'
        else 'Your individual outreach for "' || coalesce(new.event_name,'') || '" was rejected.' end,
      '/outreach');
  end if;
  return new;
end $$;
drop trigger if exists notify_individual_outreach on individual_outreach;
create trigger notify_individual_outreach after insert or update of status on individual_outreach
  for each row execute function trg_notify_individual_outreach();

-- Tasks --------------------------------------------------------------------
create or replace function public.trg_notify_task_member() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  select title into t from tasks where id = new.task_id;
  if tg_table_name = 'task_assignees' then
    perform notify(new.user_id, 'task', 'Task assigned to you', t, '/tasks/' || new.task_id);
  else
    perform notify(new.user_id, 'task', 'You are reviewing a task', t, '/tasks/' || new.task_id);
  end if;
  return new;
end $$;
drop trigger if exists notify_task_assignee on task_assignees;
create trigger notify_task_assignee after insert on task_assignees
  for each row execute function trg_notify_task_member();
drop trigger if exists notify_task_reviewer on task_reviewers;
create trigger notify_task_reviewer after insert on task_reviewers
  for each row execute function trg_notify_task_member();

create or replace function public.trg_notify_task_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status in ('submitted','resubmitted') then
    if exists (select 1 from task_reviewers where task_id = new.id) then
      for r in select user_id from task_reviewers where task_id = new.id loop
        perform notify(r.user_id, 'task', 'Task ready for review', new.title, '/tasks/' || new.id);
      end loop;
    else
      perform notify_many('manage_tasks', 'task', 'Task ready for review', new.title, '/tasks/' || new.id);
    end if;
  elsif new.status in ('changes_requested','completed','cancelled') then
    for r in select user_id from task_assignees where task_id = new.id loop
      perform notify(r.user_id, 'task',
        case new.status
          when 'changes_requested' then 'Changes requested on your task'
          when 'completed' then 'Task completed'
          else 'Task cancelled' end,
        new.title, '/tasks/' || new.id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists notify_task_status on tasks;
create trigger notify_task_status after update of status on tasks
  for each row execute function trg_notify_task_status();

-- Outreach events ----------------------------------------------------------
create or replace function public.trg_notify_outreach_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if tg_op = 'INSERT' then
    if new.starts_at > now() then
      perform notify_many('members', 'outreach_event', 'New outreach event',
        new.title || ' — ' || to_char(new.starts_at at time zone 'America/Los_Angeles', 'Mon DD, HH12:MI AM'),
        '/outreach/events/' || new.id);
    end if;
  elsif new.cancelled is distinct from old.cancelled then
    for r in
      select member_id from outreach_rsvps where event_id = new.id
      union select member_id from outreach_leads where event_id = new.id
    loop
      perform notify(r.member_id, 'outreach_event',
        case when new.cancelled then 'Outreach event cancelled' else 'Outreach event restored' end,
        new.title, '/outreach/events/' || new.id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists notify_outreach_event on outreach_events;
create trigger notify_outreach_event after insert or update of cancelled on outreach_events
  for each row execute function trg_notify_outreach_event();

create or replace function public.trg_notify_outreach_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify(new.member_id, 'outreach_event', 'You are leading an outreach event',
    (select title from outreach_events where id = new.event_id), '/outreach/events/' || new.event_id);
  return new;
end $$;
drop trigger if exists notify_outreach_lead on outreach_leads;
create trigger notify_outreach_lead after insert on outreach_leads
  for each row execute function trg_notify_outreach_lead();

-- Build sessions (only near-term changes, to avoid recurring-series spam) ---
create or replace function public.trg_notify_build_session() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.opens_at < now() or new.opens_at > now() + interval '7 days' then return new; end if;
  if tg_op = 'INSERT' and new.short_notice then
    perform notify_many('members', 'build_session', 'Short-notice build session',
      coalesce(new.title, 'Build') || ' — ' || to_char(new.opens_at at time zone 'America/Los_Angeles', 'Dy Mon DD, HH12:MI AM'),
      '/build');
  elsif tg_op = 'UPDATE' and new.cancelled and not old.cancelled then
    perform notify_many('members', 'build_session', 'Build session cancelled',
      coalesce(new.title, 'Build') || ' — ' || to_char(new.opens_at at time zone 'America/Los_Angeles', 'Dy Mon DD, HH12:MI AM'),
      '/build');
  end if;
  return new;
end $$;
drop trigger if exists notify_build_session on build_sessions;
create trigger notify_build_session after insert or update of cancelled on build_sessions
  for each row execute function trg_notify_build_session();

-- Accounts -----------------------------------------------------------------
create or replace function public.trg_notify_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notify_many('manage_accounts', 'account', 'New account awaiting approval',
      coalesce(new.display_name, 'New member'), '/admin/members/pending');
  elsif old.role = 'PENDING' and new.role <> 'PENDING' then
    perform notify(new.id, 'account', 'Your account was approved', 'Welcome to the Optix toolkit.', '/dashboard');
  elsif new.permissions is distinct from old.permissions then
    perform notify(new.id, 'account', 'Your permissions changed',
      coalesce(array_to_string(new.permissions, ', '), 'none'), '/profile');
  end if;
  return new;
end $$;
drop trigger if exists notify_profile on profiles;
create trigger notify_profile after insert or update of role, permissions on profiles
  for each row execute function trg_notify_profile();

-- ---------------------------------------------------------------------------
-- 3. SCOUTING
-- ---------------------------------------------------------------------------

create table if not exists scout_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete set null,
  season_id uuid references seasons(id) on delete set null,
  name text not null,
  event_code text,
  starts_on date,
  ends_on date,
  is_active boolean not null default false
);

create table if not exists scout_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references scout_events(id) on delete cascade,
  match_type text not null default 'qm' check (match_type in ('pm','qm','sf','f')),
  match_number int not null check (match_number > 0),
  red int[] not null default '{}',
  blue int[] not null default '{}',
  scheduled_at timestamptz,
  unique (event_id, match_type, match_number)
);

create table if not exists scout_assignments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references scout_matches(id) on delete cascade,
  station text not null check (station in ('red1','red2','red3','blue1','blue2','blue3')),
  scout_id uuid not null references profiles(id) on delete cascade,
  unique (match_id, station)
);
create index if not exists idx_scout_assignments_scout on scout_assignments(scout_id);

create table if not exists match_scouting (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references scout_events(id) on delete cascade,
  match_type text not null default 'qm',
  match_number int not null,
  team_number int not null check (team_number > 0),
  alliance text check (alliance in ('red','blue')),
  scout_id uuid not null references profiles(id) on delete cascade,
  data jsonb not null default '{}',
  notes text,
  unique (event_id, match_type, match_number, team_number, scout_id)
);
create index if not exists idx_match_scouting_team on match_scouting(event_id, team_number);

create table if not exists pit_scouting (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_id uuid not null references scout_events(id) on delete cascade,
  team_number int not null check (team_number > 0),
  scout_id uuid not null references profiles(id) on delete cascade,
  data jsonb not null default '{}',
  notes text,
  unique (event_id, team_number, scout_id)
);

alter table scout_events enable row level security;
alter table scout_matches enable row level security;
alter table scout_assignments enable row level security;
alter table match_scouting enable row level security;
alter table pit_scouting enable row level security;

drop policy if exists se_read on scout_events;
drop policy if exists se_write on scout_events;
create policy se_read on scout_events for select to authenticated using (is_member());
create policy se_write on scout_events for all to authenticated
  using (has_perm('manage_scouting')) with check (has_perm('manage_scouting'));

drop policy if exists sm_read on scout_matches;
drop policy if exists sm_write on scout_matches;
create policy sm_read on scout_matches for select to authenticated using (is_member());
create policy sm_write on scout_matches for all to authenticated
  using (has_perm('manage_scouting')) with check (has_perm('manage_scouting'));

drop policy if exists sa_read on scout_assignments;
drop policy if exists sa_write on scout_assignments;
create policy sa_read on scout_assignments for select to authenticated using (is_member());
create policy sa_write on scout_assignments for all to authenticated
  using (has_perm('manage_scouting')) with check (has_perm('manage_scouting'));

drop policy if exists ms_read on match_scouting;
drop policy if exists ms_insert on match_scouting;
drop policy if exists ms_update on match_scouting;
drop policy if exists ms_delete on match_scouting;
create policy ms_read on match_scouting for select to authenticated using (is_member());
create policy ms_insert on match_scouting for insert to authenticated with check (is_member() and scout_id = auth.uid());
create policy ms_update on match_scouting for update to authenticated
  using (scout_id = auth.uid() or has_perm('manage_scouting'))
  with check (scout_id = auth.uid() or has_perm('manage_scouting'));
create policy ms_delete on match_scouting for delete to authenticated
  using (scout_id = auth.uid() or has_perm('manage_scouting'));

drop policy if exists ps_read on pit_scouting;
drop policy if exists ps_insert on pit_scouting;
drop policy if exists ps_update on pit_scouting;
drop policy if exists ps_delete on pit_scouting;
create policy ps_read on pit_scouting for select to authenticated using (is_member());
create policy ps_insert on pit_scouting for insert to authenticated with check (is_member() and scout_id = auth.uid());
create policy ps_update on pit_scouting for update to authenticated
  using (scout_id = auth.uid() or has_perm('manage_scouting'))
  with check (scout_id = auth.uid() or has_perm('manage_scouting'));
create policy ps_delete on pit_scouting for delete to authenticated
  using (scout_id = auth.uid() or has_perm('manage_scouting'));

-- Only one active event at a time.
create or replace function public.trg_scout_single_active() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_active then
    update scout_events set is_active = false where id <> new.id and is_active;
  end if;
  return new;
end $$;
drop trigger if exists scout_single_active on scout_events;
create trigger scout_single_active after insert or update of is_active on scout_events
  for each row when (new.is_active) execute function trg_scout_single_active();

create or replace function public.trg_notify_scout_assignment() returns trigger
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  select sm.match_type, sm.match_number, se.name into m
  from scout_matches sm join scout_events se on se.id = sm.event_id where sm.id = new.match_id;
  perform notify(new.scout_id, 'scouting', 'Scouting assignment',
    m.name || ' · ' || upper(m.match_type) || ' ' || m.match_number || ' · ' || new.station, '/scouting');
  return new;
end $$;
drop trigger if exists notify_scout_assignment on scout_assignments;
create trigger notify_scout_assignment after insert on scout_assignments
  for each row execute function trg_notify_scout_assignment();

-- ---------------------------------------------------------------------------
-- 4. Hard-delete support for new FKs (see CLAUDE.md "Hard-delete model")
-- ---------------------------------------------------------------------------
do $$
declare def text;
begin
  def := pg_get_functiondef('public.owner_delete_member'::regproc);
  if position('match_scouting' in def) = 0 then
    def := replace(def, 'DELETE FROM notifications',
      'UPDATE scout_events SET created_by = NULL WHERE created_by = target_id;' || chr(10) || '  '
      || 'DELETE FROM scout_assignments WHERE scout_id = target_id;' || chr(10) || '  '
      || 'DELETE FROM match_scouting WHERE scout_id = target_id;' || chr(10) || '  '
      || 'DELETE FROM pit_scouting WHERE scout_id = target_id;' || chr(10) || '  '
      || 'DELETE FROM notifications');
    execute def;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Missing FKs (2026-10-28): task_assignees/task_reviewers.user_id had no FK,
-- so PostgREST joins to profiles (owner tasks calendar) failed with PGRST200.
-- NOT YET APPLIED to the live DB. The calendar now works without it (it joins
-- client-side); apply for referential integrity when convenient.
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'task_assignees_user_id_fkey') then
    alter table task_assignees add constraint task_assignees_user_id_fkey
      foreign key (user_id) references profiles(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'task_reviewers_user_id_fkey') then
    alter table task_reviewers add constraint task_reviewers_user_id_fkey
      foreign key (user_id) references profiles(id) on delete cascade;
  end if;
end $$;
notify pgrst, 'reload schema';
