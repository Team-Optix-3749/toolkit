-- ============================================================
-- Optix Toolkit — Supabase database schema (verified)
-- Supabase project ref: exvhzdpjuorlzhulnyvl
-- Last updated: 2026-09-30
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS (used by RLS policies)
-- ============================================================
create or replace function is_member() returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role not in ('PENDING')
    and account_status = 'active'
  );
$$ language sql security definer stable;

create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('LEADERSHIP', 'OFFICER', 'OWNER')
    and account_status = 'active'
  );
$$ language sql security definer stable;

create or replace function is_leadership() returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('LEADERSHIP', 'OFFICER', 'OWNER')
    and account_status = 'active'
  );
$$ language sql security definer stable;

create or replace function is_owner() returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role = 'OWNER'
    and account_status = 'active'
  );
$$ language sql security definer stable;

create or replace function has_perm(perm text) returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and (
      role in ('OFFICER', 'OWNER')
      or perm = any(permissions)
    )
    and account_status = 'active'
  );
$$ language sql security definer stable;

-- ============================================================
-- SEASONS
-- ============================================================
create table seasons (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  name            text not null unique,
  is_current      boolean not null default false,
  outreach_target numeric not null default 0,
  build_target    numeric not null default 0
);

create unique index idx_seasons_current on seasons (is_current) where is_current = true;

alter table seasons enable row level security;
create policy seasons_read on seasons for select to authenticated using (true);
create policy seasons_write on seasons for all to authenticated using (is_admin()) with check (is_admin());

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table profiles (
  id             uuid primary key,  -- references auth.users(id)
  created_at     timestamptz not null default now(),
  display_name   text,
  grade          text,
  department     text,
  avatar_url     text,
  bio            text,
  role           text not null default 'member'
                   check (role in ('PENDING','MEMBER','LEADERSHIP','OFFICER','OWNER')),
  hours_public   boolean not null default false,
  special_perms  text[] not null default '{}',
  permissions    text[] not null default '{}',
  account_status text not null default 'active'
                   check (account_status in ('active','deactivated','rejected'))
);
-- Valid permissions: manage_accounts, manage_invitations, manage_tasks,
-- manage_groups, manage_seasons, manage_outreach_events, manage_outreach_attendance,
-- manage_build_hours, manage_opis, export_records

create trigger guard_profile_privileges_trg
  before update on profiles
  for each row execute function guard_profile_privileges();

alter table profiles enable row level security;
create policy profiles_select on profiles for select to authenticated using (true);
create policy profiles_insert on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles for update to authenticated
  using ((id = auth.uid()) or is_admin())
  with check ((id = auth.uid()) or is_admin());

-- ============================================================
-- INVITATIONS (reusable invite links)
-- ============================================================
create table invitations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid,
  code       text not null unique default encode(gen_random_bytes(16), 'hex'),
  expires_at timestamptz not null,
  revoked    boolean not null default false
);

create index idx_invitations_code on invitations(code);

alter table invitations enable row level security;
create policy inv_read on invitations for select to authenticated using (has_perm('manage_invitations'));
create policy inv_write on invitations for all to authenticated using (has_perm('manage_invitations')) with check (has_perm('manage_invitations'));
create policy inv_public_read on invitations for select to anon using (not revoked and expires_at > now());

-- ============================================================
-- GROUPS (flat member groups)
-- ============================================================
create table groups (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null unique
);

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id  uuid not null,
  primary key (group_id, user_id)
);

alter table groups enable row level security;
create policy groups_read on groups for select to authenticated using (is_member());
create policy groups_write on groups for all to authenticated using (has_perm('manage_groups')) with check (has_perm('manage_groups'));

alter table group_members enable row level security;
create policy gm_read on group_members for select to authenticated using (is_member());
create policy gm_write on group_members for all to authenticated using (has_perm('manage_groups')) with check (has_perm('manage_groups'));

-- ============================================================
-- TASK GROUPS (organizational categories with color chip)
-- ============================================================
create table task_groups (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  color      text not null default '#6b7280'
);

alter table task_groups enable row level security;
create policy tg_read on task_groups for select to authenticated using (is_member());
create policy tg_write on task_groups for all to authenticated using (has_perm('manage_tasks')) with check (has_perm('manage_tasks'));

-- ============================================================
-- TASKS
-- ============================================================
create table tasks (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid,
  title           text not null,
  description     text,
  status          text not null default 'assigned'
                    check (status in ('assigned','in_progress','submitted','changes_requested','resubmitted','completed','cancelled')),
  requires_review boolean not null default false,
  deadline        date,
  group_id        uuid references task_groups(id) on delete set null,
  season_id       uuid references seasons(id) on delete set null
);

create index idx_tasks_status on tasks(status);
create index idx_tasks_deadline on tasks(deadline);

alter table tasks enable row level security;
create policy tasks_select on tasks for select to authenticated
  using (
    has_perm('manage_tasks')
    or exists (select 1 from task_assignees ta where ta.task_id = id and ta.user_id = auth.uid())
    or exists (select 1 from task_reviewers tr where tr.task_id = id and tr.user_id = auth.uid())
  );
create policy tasks_insert on tasks for insert to authenticated with check (has_perm('manage_tasks'));
create policy tasks_update on tasks for update to authenticated
  using (
    has_perm('manage_tasks')
    or exists (select 1 from task_assignees ta where ta.task_id = id and ta.user_id = auth.uid())
    or exists (select 1 from task_reviewers tr where tr.task_id = id and tr.user_id = auth.uid())
  );
create policy tasks_delete on tasks for delete to authenticated using (has_perm('manage_tasks'));

-- ============================================================
-- TASK ASSIGNEES (many-to-many)
-- ============================================================
create table task_assignees (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null,
  primary key (task_id, user_id)
);

alter table task_assignees enable row level security;
create policy ta_select on task_assignees for select to authenticated
  using (
    has_perm('manage_tasks')
    or user_id = auth.uid()
    or exists (select 1 from task_assignees ta2 where ta2.task_id = task_id and ta2.user_id = auth.uid())
    or exists (select 1 from task_reviewers tr where tr.task_id = task_id and tr.user_id = auth.uid())
  );
create policy ta_write on task_assignees for all to authenticated using (has_perm('manage_tasks')) with check (has_perm('manage_tasks'));

-- ============================================================
-- TASK REVIEWERS (selected reviewers for review-required tasks)
-- ============================================================
create table task_reviewers (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null,
  primary key (task_id, user_id)
);

alter table task_reviewers enable row level security;
create policy tr_select on task_reviewers for select to authenticated
  using (
    has_perm('manage_tasks')
    or user_id = auth.uid()
    or exists (select 1 from task_assignees ta where ta.task_id = task_id and ta.user_id = auth.uid())
  );
create policy tr_write on task_reviewers for all to authenticated using (has_perm('manage_tasks')) with check (has_perm('manage_tasks'));

-- ============================================================
-- TASK EVIDENCE (note, link, or picture per task)
-- ============================================================
create table task_evidence (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid,
  kind       text not null check (kind in ('note','link','picture')),
  content    text not null,
  file_url   text
);

alter table task_evidence enable row level security;
create policy te_select on task_evidence for select to authenticated
  using (
    has_perm('manage_tasks')
    or exists (select 1 from task_assignees ta where ta.task_id = task_id and ta.user_id = auth.uid())
    or exists (select 1 from task_reviewers tr where tr.task_id = task_id and tr.user_id = auth.uid())
  );
create policy te_insert on task_evidence for insert to authenticated
  with check (
    user_id = auth.uid() and (
      has_perm('manage_tasks')
      or exists (select 1 from task_assignees ta where ta.task_id = task_id and ta.user_id = auth.uid())
    )
  );

-- ============================================================
-- TASK HISTORY (status transitions and review feedback)
-- ============================================================
create table task_history (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  task_id     uuid not null references tasks(id) on delete cascade,
  user_id     uuid,
  from_status text,
  to_status   text not null,
  feedback    text
);

alter table task_history enable row level security;
create policy th_select on task_history for select to authenticated
  using (
    has_perm('manage_tasks')
    or exists (select 1 from task_assignees ta where ta.task_id = task_id and ta.user_id = auth.uid())
    or exists (select 1 from task_reviewers tr where tr.task_id = task_id and tr.user_id = auth.uid())
  );
create policy th_insert on task_history for insert to authenticated with check (true);

-- ============================================================
-- MEMBERS (legacy / standalone member list)
-- ============================================================
create table members (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name       text not null,
  role       text,
  grade      text,
  active     boolean default true
);

-- ============================================================
-- LOGIN EVENTS (audit trail)
-- ============================================================
create table login_events (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id    uuid,
  email      text,
  app        text
);

-- ============================================================
-- EVENTS (generic events, legacy)
-- ============================================================
create table events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  created_by  uuid,
  title       text not null,
  description text,
  type        text not null default 'meeting',
  location    text,
  start_at    timestamptz not null default now(),
  end_at      timestamptz
);

-- ============================================================
-- EVENT CHECKINS (checkins for generic events, legacy)
-- ============================================================
create table event_checkins (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  event_id     uuid references events(id) on delete cascade,
  user_id      uuid,
  display_name text,
  location     text,
  lat          double precision,
  lng          double precision,
  note         text
);

-- ============================================================
-- HOURS LOG (manual hours logging, legacy)
-- ============================================================
create table hours_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  created_by  uuid,
  member_name text not null,
  date        date not null default current_date,
  type        text not null default 'build',
  hours       numeric not null,
  activity    text,
  notes       text,
  reason      text,
  source      text default 'self',
  awarded_by  uuid
);

-- ============================================================
-- BUILD ZONES (geofenced areas for check-in verification)
-- ============================================================
create table build_zones (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null,
  description  text,
  gps_lat      double precision,
  gps_lng      double precision,
  gps_radius_m integer default 100,
  qr_token     text,
  active       boolean not null default true
);

-- ============================================================
-- BUILD SCHEDULE (sessions, optionally recurring via rrule)
-- ============================================================
create table build_schedule (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  created_by   uuid,
  title        text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  zone_id      uuid references build_zones(id) on delete set null,
  season_id    uuid references seasons(id) on delete set null,
  rrule        text,
  is_recurring boolean not null default false,
  short_notice boolean not null default false
);

create index idx_build_schedule_starts on build_schedule(starts_at);

-- ============================================================
-- BUILD CHECK-INS (GPS or QR verified attendance)
-- ============================================================
create table build_checkins (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  session_id     uuid references build_schedule(id) on delete cascade,
  zone_id        uuid references build_zones(id) on delete set null,
  user_id        uuid,
  method         text not null default 'gps',
  checked_in_at  timestamptz not null default now(),
  checked_out_at timestamptz,
  minutes_logged integer,
  lat            double precision,
  lng            double precision
);

create index idx_build_checkins_user on build_checkins(user_id);

-- ============================================================
-- OUTREACH EVENTS
-- ============================================================
create table outreach_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  title       text not null,
  description text,
  location    text,
  lat         double precision,
  lng         double precision,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  season_id   uuid references seasons(id) on delete set null,
  qr_token    text
);

create index idx_outreach_starts on outreach_events(starts_at);

-- ============================================================
-- OUTREACH CHECK-INS
-- ============================================================
create table outreach_checkins (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  event_id       uuid references outreach_events(id) on delete cascade,
  user_id        uuid,
  method         text not null default 'gps',
  checked_in_at  timestamptz not null default now(),
  minutes_logged integer,
  lat            double precision,
  lng            double precision
);

create index idx_outreach_checkins_user on outreach_checkins(user_id);

-- ============================================================
-- INDIVIDUAL OUTREACH (self-reported, admin-reviewed)
-- ============================================================
create table individual_outreach (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid,
  full_name       text not null,
  department      text,
  event_name      text not null,
  what_you_did    text not null,
  impact          text not null,
  hours           numeric not null default 0,
  event_date      date not null,
  proof_urls      text[] not null default '{}',
  people_impacted integer,
  status          text not null default 'PENDING'
                    check (status in ('PENDING','APPROVED','REJECTED')),
  credited_hours  numeric,
  reviewer_id     uuid,
  decided_at      timestamptz
);

create index idx_individual_outreach_user on individual_outreach(user_id);
create index idx_individual_outreach_status on individual_outreach(status);

-- ============================================================
-- OPI INITIATIVES (Outreach Project Initiatives)
-- ============================================================
create table opi_initiatives (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  user_id         uuid,
  title           text not null,
  description     text,
  doc_url         text,
  status          text not null default 'SUBMITTED'
                    check (status in ('SUBMITTED','CHANGES_REQUESTED','RESUBMITTED','APPROVED','REJECTED','CONVERTED')),
  reviewer_id     uuid,
  linked_event_id uuid references outreach_events(id) on delete set null
);

create index idx_opi_status on opi_initiatives(status);

-- ============================================================
-- OPI COMMENTS
-- ============================================================
create table opi_comments (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  initiative_id uuid references opi_initiatives(id) on delete cascade,
  user_id       uuid,
  body          text not null
);

-- ============================================================
-- PURCHASES & REIMBURSEMENTS
-- ============================================================
create table purchases (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid,
  kind        text not null default 'reimbursement',
  description text not null,
  amount      numeric not null default 0,
  receipt_url text,
  status      text not null default 'PENDING'
                check (status in ('PENDING','APPROVED','REJECTED')),
  reviewer_id uuid,
  decided_at  timestamptz
);

create index idx_purchases_status on purchases(status);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid,
  type       text not null default 'general',
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz
);

create index idx_notifications_user on notifications(user_id);

-- ============================================================
-- NOTIFICATION PREFERENCES (per-user, JSONB prefs blob)
-- ============================================================
create table notification_preferences (
  user_id    uuid primary key,
  prefs      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- EMAIL TEMPLATES (admin-managed)
-- ============================================================
create table email_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  subject    text,
  body       text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- ORG SETTINGS (key-value config, owner-only)
-- ============================================================
create table org_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- VIEWS
-- ============================================================

-- hours_summary: computed from build_checkins + outreach_checkins + individual_outreach
create or replace view hours_summary as
select
  p.id as user_id,
  p.display_name,
  round(coalesce(b.minutes, 0)::numeric / 60.0, 1) as build_hours,
  round((coalesce(o.minutes, 0)::numeric + least(coalesce(io.hours, 0), 6) * 60) / 60.0, 1) as outreach_hours,
  round(((coalesce(b.minutes, 0) + coalesce(o.minutes, 0))::numeric + least(coalesce(io.hours, 0), 6) * 60) / 60.0, 1) as total_hours
from profiles p
left join (
  select user_id, sum(coalesce(minutes_logged, 0)) as minutes
  from build_checkins group by user_id
) b on b.user_id = p.id
left join (
  select user_id, sum(coalesce(minutes_logged, 0)) as minutes
  from outreach_checkins group by user_id
) o on o.user_id = p.id
left join (
  select user_id, sum(coalesce(credited_hours, hours, 0)) as hours
  from individual_outreach where status = 'APPROVED' group by user_id
) io on io.user_id = p.id;

-- public_rankings: leaderboard from hours_log (legacy)
create or replace view public_rankings as
select
  p.id,
  p.display_name,
  p.avatar_url,
  coalesce(sum(h.hours), 0) as total_hours,
  coalesce(sum(h.hours) filter (where h.type = 'build'), 0) as build_hours,
  coalesce(sum(h.hours) filter (where h.type = 'outreach'), 0) as outreach_hours
from profiles p
left join hours_log h on h.created_by = p.id
where p.hours_public = true and p.role <> 'leadership'
group by p.id, p.display_name, p.avatar_url
order by coalesce(sum(h.hours), 0) desc;

-- ============================================================
-- RLS POLICIES (for tables not shown inline above)
-- ============================================================

-- build_zones
alter table build_zones enable row level security;
create policy zones_read on build_zones for select to authenticated using (is_member());
create policy zones_write on build_zones for all to authenticated using (is_admin()) with check (is_admin());

-- build_schedule
alter table build_schedule enable row level security;
create policy sched_read on build_schedule for select to authenticated using (is_member());
create policy sched_write on build_schedule for all to authenticated using (is_admin()) with check (is_admin());

-- build_checkins
alter table build_checkins enable row level security;
create policy bci_read on build_checkins for select to authenticated using ((user_id = auth.uid()) or is_admin());
create policy bci_insert on build_checkins for insert to authenticated with check (user_id = auth.uid());
create policy bci_update on build_checkins for update to authenticated
  using ((user_id = auth.uid()) or is_admin())
  with check ((user_id = auth.uid()) or is_admin());
create policy bci_delete on build_checkins for delete to authenticated using ((user_id = auth.uid()) or is_admin());

-- outreach_events
alter table outreach_events enable row level security;
create policy oe_read on outreach_events for select to authenticated using (is_member());
create policy oe_write on outreach_events for all to authenticated using (is_admin()) with check (is_admin());

-- outreach_checkins
alter table outreach_checkins enable row level security;
create policy oci_read on outreach_checkins for select to authenticated using ((user_id = auth.uid()) or is_admin());
create policy oci_insert on outreach_checkins for insert to authenticated with check (user_id = auth.uid());
create policy oci_update on outreach_checkins for update to authenticated
  using ((user_id = auth.uid()) or is_admin())
  with check ((user_id = auth.uid()) or is_admin());

-- individual_outreach
alter table individual_outreach enable row level security;
create policy io_read on individual_outreach for select to authenticated using ((user_id = auth.uid()) or is_admin());
create policy io_insert on individual_outreach for insert to authenticated with check (user_id = auth.uid());
create policy io_update on individual_outreach for update to authenticated
  using (((user_id = auth.uid()) and (status = 'PENDING')) or is_admin())
  with check ((user_id = auth.uid()) or is_admin());
create policy io_delete on individual_outreach for delete to authenticated
  using (((user_id = auth.uid()) and (status = 'PENDING')) or is_admin());

-- opi_initiatives
alter table opi_initiatives enable row level security;
create policy opi_read on opi_initiatives for select to authenticated using ((user_id = auth.uid()) or has_perm('manage_opis'));
create policy opi_insert on opi_initiatives for insert to authenticated with check (user_id = auth.uid());
create policy opi_update on opi_initiatives for update to authenticated
  using (((user_id = auth.uid()) and (status in ('SUBMITTED','CHANGES_REQUESTED'))) or has_perm('manage_opis'))
  with check ((user_id = auth.uid()) or has_perm('manage_opis'));

-- opi_comments
alter table opi_comments enable row level security;
create policy opic_read on opi_comments for select to authenticated
  using (has_perm('manage_opis') or exists (select 1 from opi_initiatives i where i.id = initiative_id and i.user_id = auth.uid()));
create policy opic_insert on opi_comments for insert to authenticated
  with check ((user_id = auth.uid()) and (has_perm('manage_opis') or exists (select 1 from opi_initiatives i where i.id = initiative_id and i.user_id = auth.uid())));

-- purchases
alter table purchases enable row level security;
create policy pur_read on purchases for select to authenticated using ((user_id = auth.uid()) or is_admin());
create policy pur_insert on purchases for insert to authenticated with check (user_id = auth.uid());
create policy pur_update on purchases for update to authenticated
  using (((user_id = auth.uid()) and (status = 'PENDING')) or is_admin())
  with check ((user_id = auth.uid()) or is_admin());

-- notifications
alter table notifications enable row level security;
create policy notif_read on notifications for select to authenticated using ((user_id = auth.uid()) or is_admin());
create policy notif_insert on notifications for insert to authenticated with check (is_admin() or (user_id = auth.uid()));
create policy notif_update on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- notification_preferences
alter table notification_preferences enable row level security;
create policy np_all on notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- email_templates
alter table email_templates enable row level security;
create policy email_templates_all on email_templates for all to authenticated using (is_owner()) with check (is_owner());

-- org_settings
alter table org_settings enable row level security;
create policy org_settings_read on org_settings for select to authenticated using (is_admin());
create policy org_settings_write on org_settings for all to authenticated using (is_owner()) with check (is_owner());

-- members (legacy)
alter table members enable row level security;
create policy auth_all_members on members for all to authenticated using (true) with check (true);

-- login_events
alter table login_events enable row level security;
create policy auth_all_login_events on login_events for all to authenticated using (true) with check (true);

-- events (legacy)
alter table events enable row level security;
create policy events_select on events for select to authenticated using (true);
create policy events_write on events for all to authenticated using (is_leadership()) with check (is_leadership());

-- event_checkins (legacy)
alter table event_checkins enable row level security;
create policy checkins_select on event_checkins for select to authenticated using ((user_id = auth.uid()) or is_leadership());
create policy checkins_insert on event_checkins for insert to authenticated with check (user_id = auth.uid());
create policy checkins_delete on event_checkins for delete to authenticated using ((user_id = auth.uid()) or is_leadership());

-- hours_log (legacy)
alter table hours_log enable row level security;
create policy hours_select on hours_log for select to authenticated using ((created_by = auth.uid()) or is_leadership());
create policy hours_insert on hours_log for insert to authenticated with check ((created_by = auth.uid()) or is_leadership());
create policy hours_update on hours_log for update to authenticated
  using ((created_by = auth.uid()) or is_leadership())
  with check ((created_by = auth.uid()) or is_leadership());
create policy hours_delete on hours_log for delete to authenticated using ((created_by = auth.uid()) or is_leadership());

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- outreach-proofs  (public  — individual outreach proof images/videos)
-- receipts         (public  — purchase receipt uploads)
-- task-evidence    (private — task evidence pictures, 10MB limit)
