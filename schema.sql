-- ============================================================
-- Optix Toolkit — Supabase database schema
-- Supabase project ref: exvhzdpjuorlzhulnyvl
-- Generated from application code on 2026-09-30
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  grade        text,
  role         text not null default 'PENDING'
                 check (role in ('PENDING','MEMBER','LEADERSHIP','OFFICER','OWNER')),
  special_perms text[],
  avatar_url   text,
  bio          text,
  department   text
                 check (department is null or department in ('Build','Technology','Business','Outreach'))
);

-- ============================================================
-- BUILD ZONES (geofenced areas for check-in verification)
-- ============================================================
create table build_zones (
  id           uuid primary key default uuid_generate_v4(),
  name         text not null,
  description  text,
  gps_lat      double precision,
  gps_lng      double precision,
  gps_radius_m double precision,
  qr_token     text,
  active       boolean not null default true
);

-- ============================================================
-- BUILD SCHEDULE (sessions, optionally recurring via rrule)
-- ============================================================
create table build_schedule (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  zone_id      uuid references build_zones(id) on delete set null,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  rrule        text,
  is_recurring boolean not null default false,
  short_notice boolean not null default false
);

-- ============================================================
-- BUILD CHECK-INS (GPS or QR verified attendance)
-- ============================================================
create table build_checkins (
  id             uuid primary key default uuid_generate_v4(),
  session_id     uuid references build_schedule(id) on delete set null,
  zone_id        uuid references build_zones(id) on delete set null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  method         text not null check (method in ('gps','qr')),
  checked_in_at  timestamptz not null,
  checked_out_at timestamptz,
  minutes_logged integer,
  lat            double precision,
  lng            double precision
);

-- ============================================================
-- OUTREACH EVENTS
-- ============================================================
create table outreach_events (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  description text,
  location    text,
  lat         double precision,
  lng         double precision,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  qr_token    text
);

-- ============================================================
-- OUTREACH CHECK-INS
-- ============================================================
create table outreach_checkins (
  id             uuid primary key default uuid_generate_v4(),
  event_id       uuid references outreach_events(id) on delete set null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  method         text not null,
  checked_in_at  timestamptz not null,
  minutes_logged integer
);

-- ============================================================
-- INDIVIDUAL OUTREACH (self-reported, admin-reviewed)
-- ============================================================
create table individual_outreach (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  full_name       text not null,
  department      text,
  event_name      text not null,
  what_you_did    text not null,
  impact          text not null,
  hours           numeric not null,
  credited_hours  numeric,
  event_date      date not null,
  proof_urls      text[] not null default '{}',
  people_impacted integer,
  status          text not null default 'PENDING'
                    check (status in ('PENDING','APPROVED','REJECTED')),
  reviewer_id     uuid references auth.users(id) on delete set null,
  decided_at      timestamptz
);

-- ============================================================
-- OPI INITIATIVES (Outreach Project Initiatives)
-- ============================================================
create table opi_initiatives (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  doc_url     text,
  status      text not null default 'PENDING'
                check (status in ('PENDING','IN_REVIEW','APPROVED','EXECUTED','REJECTED')),
  reviewer_id uuid references auth.users(id) on delete set null
);

-- ============================================================
-- OPI COMMENTS
-- ============================================================
create table opi_comments (
  id             uuid primary key default uuid_generate_v4(),
  created_at     timestamptz not null default now(),
  initiative_id  uuid not null references opi_initiatives(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  body           text not null
);

-- ============================================================
-- PURCHASES & REIMBURSEMENTS
-- ============================================================
create table purchases (
  id          uuid primary key default uuid_generate_v4(),
  created_at  timestamptz not null default now(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('purchase','reimbursement')),
  description text not null,
  amount      numeric not null,
  receipt_url text,
  status      text not null default 'PENDING'
                check (status in ('PENDING','APPROVED','REJECTED')),
  reviewer_id uuid references auth.users(id) on delete set null,
  decided_at  timestamptz
);

-- ============================================================
-- HOURS SUMMARY (materialized/computed view per user)
-- ============================================================
create table hours_summary (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  build_hours    numeric not null default 0,
  outreach_hours numeric not null default 0,
  total_hours    numeric not null default 0
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table notifications (
  id         uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz
);

-- ============================================================
-- NOTIFICATION PREFERENCES (per-user, JSONB prefs blob)
-- ============================================================
create table notification_preferences (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- EMAIL TEMPLATES (admin-managed)
-- ============================================================
create table email_templates (
  id         uuid primary key default uuid_generate_v4(),
  slug       text not null unique,
  subject    text not null,
  body       text not null,
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
-- STORAGE BUCKETS
-- ============================================================
-- These are configured in the Supabase dashboard, not via SQL:
--   - receipts          (purchase receipt uploads)
--   - outreach-proofs   (individual outreach proof images/videos)

-- ============================================================
-- CRON JOBS (via pg_cron, provisioned in Supabase dashboard)
-- ============================================================
-- Expected jobs (listed via supabase.rpc('list_cron_jobs')):
--   - auto-checkout       Closes open build check-ins past their window
--   - session-warning     Notifies attendees before a session starts
--   - outreach-reminder   Reminds members about upcoming outreach events
