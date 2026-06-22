-- ============================================================
-- HOURS — Supabase schema  (Project B, fully separate)
-- ------------------------------------------------------------
-- The Hours app uses its OWN Supabase project, unrelated to the
-- Scouting/Analytics project. Point hours/.env at this project.
--
-- Run this ONCE in the Supabase SQL Editor for Project B.
-- Safe to re-run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ----- Members (optional reference) -------------------------
create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name       text not null,
  role       text,
  grade      text,
  active     boolean default true
);

-- ----- Build + outreach hours -------------------------------
create table if not exists public.hours_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  created_by  uuid references auth.users(id),
  member_name text not null,
  date        date not null default current_date,
  type        text not null default 'build',   -- build | outreach
  hours       numeric not null,
  activity    text,
  notes       text
);
create index if not exists idx_hours_member on public.hours_log(member_name);
create index if not exists idx_hours_type   on public.hours_log(type);

-- ----- Login audit log (one row per successful sign-in) -----
create table if not exists public.login_events (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  user_id    uuid references auth.users(id),
  email      text,
  app        text          -- 'hours'
);
create index if not exists idx_login_app on public.login_events(app);

-- ============================================================
-- Row Level Security — only LOGGED-IN users can read/write.
-- ============================================================
alter table public.members      enable row level security;
alter table public.hours_log    enable row level security;
alter table public.login_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['members','hours_log','login_events'] loop
    execute format('drop policy if exists "auth_all_%1$s" on public.%1$s;', t);
    execute format(
      'create policy "auth_all_%1$s" on public.%1$s
         for all to authenticated
         using (true) with check (true);', t);
  end loop;
end $$;
