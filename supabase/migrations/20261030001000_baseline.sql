-- Authoritative current route-model baseline. Platform auth/storage schemas are prerequisites.
-- upgrade_sources runs first; import_sources preserves and imports validated legacy data afterward.
-- Missing historical associations stay nullable until explicit operator mapping and domain cutover.
-- FK additions on pre-existing tables are NOT VALID until imported associations are checked.
-- Required parent season/location/end, task ownership, unique President/account classification,
-- interval exclusions, and workflow transition enforcement belong to mapped/domain cutovers.
create extension if not exists pgcrypto;
create schema if not exists toolkit_private;
revoke all on schema toolkit_private from public, anon, authenticated;
revoke create on schema public from public, anon, authenticated;
set search_path = public, extensions, pg_temp;


create table if not exists public.profiles (
  id             uuid primary key,  
  created_at     timestamptz not null default now(),
  display_name   text,
  grade          text,
  department     text,
  avatar_url     text,
  bio            text,
  role           text not null default 'PENDING'
                   check (role in ('PENDING','MEMBER','LEADERSHIP','OFFICER','OWNER')),
  hours_public   boolean not null default false,
  special_perms  text[] not null default '{}',
  permissions    text[] not null default '{}',
  account_status text not null default 'active'
                   check (account_status in ('active','deactivated','rejected'))
  , displayed_role text
  , account_type text check (account_type in ('member','mentor'))
);

alter table public.profiles add column if not exists id             uuid primary key;

alter table public.profiles add column if not exists created_at     timestamptz not null default now();

alter table public.profiles add column if not exists display_name   text;

alter table public.profiles add column if not exists grade          text;

alter table public.profiles add column if not exists department     text;

alter table public.profiles add column if not exists avatar_url     text;

alter table public.profiles add column if not exists bio            text;

alter table public.profiles add column if not exists role           text not null default 'PENDING'
                   check (role in ('PENDING','MEMBER','LEADERSHIP','OFFICER','OWNER'));

alter table public.profiles add column if not exists hours_public   boolean not null default false;

alter table public.profiles add column if not exists special_perms  text[] not null default '{}';

alter table public.profiles add column if not exists permissions    text[] not null default '{}';

alter table public.profiles add column if not exists account_status text not null default 'active'
                   check (account_status in ('active','deactivated','rejected'));

alter table public.profiles add column if not exists displayed_role text;

alter table public.profiles add column if not exists account_type text check (account_type in ('member','mentor'));



create table if not exists public.seasons (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  name            text not null unique,
  is_current      boolean not null default false,
  outreach_target numeric not null default 0,
  build_target    numeric not null default 0
  , individual_outreach_cap_minutes numeric not null default 360 check (individual_outreach_cap_minutes >= 0)
);

alter table public.seasons add column if not exists id              uuid primary key default gen_random_uuid();

alter table public.seasons add column if not exists created_at      timestamptz not null default now();

alter table public.seasons add column if not exists name            text unique;

alter table public.seasons add column if not exists is_current      boolean not null default false;

alter table public.seasons add column if not exists outreach_target numeric not null default 0;

alter table public.seasons add column if not exists build_target    numeric not null default 0;

alter table public.seasons add column if not exists individual_outreach_cap_minutes numeric not null default 360 check (individual_outreach_cap_minutes >= 0);



create table if not exists public.invitations (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  code       text not null unique default encode(gen_random_bytes(16), 'hex'),
  expires_at timestamptz not null,
  revoked    boolean not null default false
);

alter table public.invitations add column if not exists id         uuid primary key default gen_random_uuid();

alter table public.invitations add column if not exists created_at timestamptz not null default now();

alter table public.invitations add column if not exists created_by uuid references profiles(id);

alter table public.invitations add column if not exists code       text not null unique default encode(gen_random_bytes(16), 'hex');

alter table public.invitations add column if not exists expires_at timestamptz;

alter table public.invitations add column if not exists revoked    boolean not null default false;



create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null unique
);

alter table public.groups add column if not exists id         uuid primary key default gen_random_uuid();

alter table public.groups add column if not exists created_at timestamptz not null default now();

alter table public.groups add column if not exists name       text unique;



create table if not exists public.group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id  uuid not null references profiles(id),
  primary key (group_id, user_id)
);

alter table public.group_members add column if not exists group_id uuid references groups(id) on delete cascade;

alter table public.group_members add column if not exists user_id  uuid references profiles(id);



create table if not exists public.task_groups (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  color      text not null default '#6b7280'
);

alter table public.task_groups add column if not exists id         uuid primary key default gen_random_uuid();

alter table public.task_groups add column if not exists created_at timestamptz not null default now();

alter table public.task_groups add column if not exists name       text;

alter table public.task_groups add column if not exists color      text not null default '#6b7280';



create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references profiles(id),
  title           text not null,
  description     text,
  status          text not null default 'assigned'
                    check (status in ('assigned','in_progress','submitted','changes_requested','resubmitted','completed','cancelled')),
  requires_review boolean not null default false,
  deadline        date,
  group_id        uuid references task_groups(id) on delete set null,
  season_id       uuid references seasons(id) on delete set null
  , owner_group_id uuid references groups(id) on delete restrict
);

alter table public.tasks add column if not exists id              uuid primary key default gen_random_uuid();

alter table public.tasks add column if not exists created_at      timestamptz not null default now();

alter table public.tasks add column if not exists updated_at      timestamptz not null default now();

alter table public.tasks add column if not exists created_by      uuid references profiles(id);

alter table public.tasks add column if not exists title           text;

alter table public.tasks add column if not exists description     text;

alter table public.tasks add column if not exists status          text not null default 'assigned'
                    check (status in ('assigned','in_progress','submitted','changes_requested','resubmitted','completed','cancelled'));

alter table public.tasks add column if not exists requires_review boolean not null default false;

alter table public.tasks add column if not exists deadline        date;

alter table public.tasks add column if not exists group_id        uuid references task_groups(id) on delete set null;

alter table public.tasks add column if not exists season_id       uuid references seasons(id) on delete set null;

alter table public.tasks add column if not exists owner_group_id uuid references groups(id) on delete restrict;



create table if not exists public.task_assignees (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id),
  primary key (task_id, user_id)
);

alter table public.task_assignees add column if not exists task_id uuid references tasks(id) on delete cascade;

alter table public.task_assignees add column if not exists user_id uuid references profiles(id);



create table if not exists public.task_reviewers (
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id),
  primary key (task_id, user_id)
);

alter table public.task_reviewers add column if not exists task_id uuid references tasks(id) on delete cascade;

alter table public.task_reviewers add column if not exists user_id uuid references profiles(id);



create table if not exists public.task_evidence (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  task_id    uuid not null references tasks(id) on delete cascade,
  user_id    uuid references profiles(id),
  kind       text not null check (kind in ('note','link','picture')),
  content    text not null,
  file_url   text
);

alter table public.task_evidence add column if not exists id         uuid primary key default gen_random_uuid();

alter table public.task_evidence add column if not exists created_at timestamptz not null default now();

alter table public.task_evidence add column if not exists task_id    uuid references tasks(id) on delete cascade;

alter table public.task_evidence add column if not exists user_id    uuid references profiles(id);

alter table public.task_evidence add column if not exists kind       text check (kind in ('note','link','picture'));

alter table public.task_evidence add column if not exists content    text;

alter table public.task_evidence add column if not exists file_url   text;



create table if not exists public.task_history (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  task_id     uuid not null references tasks(id) on delete cascade,
  user_id     uuid references profiles(id),
  from_status text,
  to_status   text not null,
  feedback    text
);

alter table public.task_history add column if not exists id          uuid primary key default gen_random_uuid();

alter table public.task_history add column if not exists created_at  timestamptz not null default now();

alter table public.task_history add column if not exists task_id     uuid references tasks(id) on delete cascade;

alter table public.task_history add column if not exists user_id     uuid references profiles(id);

alter table public.task_history add column if not exists from_status text;

alter table public.task_history add column if not exists to_status   text;

alter table public.task_history add column if not exists feedback    text;



create table if not exists public.login_events (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id    uuid,
  email      text,
  app        text
);

alter table public.login_events add column if not exists id         uuid primary key default gen_random_uuid();

alter table public.login_events add column if not exists created_at timestamptz default now();

alter table public.login_events add column if not exists user_id    uuid;

alter table public.login_events add column if not exists email      text;

alter table public.login_events add column if not exists app        text;



create table if not exists public.build_locations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  description text,
  latitude double precision,
  longitude double precision,
  radius_m double precision,
  gps_lat double precision,
  gps_lng double precision,
  gps_radius_m double precision
);

alter table public.build_locations add column if not exists id uuid primary key default gen_random_uuid();

alter table public.build_locations add column if not exists created_at timestamptz not null default now();

alter table public.build_locations add column if not exists name text;

alter table public.build_locations add column if not exists description text;

alter table public.build_locations add column if not exists latitude double precision;

alter table public.build_locations add column if not exists longitude double precision;

alter table public.build_locations add column if not exists radius_m double precision;

alter table public.build_locations add column if not exists gps_lat double precision;

alter table public.build_locations add column if not exists gps_lng double precision;

alter table public.build_locations add column if not exists gps_radius_m double precision;



create table if not exists public.build_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  title text not null,
  location_id uuid references build_locations(id),
  season_id uuid references seasons(id),
  opens_at timestamptz not null,
  closes_at timestamptz,
  cancelled boolean not null default false,
  rrule text,
  is_recurring boolean not null default false,
  short_notice boolean not null default false
);

alter table public.build_sessions add column if not exists id uuid primary key default gen_random_uuid();

alter table public.build_sessions add column if not exists created_at timestamptz not null default now();

alter table public.build_sessions add column if not exists created_by uuid references profiles(id);

alter table public.build_sessions add column if not exists title text;

alter table public.build_sessions add column if not exists location_id uuid references build_locations(id);

alter table public.build_sessions add column if not exists season_id uuid references seasons(id);

alter table public.build_sessions add column if not exists opens_at timestamptz;

alter table public.build_sessions add column if not exists closes_at timestamptz;

alter table public.build_sessions add column if not exists cancelled boolean not null default false;

alter table public.build_sessions add column if not exists rrule text;

alter table public.build_sessions add column if not exists is_recurring boolean not null default false;

alter table public.build_sessions add column if not exists short_notice boolean not null default false;



create table if not exists public.build_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid references build_sessions(id),
  member_id uuid not null references profiles(id),
  check_in timestamptz not null default now(),
  check_out timestamptz,
  reserved_until timestamptz,
  checkout_method text,
  automatically_closed boolean not null default false,
  credit_override boolean,
  credit_enabled boolean not null default true,
  credited_minutes numeric,
  credit_interval tstzrange
);

alter table public.build_records add column if not exists id uuid primary key default gen_random_uuid();

alter table public.build_records add column if not exists created_at timestamptz not null default now();

alter table public.build_records add column if not exists session_id uuid references build_sessions(id);

alter table public.build_records add column if not exists member_id uuid references profiles(id);

alter table public.build_records add column if not exists check_in timestamptz not null default now();

alter table public.build_records add column if not exists check_out timestamptz;

alter table public.build_records add column if not exists reserved_until timestamptz;

alter table public.build_records add column if not exists checkout_method text;

alter table public.build_records add column if not exists automatically_closed boolean not null default false;

alter table public.build_records add column if not exists credit_override boolean;

alter table public.build_records add column if not exists credit_enabled boolean not null default true;

alter table public.build_records add column if not exists credited_minutes numeric;

alter table public.build_records add column if not exists credit_interval tstzrange;



create table if not exists public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  title text not null,
  description text,
  location text,
  latitude double precision,
  longitude double precision,
  starts_at timestamptz not null,
  ends_at timestamptz,
  season_id uuid references seasons(id),
  cancelled boolean not null default false
);

alter table public.outreach_events add column if not exists id uuid primary key default gen_random_uuid();

alter table public.outreach_events add column if not exists created_at timestamptz not null default now();

alter table public.outreach_events add column if not exists created_by uuid references profiles(id);

alter table public.outreach_events add column if not exists title text;

alter table public.outreach_events add column if not exists description text;

alter table public.outreach_events add column if not exists location text;

alter table public.outreach_events add column if not exists latitude double precision;

alter table public.outreach_events add column if not exists longitude double precision;

alter table public.outreach_events add column if not exists starts_at timestamptz;

alter table public.outreach_events add column if not exists ends_at timestamptz;

alter table public.outreach_events add column if not exists season_id uuid references seasons(id);

alter table public.outreach_events add column if not exists cancelled boolean not null default false;



create table if not exists public.outreach_leads (
  event_id uuid not null references outreach_events(id),
  member_id uuid not null references profiles(id),
  primary key (event_id,
  member_id)
);

alter table public.outreach_leads add column if not exists event_id uuid references outreach_events(id);

alter table public.outreach_leads add column if not exists member_id uuid references profiles(id);



create table if not exists public.outreach_rsvps (
  event_id uuid not null references outreach_events(id),
  member_id uuid not null references profiles(id),
  planned boolean not null default true,
  primary key (event_id,
  member_id)
);

alter table public.outreach_rsvps add column if not exists event_id uuid references outreach_events(id);

alter table public.outreach_rsvps add column if not exists member_id uuid references profiles(id);

alter table public.outreach_rsvps add column if not exists planned boolean not null default true;



create table if not exists public.outreach_attendance (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_id uuid references outreach_events(id),
  member_id uuid not null references profiles(id),
  arrival timestamptz not null default now(),
  departure timestamptz,
  credit_enabled boolean not null default true,
  credited_minutes numeric,
  credit_interval tstzrange,
  unique (event_id,
  member_id)
);

alter table public.outreach_attendance add column if not exists id uuid primary key default gen_random_uuid();

alter table public.outreach_attendance add column if not exists created_at timestamptz not null default now();

alter table public.outreach_attendance add column if not exists event_id uuid references outreach_events(id);

alter table public.outreach_attendance add column if not exists member_id uuid references profiles(id);

alter table public.outreach_attendance add column if not exists arrival timestamptz not null default now();

alter table public.outreach_attendance add column if not exists departure timestamptz;

alter table public.outreach_attendance add column if not exists credit_enabled boolean not null default true;

alter table public.outreach_attendance add column if not exists credited_minutes numeric;

alter table public.outreach_attendance add column if not exists credit_interval tstzrange;



create table if not exists public.opis (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  submitter_id uuid not null references profiles(id),
  title text not null,
  summary text,
  document_url text,
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED','CHANGES_REQUESTED','RESUBMITTED','APPROVED','REJECTED','CONVERTED')),
  event_id uuid references outreach_events(id),
  season_id uuid references seasons(id)
);

alter table public.opis add column if not exists id uuid primary key default gen_random_uuid();

alter table public.opis add column if not exists created_at timestamptz not null default now();

alter table public.opis add column if not exists submitter_id uuid references profiles(id);

alter table public.opis add column if not exists title text;

alter table public.opis add column if not exists summary text;

alter table public.opis add column if not exists document_url text;

alter table public.opis add column if not exists status text not null default 'SUBMITTED' check (status in ('SUBMITTED','CHANGES_REQUESTED','RESUBMITTED','APPROVED','REJECTED','CONVERTED'));

alter table public.opis add column if not exists event_id uuid references outreach_events(id);

alter table public.opis add column if not exists season_id uuid references seasons(id);



create table if not exists public.opi_versions (
  id uuid primary key default gen_random_uuid(),
  opi_id uuid not null references opis(id),
  title text not null,
  summary text,
  document_url text,
  submitted_at timestamptz not null default now()
);

alter table public.opi_versions add column if not exists id uuid primary key default gen_random_uuid();

alter table public.opi_versions add column if not exists opi_id uuid references opis(id);

alter table public.opi_versions add column if not exists title text;

alter table public.opi_versions add column if not exists summary text;

alter table public.opi_versions add column if not exists document_url text;

alter table public.opi_versions add column if not exists submitted_at timestamptz not null default now();



create table if not exists public.opi_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  opi_id uuid not null references opis(id),
  user_id uuid references profiles(id),
  feedback text not null,
  decision text
);

alter table public.opi_feedback add column if not exists id uuid primary key default gen_random_uuid();

alter table public.opi_feedback add column if not exists created_at timestamptz not null default now();

alter table public.opi_feedback add column if not exists opi_id uuid references opis(id);

alter table public.opi_feedback add column if not exists user_id uuid references profiles(id);

alter table public.opi_feedback add column if not exists feedback text;

alter table public.opi_feedback add column if not exists decision text;



create table if not exists public.individual_outreach (
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
  , season_id uuid references seasons(id)
);

alter table public.individual_outreach add column if not exists id              uuid primary key default gen_random_uuid();

alter table public.individual_outreach add column if not exists created_at      timestamptz not null default now();

alter table public.individual_outreach add column if not exists user_id         uuid;

alter table public.individual_outreach add column if not exists full_name       text;

alter table public.individual_outreach add column if not exists department      text;

alter table public.individual_outreach add column if not exists event_name      text;

alter table public.individual_outreach add column if not exists what_you_did    text;

alter table public.individual_outreach add column if not exists impact          text;

alter table public.individual_outreach add column if not exists hours           numeric not null default 0;

alter table public.individual_outreach add column if not exists event_date      date;

alter table public.individual_outreach add column if not exists proof_urls      text[] not null default '{}';

alter table public.individual_outreach add column if not exists people_impacted integer;

alter table public.individual_outreach add column if not exists status          text not null default 'PENDING'
                    check (status in ('PENDING','APPROVED','REJECTED'));

alter table public.individual_outreach add column if not exists credited_hours  numeric;

alter table public.individual_outreach add column if not exists reviewer_id     uuid;

alter table public.individual_outreach add column if not exists decided_at      timestamptz;

alter table public.individual_outreach add column if not exists season_id uuid references seasons(id);



create table if not exists public.purchases (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid references profiles(id),
  kind        text not null default 'reimbursement',
  description text not null,
  amount      numeric not null default 0,
  receipt_url text,
  status      text not null default 'PENDING'
                check (status in ('PENDING','APPROVED','REJECTED')),
  reviewer_id uuid references profiles(id),
  decided_at  timestamptz
);

alter table public.purchases add column if not exists id          uuid primary key default gen_random_uuid();

alter table public.purchases add column if not exists created_at  timestamptz not null default now();

alter table public.purchases add column if not exists user_id     uuid references profiles(id);

alter table public.purchases add column if not exists kind        text not null default 'reimbursement';

alter table public.purchases add column if not exists description text;

alter table public.purchases add column if not exists amount      numeric not null default 0;

alter table public.purchases add column if not exists receipt_url text;

alter table public.purchases add column if not exists status      text not null default 'PENDING'
                check (status in ('PENDING','APPROVED','REJECTED'));

alter table public.purchases add column if not exists reviewer_id uuid references profiles(id);

alter table public.purchases add column if not exists decided_at  timestamptz;



create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid references profiles(id),
  type       text not null default 'general',
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz
);

alter table public.notifications add column if not exists id         uuid primary key default gen_random_uuid();

alter table public.notifications add column if not exists created_at timestamptz not null default now();

alter table public.notifications add column if not exists user_id    uuid references profiles(id);

alter table public.notifications add column if not exists type       text not null default 'general';

alter table public.notifications add column if not exists title      text;

alter table public.notifications add column if not exists body       text;

alter table public.notifications add column if not exists link       text;

alter table public.notifications add column if not exists read_at    timestamptz;



create table if not exists public.notification_preferences (
  user_id    uuid primary key references profiles(id),
  prefs      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences add column if not exists user_id    uuid primary key references profiles(id);

alter table public.notification_preferences add column if not exists prefs      jsonb not null default '{}';

alter table public.notification_preferences add column if not exists updated_at timestamptz not null default now();



create table if not exists public.email_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  subject    text,
  body       text,
  updated_at timestamptz not null default now()
);

alter table public.email_templates add column if not exists id         uuid primary key default gen_random_uuid();

alter table public.email_templates add column if not exists name       text unique;

alter table public.email_templates add column if not exists subject    text;

alter table public.email_templates add column if not exists body       text;

alter table public.email_templates add column if not exists updated_at timestamptz not null default now();



create table if not exists public.org_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

alter table public.org_settings add column if not exists key        text primary key;

alter table public.org_settings add column if not exists value      text;

alter table public.org_settings add column if not exists updated_at timestamptz not null default now();



create table if not exists public.scout_events (
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

alter table public.scout_events add column if not exists id uuid primary key default gen_random_uuid();

alter table public.scout_events add column if not exists created_at timestamptz not null default now();

alter table public.scout_events add column if not exists created_by uuid references profiles(id) on delete set null;

alter table public.scout_events add column if not exists season_id uuid references seasons(id) on delete set null;

alter table public.scout_events add column if not exists name text;

alter table public.scout_events add column if not exists event_code text;

alter table public.scout_events add column if not exists starts_on date;

alter table public.scout_events add column if not exists ends_on date;

alter table public.scout_events add column if not exists is_active boolean not null default false;



create table if not exists public.scout_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references scout_events(id) on delete cascade,
  match_type text not null default 'qm' check (match_type in ('pm','qm','sf','f')),
  match_number int not null check (match_number > 0),
  red int[] not null default '{}',
  blue int[] not null default '{}',
  scheduled_at timestamptz,
  unique (event_id, match_type, match_number)
);

alter table public.scout_matches add column if not exists id uuid primary key default gen_random_uuid();

alter table public.scout_matches add column if not exists event_id uuid references scout_events(id) on delete cascade;

alter table public.scout_matches add column if not exists match_type text not null default 'qm' check (match_type in ('pm','qm','sf','f'));

alter table public.scout_matches add column if not exists match_number int check (match_number > 0);

alter table public.scout_matches add column if not exists red int[] not null default '{}';

alter table public.scout_matches add column if not exists blue int[] not null default '{}';

alter table public.scout_matches add column if not exists scheduled_at timestamptz;



create table if not exists public.scout_assignments (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references scout_matches(id) on delete cascade,
  station text not null check (station in ('red1','red2','red3','blue1','blue2','blue3')),
  scout_id uuid not null references profiles(id) on delete cascade,
  unique (match_id, station)
);

alter table public.scout_assignments add column if not exists id uuid primary key default gen_random_uuid();

alter table public.scout_assignments add column if not exists match_id uuid references scout_matches(id) on delete cascade;

alter table public.scout_assignments add column if not exists station text check (station in ('red1','red2','red3','blue1','blue2','blue3'));

alter table public.scout_assignments add column if not exists scout_id uuid references profiles(id) on delete cascade;



create table if not exists public.match_scouting (
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

alter table public.match_scouting add column if not exists id uuid primary key default gen_random_uuid();

alter table public.match_scouting add column if not exists created_at timestamptz not null default now();

alter table public.match_scouting add column if not exists updated_at timestamptz not null default now();

alter table public.match_scouting add column if not exists event_id uuid references scout_events(id) on delete cascade;

alter table public.match_scouting add column if not exists match_type text not null default 'qm';

alter table public.match_scouting add column if not exists match_number int;

alter table public.match_scouting add column if not exists team_number int check (team_number > 0);

alter table public.match_scouting add column if not exists alliance text check (alliance in ('red','blue'));

alter table public.match_scouting add column if not exists scout_id uuid references profiles(id) on delete cascade;

alter table public.match_scouting add column if not exists data jsonb not null default '{}';

alter table public.match_scouting add column if not exists notes text;



create table if not exists public.pit_scouting (
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

alter table public.pit_scouting add column if not exists id uuid primary key default gen_random_uuid();

alter table public.pit_scouting add column if not exists created_at timestamptz not null default now();

alter table public.pit_scouting add column if not exists updated_at timestamptz not null default now();

alter table public.pit_scouting add column if not exists event_id uuid references scout_events(id) on delete cascade;

alter table public.pit_scouting add column if not exists team_number int check (team_number > 0);

alter table public.pit_scouting add column if not exists scout_id uuid references profiles(id) on delete cascade;

alter table public.pit_scouting add column if not exists data jsonb not null default '{}';

alter table public.pit_scouting add column if not exists notes text;




-- Predicates precede every dependent policy/function. No untrusted search path.
create or replace function public.is_member() returns boolean language sql stable security definer set search_path = public, pg_temp as $$
 select exists(select 1 from public.profiles where id = auth.uid() and role in ('MEMBER','LEADERSHIP','OFFICER','OWNER') and account_status = 'active');
$$;
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path = public, pg_temp as $$
 select exists(select 1 from public.profiles where id = auth.uid() and role = 'OWNER' and account_status = 'active');
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public, pg_temp as $$
 select exists(select 1 from public.profiles where id = auth.uid() and role in ('LEADERSHIP','OFFICER','OWNER') and account_status = 'active');
$$;
create or replace function public.is_leadership() returns boolean language sql stable security definer set search_path = public, pg_temp as $$ select public.is_admin(); $$;
create or replace function public.has_perm(perm text) returns boolean language sql stable security definer set search_path = public, pg_temp as $$
 select exists(select 1 from public.profiles where id = auth.uid() and role <> 'PENDING' and account_status = 'active' and (role = 'OWNER' or perm = any(permissions)));
$$;
create or replace function public.guard_profile_privileges() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
 if auth.uid() is null then return new; end if;
 if (new.role is distinct from old.role or new.special_perms is distinct from old.special_perms or new.account_type is distinct from old.account_type) and not public.is_owner() then
   raise exception 'Only the President may change profile authority';
 end if;
 if (new.permissions is distinct from old.permissions or new.account_status is distinct from old.account_status) and not public.has_perm('manage_accounts') then
   raise exception 'Account management permission required';
 end if;
 return new;
end $$;
drop trigger if exists guard_profile_privileges_trg on public.profiles;
drop trigger if exists guard_profile_role_trg on public.profiles;
drop trigger if exists guard_profile_role on public.profiles;
create trigger guard_profile_privileges_trg before update on public.profiles for each row execute function public.guard_profile_privileges();
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
 insert into public.profiles(id,display_name,role,permissions,special_perms,account_status,account_type)
 values(new.id,coalesce(new.raw_user_meta_data->>'display_name',new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',split_part(new.email,'@',1)),
 'PENDING','{}','{}','active',case when new.raw_user_meta_data->>'account_type' = 'mentor' then 'mentor' else 'member' end)
 on conflict(id) do nothing;
 return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create or replace function public.task_updated_at() returns trigger language plpgsql set search_path = public, pg_temp as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists task_updated_at_trg on public.tasks;
create trigger task_updated_at_trg before update on public.tasks for each row execute function public.task_updated_at();
-- Current-route installations may have generated ranges. Preserve values, remove
-- generation before the shared credit trigger becomes the single writer.
do $$ declare t text; begin
  foreach t in array array['build_records','outreach_attendance'] loop
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='credit_interval' and is_generated='ALWAYS') then
      execute format('alter table public.%I alter column credit_interval drop expression',t);
    end if;
  end loop;
end $$;
-- Exact credit cache: cancelled parents do not contribute ordinary credit.
create or replace function toolkit_private.compute_build_credit() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.build_sessions;
begin
 select * into s from public.build_sessions where id = new.session_id;
 new.credit_enabled := (not coalesce(s.cancelled,false) or coalesce(new.credit_override,false));
 new.reserved_until := case when new.check_out is null then s.closes_at else null end;
 if new.check_out is not null and new.check_out < new.check_in then raise exception 'Checkout precedes check-in'; end if;
 new.credited_minutes := case when new.credit_enabled and new.check_out is not null then extract(epoch from (new.check_out-new.check_in))/60.0 else 0 end;
 new.credit_interval := case when new.credit_enabled and coalesce(new.check_out,new.reserved_until) > new.check_in then tstzrange(new.check_in,coalesce(new.check_out,new.reserved_until),'[)') else null end;
 return new;
end $$;
drop trigger if exists compute_build_credit_trg on public.build_records;
create trigger compute_build_credit_trg before insert or update on public.build_records for each row execute function toolkit_private.compute_build_credit();
create or replace function toolkit_private.compute_outreach_credit() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
 new.credit_enabled := not coalesce((select cancelled from public.outreach_events where id = new.event_id),false);
 if new.departure is not null and new.departure < new.arrival then raise exception 'Departure precedes arrival'; end if;
 new.credited_minutes := case when new.credit_enabled and new.departure is not null then extract(epoch from (new.departure-new.arrival))/60.0 else 0 end;
 new.credit_interval := case when new.credit_enabled and new.departure > new.arrival then tstzrange(new.arrival,new.departure,'[)') else null end;
 return new;
end $$;
drop trigger if exists compute_outreach_credit_trg on public.outreach_attendance;
create trigger compute_outreach_credit_trg before insert or update on public.outreach_attendance for each row execute function toolkit_private.compute_outreach_credit();
create or replace function toolkit_private.refresh_parent_credit() returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
 if tg_table_name = 'build_sessions' then update public.build_records set credit_override = case when new.cancelled then false else credit_override end where session_id = new.id;
 else update public.outreach_attendance set credit_enabled = not new.cancelled where event_id = new.id;
 end if;
 return new;
end $$;
drop trigger if exists refresh_build_credit_trg on public.build_sessions;
create trigger refresh_build_credit_trg after update of cancelled,closes_at on public.build_sessions for each row execute function toolkit_private.refresh_parent_credit();
drop trigger if exists refresh_outreach_credit_trg on public.outreach_events;
create trigger refresh_outreach_credit_trg after update of cancelled on public.outreach_events for each row execute function toolkit_private.refresh_parent_credit();


do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.invitations'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.invitations'::regclass and attname='created_by')]::smallint[]) then alter table public.invitations add constraint baseline_invitations_created_by_fkey foreign key (created_by) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.group_members'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.group_members'::regclass and attname='group_id')]::smallint[]) then alter table public.group_members add constraint baseline_group_members_group_id_fkey foreign key (group_id) references public.groups(id) on delete cascade not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.group_members'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.group_members'::regclass and attname='user_id')]::smallint[]) then alter table public.group_members add constraint baseline_group_members_user_id_fkey foreign key (user_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.tasks'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.tasks'::regclass and attname='created_by')]::smallint[]) then alter table public.tasks add constraint baseline_tasks_created_by_fkey foreign key (created_by) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.tasks'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.tasks'::regclass and attname='group_id')]::smallint[]) then alter table public.tasks add constraint baseline_tasks_group_id_fkey foreign key (group_id) references public.task_groups(id) on delete set null not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.tasks'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.tasks'::regclass and attname='season_id')]::smallint[]) then alter table public.tasks add constraint baseline_tasks_season_id_fkey foreign key (season_id) references public.seasons(id) on delete set null not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.tasks'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.tasks'::regclass and attname='owner_group_id')]::smallint[]) then alter table public.tasks add constraint baseline_tasks_owner_group_id_fkey foreign key (owner_group_id) references public.groups(id) on delete restrict not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.task_assignees'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.task_assignees'::regclass and attname='task_id')]::smallint[]) then alter table public.task_assignees add constraint baseline_task_assignees_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.task_assignees'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.task_assignees'::regclass and attname='user_id')]::smallint[]) then alter table public.task_assignees add constraint baseline_task_assignees_user_id_fkey foreign key (user_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.task_reviewers'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.task_reviewers'::regclass and attname='task_id')]::smallint[]) then alter table public.task_reviewers add constraint baseline_task_reviewers_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.task_reviewers'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.task_reviewers'::regclass and attname='user_id')]::smallint[]) then alter table public.task_reviewers add constraint baseline_task_reviewers_user_id_fkey foreign key (user_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.task_evidence'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.task_evidence'::regclass and attname='task_id')]::smallint[]) then alter table public.task_evidence add constraint baseline_task_evidence_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.task_evidence'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.task_evidence'::regclass and attname='user_id')]::smallint[]) then alter table public.task_evidence add constraint baseline_task_evidence_user_id_fkey foreign key (user_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.task_history'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.task_history'::regclass and attname='task_id')]::smallint[]) then alter table public.task_history add constraint baseline_task_history_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.task_history'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.task_history'::regclass and attname='user_id')]::smallint[]) then alter table public.task_history add constraint baseline_task_history_user_id_fkey foreign key (user_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.build_sessions'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.build_sessions'::regclass and attname='created_by')]::smallint[]) then alter table public.build_sessions add constraint baseline_build_sessions_created_by_fkey foreign key (created_by) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.build_sessions'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.build_sessions'::regclass and attname='location_id')]::smallint[]) then alter table public.build_sessions add constraint baseline_build_sessions_location_id_fkey foreign key (location_id) references public.build_locations(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.build_sessions'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.build_sessions'::regclass and attname='season_id')]::smallint[]) then alter table public.build_sessions add constraint baseline_build_sessions_season_id_fkey foreign key (season_id) references public.seasons(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.build_records'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.build_records'::regclass and attname='session_id')]::smallint[]) then alter table public.build_records add constraint baseline_build_records_session_id_fkey foreign key (session_id) references public.build_sessions(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.build_records'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.build_records'::regclass and attname='member_id')]::smallint[]) then alter table public.build_records add constraint baseline_build_records_member_id_fkey foreign key (member_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.outreach_events'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.outreach_events'::regclass and attname='created_by')]::smallint[]) then alter table public.outreach_events add constraint baseline_outreach_events_created_by_fkey foreign key (created_by) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.outreach_events'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.outreach_events'::regclass and attname='season_id')]::smallint[]) then alter table public.outreach_events add constraint baseline_outreach_events_season_id_fkey foreign key (season_id) references public.seasons(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.outreach_leads'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.outreach_leads'::regclass and attname='event_id')]::smallint[]) then alter table public.outreach_leads add constraint baseline_outreach_leads_event_id_fkey foreign key (event_id) references public.outreach_events(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.outreach_leads'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.outreach_leads'::regclass and attname='member_id')]::smallint[]) then alter table public.outreach_leads add constraint baseline_outreach_leads_member_id_fkey foreign key (member_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.outreach_rsvps'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.outreach_rsvps'::regclass and attname='event_id')]::smallint[]) then alter table public.outreach_rsvps add constraint baseline_outreach_rsvps_event_id_fkey foreign key (event_id) references public.outreach_events(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.outreach_rsvps'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.outreach_rsvps'::regclass and attname='member_id')]::smallint[]) then alter table public.outreach_rsvps add constraint baseline_outreach_rsvps_member_id_fkey foreign key (member_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.outreach_attendance'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.outreach_attendance'::regclass and attname='event_id')]::smallint[]) then alter table public.outreach_attendance add constraint baseline_outreach_attendance_event_id_fkey foreign key (event_id) references public.outreach_events(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.outreach_attendance'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.outreach_attendance'::regclass and attname='member_id')]::smallint[]) then alter table public.outreach_attendance add constraint baseline_outreach_attendance_member_id_fkey foreign key (member_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.opis'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.opis'::regclass and attname='submitter_id')]::smallint[]) then alter table public.opis add constraint baseline_opis_submitter_id_fkey foreign key (submitter_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.opis'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.opis'::regclass and attname='event_id')]::smallint[]) then alter table public.opis add constraint baseline_opis_event_id_fkey foreign key (event_id) references public.outreach_events(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.opis'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.opis'::regclass and attname='season_id')]::smallint[]) then alter table public.opis add constraint baseline_opis_season_id_fkey foreign key (season_id) references public.seasons(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.opi_versions'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.opi_versions'::regclass and attname='opi_id')]::smallint[]) then alter table public.opi_versions add constraint baseline_opi_versions_opi_id_fkey foreign key (opi_id) references public.opis(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.opi_feedback'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.opi_feedback'::regclass and attname='opi_id')]::smallint[]) then alter table public.opi_feedback add constraint baseline_opi_feedback_opi_id_fkey foreign key (opi_id) references public.opis(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.opi_feedback'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.opi_feedback'::regclass and attname='user_id')]::smallint[]) then alter table public.opi_feedback add constraint baseline_opi_feedback_user_id_fkey foreign key (user_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.individual_outreach'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.individual_outreach'::regclass and attname='season_id')]::smallint[]) then alter table public.individual_outreach add constraint baseline_individual_outreach_season_id_fkey foreign key (season_id) references public.seasons(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.purchases'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.purchases'::regclass and attname='user_id')]::smallint[]) then alter table public.purchases add constraint baseline_purchases_user_id_fkey foreign key (user_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.purchases'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.purchases'::regclass and attname='reviewer_id')]::smallint[]) then alter table public.purchases add constraint baseline_purchases_reviewer_id_fkey foreign key (reviewer_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.notifications'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.notifications'::regclass and attname='user_id')]::smallint[]) then alter table public.notifications add constraint baseline_notifications_user_id_fkey foreign key (user_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.notification_preferences'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.notification_preferences'::regclass and attname='user_id')]::smallint[]) then alter table public.notification_preferences add constraint baseline_notification_preferences_user_id_fkey foreign key (user_id) references public.profiles(id) not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.scout_events'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.scout_events'::regclass and attname='created_by')]::smallint[]) then alter table public.scout_events add constraint baseline_scout_events_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.scout_events'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.scout_events'::regclass and attname='season_id')]::smallint[]) then alter table public.scout_events add constraint baseline_scout_events_season_id_fkey foreign key (season_id) references public.seasons(id) on delete set null not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.scout_matches'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.scout_matches'::regclass and attname='event_id')]::smallint[]) then alter table public.scout_matches add constraint baseline_scout_matches_event_id_fkey foreign key (event_id) references public.scout_events(id) on delete cascade not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.scout_assignments'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.scout_assignments'::regclass and attname='match_id')]::smallint[]) then alter table public.scout_assignments add constraint baseline_scout_assignments_match_id_fkey foreign key (match_id) references public.scout_matches(id) on delete cascade not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.scout_assignments'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.scout_assignments'::regclass and attname='scout_id')]::smallint[]) then alter table public.scout_assignments add constraint baseline_scout_assignments_scout_id_fkey foreign key (scout_id) references public.profiles(id) on delete cascade not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.match_scouting'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.match_scouting'::regclass and attname='event_id')]::smallint[]) then alter table public.match_scouting add constraint baseline_match_scouting_event_id_fkey foreign key (event_id) references public.scout_events(id) on delete cascade not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.match_scouting'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.match_scouting'::regclass and attname='scout_id')]::smallint[]) then alter table public.match_scouting add constraint baseline_match_scouting_scout_id_fkey foreign key (scout_id) references public.profiles(id) on delete cascade not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.pit_scouting'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.pit_scouting'::regclass and attname='event_id')]::smallint[]) then alter table public.pit_scouting add constraint baseline_pit_scouting_event_id_fkey foreign key (event_id) references public.scout_events(id) on delete cascade not valid; end if; end $$;

do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.pit_scouting'::regclass and contype='f' and conkey=array[(select attnum from pg_attribute where attrelid='public.pit_scouting'::regclass and attname='scout_id')]::smallint[]) then alter table public.pit_scouting add constraint baseline_pit_scouting_scout_id_fkey foreign key (scout_id) references public.profiles(id) on delete cascade not valid; end if; end $$;

create index if not exists baseline_seasons_is_current_idx on public.seasons (is_current);

create index if not exists baseline_build_sessions_opens_at_idx on public.build_sessions (opens_at);

create index if not exists baseline_build_records_member_id_check_in_idx on public.build_records (member_id, check_in);

create index if not exists baseline_build_records_session_id_idx on public.build_records (session_id);

create index if not exists baseline_outreach_events_starts_at_idx on public.outreach_events (starts_at);

create index if not exists baseline_outreach_attendance_member_id_arrival_idx on public.outreach_attendance (member_id, arrival);

create index if not exists baseline_tasks_status_idx on public.tasks (status);

create index if not exists baseline_tasks_owner_group_id_idx on public.tasks (owner_group_id);

create index if not exists baseline_individual_outreach_user_id_idx on public.individual_outreach (user_id);

create index if not exists baseline_individual_outreach_status_idx on public.individual_outreach (status);

create index if not exists baseline_purchases_status_idx on public.purchases (status);

create index if not exists baseline_notifications_user_id_created_at_idx on public.notifications (user_id, created_at);

create index if not exists baseline_scout_assignments_scout_id_idx on public.scout_assignments (scout_id);

create index if not exists baseline_match_scouting_event_id_team_number_idx on public.match_scouting (event_id, team_number);

create index if not exists baseline_opi_versions_opi_id_submitted_at_idx on public.opi_versions (opi_id, submitted_at);

create index if not exists baseline_opi_feedback_opi_id_created_at_idx on public.opi_feedback (opi_id, created_at);

create unique index if not exists baseline_outreach_attendance_identity_idx on public.outreach_attendance (event_id, member_id);

create unique index if not exists baseline_outreach_leads_identity_idx on public.outreach_leads (event_id, member_id);

create unique index if not exists baseline_outreach_rsvps_identity_idx on public.outreach_rsvps (event_id, member_id);

create unique index if not exists baseline_group_members_identity_idx on public.group_members (group_id, user_id);

create unique index if not exists baseline_task_assignees_identity_idx on public.task_assignees (task_id, user_id);

create unique index if not exists baseline_task_reviewers_identity_idx on public.task_reviewers (task_id, user_id);

create unique index if not exists baseline_scout_matches_identity_idx on public.scout_matches (event_id, match_type, match_number);

create unique index if not exists baseline_scout_assignments_identity_idx on public.scout_assignments (match_id, station);

create unique index if not exists baseline_match_scouting_identity_idx on public.match_scouting (event_id, match_type, match_number, team_number, scout_id);

create unique index if not exists baseline_pit_scouting_identity_idx on public.pit_scouting (event_id, team_number, scout_id);

create unique index if not exists baseline_seasons_current_idx on public.seasons(is_current) where is_current;

alter table public.profiles enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='profiles' loop execute format('drop policy %I on public.profiles',p.policyname); end loop; end $$;
revoke all on public.profiles from anon;
grant select,insert,update,delete on public.profiles to authenticated;

alter table public.seasons enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='seasons' loop execute format('drop policy %I on public.seasons',p.policyname); end loop; end $$;
revoke all on public.seasons from anon;
grant select,insert,update,delete on public.seasons to authenticated;

alter table public.invitations enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='invitations' loop execute format('drop policy %I on public.invitations',p.policyname); end loop; end $$;
revoke all on public.invitations from anon;
grant select,insert,update,delete on public.invitations to authenticated;

alter table public.groups enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='groups' loop execute format('drop policy %I on public.groups',p.policyname); end loop; end $$;
revoke all on public.groups from anon;
grant select,insert,update,delete on public.groups to authenticated;

alter table public.group_members enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='group_members' loop execute format('drop policy %I on public.group_members',p.policyname); end loop; end $$;
revoke all on public.group_members from anon;
grant select,insert,update,delete on public.group_members to authenticated;

alter table public.task_groups enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='task_groups' loop execute format('drop policy %I on public.task_groups',p.policyname); end loop; end $$;
revoke all on public.task_groups from anon;
grant select,insert,update,delete on public.task_groups to authenticated;

alter table public.tasks enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='tasks' loop execute format('drop policy %I on public.tasks',p.policyname); end loop; end $$;
revoke all on public.tasks from anon;
grant select,insert,update,delete on public.tasks to authenticated;

alter table public.task_assignees enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='task_assignees' loop execute format('drop policy %I on public.task_assignees',p.policyname); end loop; end $$;
revoke all on public.task_assignees from anon;
grant select,insert,update,delete on public.task_assignees to authenticated;

alter table public.task_reviewers enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='task_reviewers' loop execute format('drop policy %I on public.task_reviewers',p.policyname); end loop; end $$;
revoke all on public.task_reviewers from anon;
grant select,insert,update,delete on public.task_reviewers to authenticated;

alter table public.task_evidence enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='task_evidence' loop execute format('drop policy %I on public.task_evidence',p.policyname); end loop; end $$;
revoke all on public.task_evidence from anon;
grant select,insert,update,delete on public.task_evidence to authenticated;

alter table public.task_history enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='task_history' loop execute format('drop policy %I on public.task_history',p.policyname); end loop; end $$;
revoke all on public.task_history from anon;
grant select,insert,update,delete on public.task_history to authenticated;

alter table public.login_events enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='login_events' loop execute format('drop policy %I on public.login_events',p.policyname); end loop; end $$;
revoke all on public.login_events from anon;
grant select,insert,update,delete on public.login_events to authenticated;

alter table public.build_locations enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='build_locations' loop execute format('drop policy %I on public.build_locations',p.policyname); end loop; end $$;
revoke all on public.build_locations from anon;
grant select,insert,update,delete on public.build_locations to authenticated;

alter table public.build_sessions enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='build_sessions' loop execute format('drop policy %I on public.build_sessions',p.policyname); end loop; end $$;
revoke all on public.build_sessions from anon;
grant select,insert,update,delete on public.build_sessions to authenticated;

alter table public.build_records enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='build_records' loop execute format('drop policy %I on public.build_records',p.policyname); end loop; end $$;
revoke all on public.build_records from anon;
grant select,insert,update,delete on public.build_records to authenticated;

alter table public.outreach_events enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='outreach_events' loop execute format('drop policy %I on public.outreach_events',p.policyname); end loop; end $$;
revoke all on public.outreach_events from anon;
grant select,insert,update,delete on public.outreach_events to authenticated;

alter table public.outreach_leads enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='outreach_leads' loop execute format('drop policy %I on public.outreach_leads',p.policyname); end loop; end $$;
revoke all on public.outreach_leads from anon;
grant select,insert,update,delete on public.outreach_leads to authenticated;

alter table public.outreach_rsvps enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='outreach_rsvps' loop execute format('drop policy %I on public.outreach_rsvps',p.policyname); end loop; end $$;
revoke all on public.outreach_rsvps from anon;
grant select,insert,update,delete on public.outreach_rsvps to authenticated;

alter table public.outreach_attendance enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='outreach_attendance' loop execute format('drop policy %I on public.outreach_attendance',p.policyname); end loop; end $$;
revoke all on public.outreach_attendance from anon;
grant select,insert,update,delete on public.outreach_attendance to authenticated;

alter table public.opis enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='opis' loop execute format('drop policy %I on public.opis',p.policyname); end loop; end $$;
revoke all on public.opis from anon;
grant select,insert,update,delete on public.opis to authenticated;

alter table public.opi_versions enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='opi_versions' loop execute format('drop policy %I on public.opi_versions',p.policyname); end loop; end $$;
revoke all on public.opi_versions from anon;
grant select,insert,update,delete on public.opi_versions to authenticated;

alter table public.opi_feedback enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='opi_feedback' loop execute format('drop policy %I on public.opi_feedback',p.policyname); end loop; end $$;
revoke all on public.opi_feedback from anon;
grant select,insert,update,delete on public.opi_feedback to authenticated;

alter table public.individual_outreach enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='individual_outreach' loop execute format('drop policy %I on public.individual_outreach',p.policyname); end loop; end $$;
revoke all on public.individual_outreach from anon;
grant select,insert,update,delete on public.individual_outreach to authenticated;

alter table public.purchases enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='purchases' loop execute format('drop policy %I on public.purchases',p.policyname); end loop; end $$;
revoke all on public.purchases from anon;
grant select,insert,update,delete on public.purchases to authenticated;

alter table public.notifications enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='notifications' loop execute format('drop policy %I on public.notifications',p.policyname); end loop; end $$;
revoke all on public.notifications from anon;
grant select,insert,update,delete on public.notifications to authenticated;

alter table public.notification_preferences enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='notification_preferences' loop execute format('drop policy %I on public.notification_preferences',p.policyname); end loop; end $$;
revoke all on public.notification_preferences from anon;
grant select,insert,update,delete on public.notification_preferences to authenticated;

alter table public.email_templates enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='email_templates' loop execute format('drop policy %I on public.email_templates',p.policyname); end loop; end $$;
revoke all on public.email_templates from anon;
grant select,insert,update,delete on public.email_templates to authenticated;

alter table public.org_settings enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='org_settings' loop execute format('drop policy %I on public.org_settings',p.policyname); end loop; end $$;
revoke all on public.org_settings from anon;
grant select,insert,update,delete on public.org_settings to authenticated;

alter table public.scout_events enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='scout_events' loop execute format('drop policy %I on public.scout_events',p.policyname); end loop; end $$;
revoke all on public.scout_events from anon;
grant select,insert,update,delete on public.scout_events to authenticated;

alter table public.scout_matches enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='scout_matches' loop execute format('drop policy %I on public.scout_matches',p.policyname); end loop; end $$;
revoke all on public.scout_matches from anon;
grant select,insert,update,delete on public.scout_matches to authenticated;

alter table public.scout_assignments enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='scout_assignments' loop execute format('drop policy %I on public.scout_assignments',p.policyname); end loop; end $$;
revoke all on public.scout_assignments from anon;
grant select,insert,update,delete on public.scout_assignments to authenticated;

alter table public.match_scouting enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='match_scouting' loop execute format('drop policy %I on public.match_scouting',p.policyname); end loop; end $$;
revoke all on public.match_scouting from anon;
grant select,insert,update,delete on public.match_scouting to authenticated;

alter table public.pit_scouting enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='pit_scouting' loop execute format('drop policy %I on public.pit_scouting',p.policyname); end loop; end $$;
revoke all on public.pit_scouting from anon;
grant select,insert,update,delete on public.pit_scouting to authenticated;

create policy baseline_profiles_read on public.profiles for select to authenticated using (id=auth.uid() or public.is_member());

create policy baseline_profiles_update on public.profiles for update to authenticated using (id=auth.uid() or public.has_perm('manage_accounts')) with check (id=auth.uid() or public.has_perm('manage_accounts'));

create policy baseline_seasons_read on public.seasons for select to authenticated using (public.is_member());

create policy baseline_seasons_write on public.seasons for all to authenticated using (public.has_perm('manage_seasons')) with check (public.has_perm('manage_seasons'));

create policy baseline_groups_read on public.groups for select to authenticated using (public.is_member());

create policy baseline_groups_write on public.groups for all to authenticated using (public.has_perm('manage_groups')) with check (public.has_perm('manage_groups'));

create policy baseline_group_members_read on public.group_members for select to authenticated using (public.is_member());

create policy baseline_group_members_write on public.group_members for all to authenticated using (public.has_perm('manage_groups')) with check (public.has_perm('manage_groups'));

create policy baseline_task_groups_read on public.task_groups for select to authenticated using (public.is_member());

create policy baseline_task_groups_write on public.task_groups for all to authenticated using (public.has_perm('manage_tasks')) with check (public.has_perm('manage_tasks'));

create policy baseline_build_locations_read on public.build_locations for select to authenticated using (public.is_member());

create policy baseline_build_locations_write on public.build_locations for all to authenticated using (public.has_perm('manage_build_hours')) with check (public.has_perm('manage_build_hours'));

create policy baseline_build_sessions_read on public.build_sessions for select to authenticated using (public.is_member());

create policy baseline_build_sessions_write on public.build_sessions for all to authenticated using (public.has_perm('manage_build_hours')) with check (public.has_perm('manage_build_hours'));

create policy baseline_outreach_events_read on public.outreach_events for select to authenticated using (public.is_member());

create policy baseline_outreach_events_write on public.outreach_events for all to authenticated using (public.has_perm('manage_outreach_events')) with check (public.has_perm('manage_outreach_events'));

create policy baseline_invitations_manage on public.invitations for all to authenticated using (public.has_perm('manage_invitations')) with check (public.has_perm('manage_invitations'));

create policy baseline_org_settings_read on public.org_settings for select to authenticated using (public.is_admin());

create policy baseline_org_settings_write on public.org_settings for all to authenticated using (public.is_owner()) with check (public.is_owner());

create policy baseline_email_templates_read on public.email_templates for select to authenticated using (public.is_admin());

create policy baseline_email_templates_write on public.email_templates for all to authenticated using (public.is_owner()) with check (public.is_owner());

create policy baseline_login_insert on public.login_events for insert to authenticated with check (user_id=auth.uid());

create policy baseline_login_read on public.login_events for select to authenticated using (public.is_owner());

create policy baseline_notifications_read on public.notifications for select to authenticated using (user_id=auth.uid() and public.is_member());

create policy baseline_notifications_update on public.notifications for update to authenticated using (user_id=auth.uid() and public.is_member()) with check (user_id=auth.uid() and public.is_member());

create policy baseline_notification_preferences_read on public.notification_preferences for select to authenticated using (user_id=auth.uid() and public.is_member());

create policy baseline_notification_preferences_update on public.notification_preferences for update to authenticated using (user_id=auth.uid() and public.is_member()) with check (user_id=auth.uid() and public.is_member());

create policy baseline_notification_preferences_insert on public.notification_preferences for insert to authenticated with check (user_id=auth.uid() and public.is_member());

create policy baseline_purchases_read on public.purchases for select to authenticated using (public.is_member() and (user_id=auth.uid() or public.has_perm('manage_purchases')));

create policy baseline_purchases_insert on public.purchases for insert to authenticated with check (public.is_member() and user_id=auth.uid() and status='PENDING' and reviewer_id is null and decided_at is null);

create policy baseline_purchases_update on public.purchases for update to authenticated using (public.is_member() and ((user_id=auth.uid() and status='PENDING') or public.has_perm('manage_purchases'))) with check (public.is_member() and ((user_id=auth.uid() and status='PENDING') or public.has_perm('manage_purchases')));

create policy baseline_individual_read on public.individual_outreach for select to authenticated using (public.is_member() and (user_id=auth.uid() or public.has_perm('manage_outreach_attendance')));

create policy baseline_individual_insert on public.individual_outreach for insert to authenticated with check (public.is_member() and user_id=auth.uid() and status='PENDING' and reviewer_id is null and decided_at is null);

create policy baseline_individual_update on public.individual_outreach for update to authenticated using (public.is_member() and ((user_id=auth.uid() and status='PENDING') or public.has_perm('manage_outreach_attendance'))) with check (public.is_member() and ((user_id=auth.uid() and status='PENDING') or public.has_perm('manage_outreach_attendance')));

create policy baseline_build_records_read on public.build_records for select to authenticated using (public.is_member() and (member_id=auth.uid() or public.has_perm('manage_build_hours')));

create policy baseline_outreach_attendance_read on public.outreach_attendance for select to authenticated using (public.is_member() and (member_id=auth.uid() or public.has_perm('manage_outreach_attendance') or exists(select 1 from public.outreach_leads l where l.event_id=outreach_attendance.event_id and l.member_id=auth.uid())));

create policy baseline_leads_read on public.outreach_leads for select to authenticated using (public.is_member());

create policy baseline_rsvps_read on public.outreach_rsvps for select to authenticated using (public.is_member());

create policy baseline_tasks_read on public.tasks for select to authenticated using (public.is_member() and (public.has_perm('manage_tasks') or exists(select 1 from public.task_assignees a where a.task_id=tasks.id and a.user_id=auth.uid()) or exists(select 1 from public.task_reviewers r where r.task_id=tasks.id and r.user_id=auth.uid())));

create policy baseline_tasks_insert on public.tasks for insert to authenticated with check (public.has_perm('manage_tasks'));

create policy baseline_tasks_update on public.tasks for update to authenticated using (public.is_member() and (public.has_perm('manage_tasks') or exists(select 1 from public.task_assignees a where a.task_id=tasks.id and a.user_id=auth.uid()) or exists(select 1 from public.task_reviewers r where r.task_id=tasks.id and r.user_id=auth.uid()))) with check (public.is_member() and (public.has_perm('manage_tasks') or exists(select 1 from public.task_assignees a where a.task_id=tasks.id and a.user_id=auth.uid()) or exists(select 1 from public.task_reviewers r where r.task_id=tasks.id and r.user_id=auth.uid())));

create policy baseline_task_assignees_read on public.task_assignees for select to authenticated using (public.is_member());

create policy baseline_task_assignees_write on public.task_assignees for all to authenticated using (public.has_perm('manage_tasks')) with check (public.has_perm('manage_tasks'));

create policy baseline_task_reviewers_read on public.task_reviewers for select to authenticated using (public.is_member());

create policy baseline_task_reviewers_write on public.task_reviewers for all to authenticated using (public.has_perm('manage_tasks')) with check (public.has_perm('manage_tasks'));

create policy baseline_task_evidence_read on public.task_evidence for select to authenticated using (public.is_member() and (public.has_perm('manage_tasks') or exists(select 1 from public.task_assignees a where a.task_id=task_evidence.task_id and a.user_id=auth.uid()) or exists(select 1 from public.task_reviewers r where r.task_id=task_evidence.task_id and r.user_id=auth.uid())));

create policy baseline_task_evidence_insert on public.task_evidence for insert to authenticated with check ((public.is_member() and (public.has_perm('manage_tasks') or exists(select 1 from public.task_assignees a where a.task_id=task_evidence.task_id and a.user_id=auth.uid()) or exists(select 1 from public.task_reviewers r where r.task_id=task_evidence.task_id and r.user_id=auth.uid()))) and user_id=auth.uid());

create policy baseline_task_history_read on public.task_history for select to authenticated using (public.is_member() and (public.has_perm('manage_tasks') or exists(select 1 from public.task_assignees a where a.task_id=task_history.task_id and a.user_id=auth.uid()) or exists(select 1 from public.task_reviewers r where r.task_id=task_history.task_id and r.user_id=auth.uid())));

create policy baseline_task_history_insert on public.task_history for insert to authenticated with check ((public.is_member() and (public.has_perm('manage_tasks') or exists(select 1 from public.task_assignees a where a.task_id=task_history.task_id and a.user_id=auth.uid()) or exists(select 1 from public.task_reviewers r where r.task_id=task_history.task_id and r.user_id=auth.uid()))) and user_id=auth.uid());

create policy baseline_opis_read on public.opis for select to authenticated using (public.is_member() and (submitter_id=auth.uid() or public.has_perm('manage_opis')));

create policy baseline_opi_versions_read on public.opi_versions for select to authenticated using (exists(select 1 from public.opis o where o.id=opi_versions.opi_id));

create policy baseline_opi_feedback_read on public.opi_feedback for select to authenticated using (exists(select 1 from public.opis o where o.id=opi_feedback.opi_id));

create policy baseline_scout_events_read on public.scout_events for select to authenticated using (public.is_member());

create policy baseline_scout_events_write on public.scout_events for all to authenticated using (public.has_perm('manage_scouting')) with check (public.has_perm('manage_scouting'));

create policy baseline_scout_matches_read on public.scout_matches for select to authenticated using (public.is_member());

create policy baseline_scout_matches_write on public.scout_matches for all to authenticated using (public.has_perm('manage_scouting')) with check (public.has_perm('manage_scouting'));

create policy baseline_scout_assignments_read on public.scout_assignments for select to authenticated using (public.is_member());

create policy baseline_scout_assignments_write on public.scout_assignments for all to authenticated using (public.has_perm('manage_scouting')) with check (public.has_perm('manage_scouting'));

create policy baseline_match_scouting_read on public.match_scouting for select to authenticated using (public.is_member());

create policy baseline_match_scouting_insert on public.match_scouting for insert to authenticated with check (public.is_member() and scout_id=auth.uid());

create policy baseline_match_scouting_update on public.match_scouting for update to authenticated using (public.is_member() and (scout_id=auth.uid() or public.has_perm('manage_scouting'))) with check (public.is_member() and scout_id=auth.uid());

create policy baseline_match_scouting_delete on public.match_scouting for delete to authenticated using (public.is_member() and (scout_id=auth.uid() or public.has_perm('manage_scouting')));

create policy baseline_pit_scouting_read on public.pit_scouting for select to authenticated using (public.is_member());

create policy baseline_pit_scouting_insert on public.pit_scouting for insert to authenticated with check (public.is_member() and scout_id=auth.uid());

create policy baseline_pit_scouting_update on public.pit_scouting for update to authenticated using (public.is_member() and (scout_id=auth.uid() or public.has_perm('manage_scouting'))) with check (public.is_member() and scout_id=auth.uid());

create policy baseline_pit_scouting_delete on public.pit_scouting for delete to authenticated using (public.is_member() and (scout_id=auth.uid() or public.has_perm('manage_scouting')));

create or replace function public.notify(target uuid, ntype text, ntitle text, nbody text, nlink text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
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
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  for r in
    select id from profiles
    where account_status = 'active' and role <> 'PENDING'
      and (
        perm = 'members'
        or (perm is null and role in ('LEADERSHIP','OFFICER','OWNER'))
        or (perm is not null and perm <> 'members' and (role = 'OWNER' or perm = any(permissions)))
      )
  loop
    perform notify(r.id, ntype, ntitle, nbody, nlink);
  end loop;
end $$;

revoke execute on function public.notify(uuid,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.notify_many(text,text,text,text,text) from public, anon, authenticated;

-- OPIs ---------------------------------------------------------------------
create or replace function public.trg_notify_opi() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
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
language plpgsql security definer set search_path = public, pg_temp as $$
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
language plpgsql security definer set search_path = public, pg_temp as $$
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
language plpgsql security definer set search_path = public, pg_temp as $$
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
language plpgsql security definer set search_path = public, pg_temp as $$
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
language plpgsql security definer set search_path = public, pg_temp as $$
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
language plpgsql security definer set search_path = public, pg_temp as $$
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
language plpgsql security definer set search_path = public, pg_temp as $$
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
language plpgsql security definer set search_path = public, pg_temp as $$
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



create or replace function public.trg_notify_scout_assignment() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
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


CREATE OR REPLACE FUNCTION outreach_action(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  op text := payload->>'action';
  uid uuid := auth.uid();
  result jsonb;
  eid uuid;
  r record;
BEGIN
  IF NOT is_member() THEN RAISE EXCEPTION 'inactive or unauthenticated'; END IF;

  CASE op
  WHEN 'create' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    INSERT INTO outreach_events (title, description, location, latitude, longitude, starts_at, ends_at, season_id)
    VALUES (
      payload->>'title',
      payload->>'description',
      payload->>'location',
      (payload->>'latitude')::double precision,
      (payload->>'longitude')::double precision,
      (payload->>'starts_at')::timestamptz,
      (payload->>'ends_at')::timestamptz,
      COALESCE((payload->>'season_id')::uuid, (SELECT id FROM seasons WHERE is_current LIMIT 1))
    ) RETURNING to_jsonb(outreach_events.*) INTO result;

  WHEN 'edit' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    eid := (payload->>'id')::uuid;
    UPDATE outreach_events SET
      title = COALESCE(payload->>'title', title),
      description = COALESCE(payload->>'description', description),
      location = COALESCE(payload->>'location', location),
      latitude = COALESCE((payload->>'latitude')::double precision, latitude),
      longitude = COALESCE((payload->>'longitude')::double precision, longitude),
      starts_at = COALESCE((payload->>'starts_at')::timestamptz, starts_at),
      ends_at = COALESCE((payload->>'ends_at')::timestamptz, ends_at)
    WHERE id = eid
    RETURNING to_jsonb(outreach_events.*) INTO result;

  WHEN 'cancel' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE outreach_events SET cancelled = true WHERE id = (payload->>'id')::uuid
    RETURNING to_jsonb(outreach_events.*) INTO result;

  WHEN 'restore' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE outreach_events SET cancelled = false WHERE id = (payload->>'id')::uuid
    RETURNING to_jsonb(outreach_events.*) INTO result;

  WHEN 'leads' THEN
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'forbidden'; END IF;
    eid := (payload->>'event_id')::uuid;
    DELETE FROM outreach_leads WHERE event_id = eid;
    INSERT INTO outreach_leads (event_id, member_id)
    SELECT eid, (j.value)::uuid FROM jsonb_array_elements_text(payload->'member_ids') j;
    SELECT to_jsonb(e.*) INTO result FROM outreach_events e WHERE e.id = eid;

  WHEN 'rsvp' THEN
    eid := (payload->>'event_id')::uuid;
    IF (payload->>'planned')::boolean THEN
      INSERT INTO outreach_rsvps (event_id, member_id, planned) VALUES (eid, uid, true)
      ON CONFLICT (event_id, member_id) DO UPDATE SET planned = true;
    ELSE
      DELETE FROM outreach_rsvps WHERE event_id = eid AND member_id = uid;
    END IF;
    result := jsonb_build_object('event_id', eid, 'member_id', uid, 'planned', (payload->>'planned')::boolean);

  WHEN 'attendance' THEN
    IF NOT has_perm('manage_outreach_attendance') THEN RAISE EXCEPTION 'forbidden'; END IF;
    INSERT INTO outreach_attendance (event_id, member_id, arrival, departure, credited_minutes)
    VALUES (
      (payload->>'event_id')::uuid,
      (payload->>'member_id')::uuid,
      (payload->>'arrival')::timestamptz,
      (payload->>'departure')::timestamptz,
      EXTRACT(EPOCH FROM ((payload->>'departure')::timestamptz - (payload->>'arrival')::timestamptz)) / 60.0
    )
    ON CONFLICT (event_id, member_id) DO UPDATE SET
      arrival = EXCLUDED.arrival,
      departure = EXCLUDED.departure,
      credited_minutes = EXCLUDED.credited_minutes
    RETURNING to_jsonb(outreach_attendance.*) INTO result;

  WHEN 'self_checkin' THEN
    eid := (payload->>'event_id')::uuid;
    SELECT * INTO r FROM outreach_events WHERE id = eid;
    IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;
    IF r.cancelled THEN RAISE EXCEPTION 'event cancelled'; END IF;
    IF r.ends_at IS NOT NULL AND now() > r.ends_at THEN RAISE EXCEPTION 'event has ended'; END IF;
    SELECT * INTO r FROM outreach_attendance WHERE event_id = eid AND member_id = uid;
    IF FOUND THEN
      IF r.departure IS NULL THEN
        result := to_jsonb(r);
        RETURN result;
      END IF;
      RAISE EXCEPTION 'already attended this event';
    END IF;
    INSERT INTO outreach_attendance (event_id, member_id, arrival)
    VALUES (eid, uid, now())
    RETURNING to_jsonb(outreach_attendance.*) INTO result;

  WHEN 'self_checkout' THEN
    eid := (payload->>'event_id')::uuid;
    SELECT * INTO r FROM outreach_attendance WHERE event_id = eid AND member_id = uid AND departure IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'no active check-in for this event'; END IF;
    UPDATE outreach_attendance SET
      departure = now(),
      credited_minutes = EXTRACT(EPOCH FROM (now() - arrival)) / 60.0
    WHERE event_id = eid AND member_id = uid AND departure IS NULL
    RETURNING to_jsonb(outreach_attendance.*) INTO result;

  ELSE
    RAISE EXCEPTION 'unknown action: %', op;
  END CASE;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION opi_action(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  op text := payload->>'action';
  uid uuid := auth.uid();
  result jsonb;
  oid uuid;
  r record;
BEGIN
  IF NOT is_member() THEN RAISE EXCEPTION 'inactive or unauthenticated'; END IF;

  CASE op
  WHEN 'submit' THEN
    INSERT INTO opis (submitter_id, title, summary, document_url, status)
    VALUES (uid, payload->>'title', payload->>'summary', payload->>'document_url', 'SUBMITTED')
    RETURNING to_jsonb(opis.*) INTO result;
    INSERT INTO opi_versions (opi_id, title, summary, document_url)
    VALUES ((result->>'id')::uuid, payload->>'title', payload->>'summary', payload->>'document_url');

  WHEN 'resubmit' THEN
    oid := (payload->>'id')::uuid;
    SELECT * INTO r FROM opis WHERE id = oid;
    IF r.submitter_id != uid THEN RAISE EXCEPTION 'not owner'; END IF;
    IF r.status != 'CHANGES_REQUESTED' THEN RAISE EXCEPTION 'can only resubmit from changes_requested'; END IF;
    UPDATE opis SET
      status = 'RESUBMITTED',
      title = COALESCE(payload->>'title', title),
      summary = COALESCE(payload->>'summary', summary),
      document_url = COALESCE(payload->>'document_url', document_url)
    WHERE id = oid
    RETURNING to_jsonb(opis.*) INTO result;
    INSERT INTO opi_versions (opi_id, title, summary, document_url)
    VALUES (oid, result->>'title', result->>'summary', result->>'document_url');

  WHEN 'changes' THEN
    IF NOT has_perm('manage_opis') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF (payload->>'feedback') IS NULL OR trim(payload->>'feedback') = '' THEN RAISE EXCEPTION 'feedback required'; END IF;
    oid := (payload->>'id')::uuid;
    UPDATE opis SET status = 'CHANGES_REQUESTED' WHERE id = oid
    RETURNING to_jsonb(opis.*) INTO result;
    INSERT INTO opi_feedback (opi_id, user_id, feedback, decision) VALUES (oid, uid, payload->>'feedback', 'CHANGES_REQUESTED');

  WHEN 'reject' THEN
    IF NOT has_perm('manage_opis') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF (payload->>'feedback') IS NULL OR trim(payload->>'feedback') = '' THEN RAISE EXCEPTION 'feedback required'; END IF;
    oid := (payload->>'id')::uuid;
    UPDATE opis SET status = 'REJECTED' WHERE id = oid
    RETURNING to_jsonb(opis.*) INTO result;
    INSERT INTO opi_feedback (opi_id, user_id, feedback, decision) VALUES (oid, uid, payload->>'feedback', 'REJECTED');

  WHEN 'approve' THEN
    IF NOT has_perm('manage_opis') THEN RAISE EXCEPTION 'forbidden'; END IF;
    oid := (payload->>'id')::uuid;
    UPDATE opis SET status = 'APPROVED' WHERE id = oid
    RETURNING to_jsonb(opis.*) INTO result;
    IF (payload->>'feedback') IS NOT NULL AND trim(payload->>'feedback') != '' THEN
      INSERT INTO opi_feedback (opi_id, user_id, feedback, decision) VALUES (oid, uid, payload->>'feedback', 'APPROVED');
    END IF;

  WHEN 'reopen' THEN
    IF NOT has_perm('manage_opis') THEN RAISE EXCEPTION 'forbidden'; END IF;
    oid := (payload->>'id')::uuid;
    UPDATE opis SET status = 'SUBMITTED' WHERE id = oid AND status IN ('APPROVED', 'REJECTED')
    RETURNING to_jsonb(opis.*) INTO result;

  WHEN 'convert' THEN
    IF NOT has_perm('manage_opis') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF NOT has_perm('manage_outreach_events') THEN RAISE EXCEPTION 'both permissions required'; END IF;
    oid := (payload->>'id')::uuid;
    INSERT INTO outreach_events (title, description, location, starts_at, ends_at, season_id)
    VALUES (
      payload->>'title', payload->>'description', payload->>'location',
      (payload->>'starts_at')::timestamptz, (payload->>'ends_at')::timestamptz,
      COALESCE((payload->>'season_id')::uuid, (SELECT id FROM seasons WHERE is_current LIMIT 1))
    ) RETURNING id INTO oid;
    UPDATE opis SET status = 'CONVERTED', event_id = oid WHERE id = (payload->>'id')::uuid
    RETURNING to_jsonb(opis.*) INTO result;

  ELSE
    RAISE EXCEPTION 'unknown action: %', op;
  END CASE;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION build_action(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  op text := payload->>'action';
  uid uuid := auth.uid();
  result jsonb;
  sid uuid;
  rid uuid;
  r record;
  tok text;
BEGIN
  IF NOT is_member() THEN RAISE EXCEPTION 'inactive or unauthenticated'; END IF;

  CASE op
  WHEN 'location' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF (payload->>'id') IS NOT NULL THEN
      UPDATE build_locations SET name = payload->>'name' WHERE id = (payload->>'id')::uuid
      RETURNING to_jsonb(build_locations.*) INTO result;
    ELSE
      INSERT INTO build_locations (name) VALUES (payload->>'name')
      RETURNING to_jsonb(build_locations.*) INTO result;
    END IF;

  WHEN 'session' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    INSERT INTO build_sessions (title, location_id, opens_at, closes_at, season_id)
    VALUES (
      payload->>'title',
      (payload->>'location_id')::uuid,
      (payload->>'opens_at')::timestamptz,
      (payload->>'closes_at')::timestamptz,
      COALESCE((payload->>'season_id')::uuid, (SELECT id FROM seasons WHERE is_current LIMIT 1))
    ) RETURNING to_jsonb(build_sessions.*) INTO result;

  WHEN 'edit_session' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    sid := (payload->>'id')::uuid;
    UPDATE build_sessions SET
      title = COALESCE(payload->>'title', title),
      location_id = COALESCE((payload->>'location_id')::uuid, location_id),
      opens_at = COALESCE((payload->>'opens_at')::timestamptz, opens_at),
      closes_at = COALESCE((payload->>'closes_at')::timestamptz, closes_at)
    WHERE id = sid
    RETURNING to_jsonb(build_sessions.*) INTO result;

  WHEN 'cancel' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    UPDATE build_sessions SET cancelled = true WHERE id = (payload->>'id')::uuid
    RETURNING to_jsonb(build_sessions.*) INTO result;

  WHEN 'qr' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    sid := (payload->>'session_id')::uuid;
    tok := encode(gen_random_bytes(16), 'hex');
    result := jsonb_build_object('token', tok, 'expires_at', now() + interval '45 seconds', 'session_id', sid);

  WHEN 'check_in' THEN
    sid := (payload->>'session_id')::uuid;
    SELECT * INTO r FROM build_sessions WHERE id = sid;
    IF NOT FOUND THEN RAISE EXCEPTION 'session not found'; END IF;
    IF r.cancelled THEN RAISE EXCEPTION 'session cancelled'; END IF;
    IF now() < r.opens_at OR (r.closes_at IS NOT NULL AND now() > r.closes_at) THEN
      RAISE EXCEPTION 'session not in window';
    END IF;
    SELECT * INTO r FROM build_records WHERE session_id = sid AND member_id = uid AND check_out IS NULL;
    IF FOUND THEN
      result := to_jsonb(r);
      RETURN result;
    END IF;
    IF EXISTS (SELECT 1 FROM build_records WHERE member_id = uid AND check_out IS NULL) THEN
      RAISE EXCEPTION 'already checked in to another session';
    END IF;
    INSERT INTO build_records (session_id, member_id, check_in, checkout_method)
    VALUES (sid, uid, now(), 'qr')
    RETURNING to_jsonb(build_records.*) INTO result;

  WHEN 'check_out' THEN
    rid := (payload->>'id')::uuid;
    SELECT * INTO r FROM build_records WHERE id = rid AND member_id = uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'record not found'; END IF;
    IF r.check_out IS NOT NULL THEN
      result := to_jsonb(r);
      RETURN result;
    END IF;
    UPDATE build_records SET
      check_out = now(),
      credited_minutes = EXTRACT(EPOCH FROM (now() - check_in)) / 60.0
    WHERE id = rid
    RETURNING to_jsonb(build_records.*) INTO result;

  WHEN 'correct' THEN
    IF NOT has_perm('manage_build_hours') THEN RAISE EXCEPTION 'forbidden'; END IF;
    IF (payload->>'id') IS NOT NULL THEN
      rid := (payload->>'id')::uuid;
      UPDATE build_records SET
        check_in = COALESCE((payload->>'check_in')::timestamptz, check_in),
        check_out = COALESCE((payload->>'check_out')::timestamptz, check_out),
        credited_minutes = EXTRACT(EPOCH FROM (
          COALESCE((payload->>'check_out')::timestamptz, check_out) -
          COALESCE((payload->>'check_in')::timestamptz, check_in)
        )) / 60.0,
        checkout_method = 'administrative correction'
      WHERE id = rid
      RETURNING to_jsonb(build_records.*) INTO result;
    ELSE
      INSERT INTO build_records (session_id, member_id, check_in, check_out, checkout_method, credited_minutes)
      VALUES (
        (payload->>'session_id')::uuid,
        (payload->>'member_id')::uuid,
        (payload->>'check_in')::timestamptz,
        (payload->>'check_out')::timestamptz,
        'administrative correction',
        EXTRACT(EPOCH FROM ((payload->>'check_out')::timestamptz - (payload->>'check_in')::timestamptz)) / 60.0
      ) RETURNING to_jsonb(build_records.*) INTO result;
    END IF;

  ELSE
    RAISE EXCEPTION 'unknown action: %', op;
  END CASE;

  RETURN result;
END;
$$;


-- The old view may depend on integer caches or retired legacy relations.
drop view if exists public.hours_summary;
-- Exact numeric caches also upgrade existing current-model integer cache columns.
alter table public.build_records alter column credited_minutes type numeric using credited_minutes::numeric;
alter table public.outreach_attendance alter column credited_minutes type numeric using credited_minutes::numeric;
-- Current reporting shape is retained until the season reporting cutover; sources are authoritative current rows.
create or replace view public.hours_summary with (security_invoker=true) as
 select p.id as user_id,p.display_name,
 round(coalesce(b.minutes,0)/60.0,1) as build_hours,
 round((coalesce(o.minutes,0)+least(coalesce(i.hours,0),6)*60)/60.0,1) as outreach_hours,
 round((coalesce(b.minutes,0)+coalesce(o.minutes,0)+least(coalesce(i.hours,0),6)*60)/60.0,1) as total_hours
 from public.profiles p
 left join (select member_id,sum(coalesce(credited_minutes,0)) as minutes from public.build_records where credit_enabled group by member_id) b on b.member_id=p.id
 left join (select member_id,sum(coalesce(credited_minutes,0)) as minutes from public.outreach_attendance where credit_enabled group by member_id) o on o.member_id=p.id
 left join (select user_id,sum(coalesce(credited_hours,hours,0)) as hours from public.individual_outreach where status='APPROVED' group by user_id) i on i.user_id=p.id;
revoke all on public.hours_summary from public,anon;
grant select on public.hours_summary to authenticated;
create or replace function public.list_cron_jobs() returns table(jobid bigint,jobname text,schedule text,active boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.is_owner() then raise exception 'forbidden'; end if;
 if to_regclass('cron.job') is null then return; end if;
 return query execute 'select jobid,jobname,schedule,active from cron.job';
end $$;
insert into public.org_settings(key,value) values ('org_name','Optix Robotics'),('timezone','America/Los_Angeles'),('build_default_radius_m','100') on conflict(key) do nothing;
-- Preserve existing bucket settings and objects. Private-fetch conversion is a later domain cutover.
insert into storage.buckets(id,name,public) values ('task-evidence','task-evidence',false),('receipts','receipts',true),('outreach-proofs','outreach-proofs',true) on conflict(id) do nothing;


do $$ declare p record; begin
 for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and (policyname like 'te_storage_%' or policyname like 'receipts_%' or policyname like 'outreach_proofs_%' or policyname like 'baseline_%') loop
 execute format('drop policy %I on storage.objects',p.policyname);
 end loop;
end $$;
create policy baseline_attachment_read on storage.objects for select to authenticated using (
 public.is_member() and (
 (bucket_id='task-evidence' and (owner=auth.uid() or public.has_perm('manage_tasks') or exists(select 1 from public.task_evidence e where e.file_url like '%' || storage.objects.name)))
 or (bucket_id='receipts' and (owner=auth.uid() or public.has_perm('manage_purchases')))
 or (bucket_id='outreach-proofs' and (owner=auth.uid() or public.has_perm('manage_outreach_attendance')))
 ));
create policy baseline_attachment_insert on storage.objects for insert to authenticated with check (
 public.is_member() and bucket_id in ('task-evidence','receipts','outreach-proofs') and (storage.foldername(name))[1]=auth.uid()::text
 );
create policy baseline_attachment_delete on storage.objects for delete to authenticated using (
 public.is_member() and (
 (bucket_id='task-evidence' and (owner=auth.uid() or public.has_perm('manage_tasks')))
 or (bucket_id='receipts' and (owner=auth.uid() or public.has_perm('manage_purchases')))
 or (bucket_id='outreach-proofs' and (owner=auth.uid() or public.has_perm('manage_outreach_attendance')))
 ));

revoke all on function public.is_member() from public,anon,authenticated;
grant execute on function public.is_member() to authenticated;
revoke all on function public.is_owner() from public,anon,authenticated;
grant execute on function public.is_owner() to authenticated;
revoke all on function public.is_admin() from public,anon,authenticated;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.is_leadership() from public,anon,authenticated;
grant execute on function public.is_leadership() to authenticated;
revoke all on function public.has_perm(text) from public,anon,authenticated;
grant execute on function public.has_perm(text) to authenticated;
revoke all on function public.guard_profile_privileges() from public,anon,authenticated;
revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.task_updated_at() from public,anon,authenticated;
revoke all on function toolkit_private.compute_build_credit() from public,anon,authenticated;
revoke all on function toolkit_private.compute_outreach_credit() from public,anon,authenticated;
revoke all on function toolkit_private.refresh_parent_credit() from public,anon,authenticated;
revoke all on function public.notify(uuid,text,text,text,text) from public,anon,authenticated;
revoke all on function public.notify_many(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.trg_notify_opi() from public,anon,authenticated;
revoke all on function public.trg_notify_purchase() from public,anon,authenticated;
revoke all on function public.trg_notify_individual_outreach() from public,anon,authenticated;
revoke all on function public.trg_notify_task_member() from public,anon,authenticated;
revoke all on function public.trg_notify_task_status() from public,anon,authenticated;
revoke all on function public.trg_notify_outreach_event() from public,anon,authenticated;
revoke all on function public.trg_notify_outreach_lead() from public,anon,authenticated;
revoke all on function public.trg_notify_build_session() from public,anon,authenticated;
revoke all on function public.trg_notify_profile() from public,anon,authenticated;
revoke all on function public.trg_notify_scout_assignment() from public,anon,authenticated;
revoke all on function public.outreach_action(jsonb) from public,anon,authenticated;
grant execute on function public.outreach_action(jsonb) to authenticated;
revoke all on function public.opi_action(jsonb) from public,anon,authenticated;
grant execute on function public.opi_action(jsonb) to authenticated;
revoke all on function public.build_action(jsonb) from public,anon,authenticated;
grant execute on function public.build_action(jsonb) to authenticated;
revoke all on function public.list_cron_jobs() from public,anon,authenticated;
grant execute on function public.list_cron_jobs() to authenticated;
revoke all on all functions in schema toolkit_private from public,anon,authenticated;
reset search_path;
