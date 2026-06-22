-- ============================================================
-- HOURS — Supabase schema  v2  (run AFTER supabase_setup.sql)
-- ------------------------------------------------------------
-- Adds: profiles (bio / pfp / role / public-hours toggle),
-- events (team meetings + outreach), event check-ins,
-- leadership hour awards, and a public ranking view.
--
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES  (one row per auth user)
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  created_at   timestamptz default now(),
  display_name text,
  bio          text,
  avatar_url   text,
  grade        text,
  role         text not null default 'member',     -- 'member' | 'leadership'
  hours_public boolean not null default false      -- only meaningful for members
);

-- ============================================================
-- HOURS_LOG — add award metadata (table created in v1)
-- ============================================================
alter table public.hours_log add column if not exists source     text default 'self';   -- 'self' | 'award'
alter table public.hours_log add column if not exists reason      text;
alter table public.hours_log add column if not exists awarded_by  uuid references auth.users(id);

-- ============================================================
-- EVENTS — team meetings + outreach / OPI events
-- ============================================================
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz default now(),
  created_by  uuid references auth.users(id),
  title       text not null,
  description text,
  type        text not null default 'meeting',     -- 'meeting' | 'outreach'
  location    text,
  start_at    timestamptz not null default now(),
  end_at      timestamptz
);
create index if not exists idx_events_start on public.events(start_at);
create index if not exists idx_events_type  on public.events(type);

-- ============================================================
-- EVENT CHECK-INS — location-aware check-in for outreach events
-- ============================================================
create table if not exists public.event_checkins (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  event_id     uuid references public.events(id) on delete cascade,
  user_id      uuid references auth.users(id),
  display_name text,
  location     text,          -- free text and/or "lat,lng"
  lat          double precision,
  lng          double precision,
  note         text
);
create index if not exists idx_checkins_event on public.event_checkins(event_id);
create index if not exists idx_checkins_user  on public.event_checkins(user_id);

-- ============================================================
-- HELPERS
-- ============================================================
-- security definer so it can read profiles without tripping
-- the profiles RLS policies (avoids infinite recursion).
create or replace function public.is_leadership()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'leadership'
  );
$$;

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email, 'member'), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Stop non-leadership from promoting themselves: keep role unchanged
-- on self-updates unless the editor is leadership.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role) and not public.is_leadership() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role_trg on public.profiles;
create trigger guard_profile_role_trg
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.events         enable row level security;
alter table public.event_checkins enable row level security;

-- ----- profiles ---------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_leadership())
  with check (id = auth.uid() or public.is_leadership());

-- ----- hours_log (replace the v1 blanket policy) ------------
drop policy if exists "auth_all_hours_log" on public.hours_log;

drop policy if exists hours_select on public.hours_log;
create policy hours_select on public.hours_log
  for select to authenticated
  using (created_by = auth.uid() or public.is_leadership());

drop policy if exists hours_insert on public.hours_log;
create policy hours_insert on public.hours_log
  for insert to authenticated
  with check (created_by = auth.uid() or public.is_leadership());

drop policy if exists hours_update on public.hours_log;
create policy hours_update on public.hours_log
  for update to authenticated
  using (created_by = auth.uid() or public.is_leadership())
  with check (created_by = auth.uid() or public.is_leadership());

drop policy if exists hours_delete on public.hours_log;
create policy hours_delete on public.hours_log
  for delete to authenticated
  using (created_by = auth.uid() or public.is_leadership());

-- ----- events -----------------------------------------------
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated using (true);

drop policy if exists events_write on public.events;
create policy events_write on public.events
  for all to authenticated
  using (public.is_leadership())
  with check (public.is_leadership());

-- ----- event_checkins ---------------------------------------
drop policy if exists checkins_select on public.event_checkins;
create policy checkins_select on public.event_checkins
  for select to authenticated
  using (user_id = auth.uid() or public.is_leadership());

drop policy if exists checkins_insert on public.event_checkins;
create policy checkins_insert on public.event_checkins
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists checkins_delete on public.event_checkins;
create policy checkins_delete on public.event_checkins
  for delete to authenticated
  using (user_id = auth.uid() or public.is_leadership());

-- ============================================================
-- PUBLIC RANKING VIEW
-- ------------------------------------------------------------
-- Only non-leadership members who opted in (hours_public = true)
-- appear. Runs as the view owner so it can aggregate across
-- members regardless of per-row hours_log RLS — this is the one
-- place totals are intentionally shared.
-- ============================================================
create or replace view public.public_rankings as
  select
    p.id,
    p.display_name,
    p.avatar_url,
    coalesce(sum(h.hours), 0)                                          as total_hours,
    coalesce(sum(h.hours) filter (where h.type = 'build'),    0)       as build_hours,
    coalesce(sum(h.hours) filter (where h.type = 'outreach'), 0)       as outreach_hours
  from public.profiles p
  left join public.hours_log h on h.created_by = p.id
  where p.hours_public = true and p.role <> 'leadership'
  group by p.id, p.display_name, p.avatar_url
  order by total_hours desc;

grant select on public.public_rankings to authenticated;

-- ============================================================
-- BOOTSTRAP: make yourself leadership (edit the email, run once)
-- ============================================================
-- update public.profiles set role = 'leadership'
--   where id = (select id from auth.users where email = 'you@example.com');
