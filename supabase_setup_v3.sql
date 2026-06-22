-- ============================================================
-- OPTIX — Supabase schema  v3   (authoritative for the app)
-- ------------------------------------------------------------
-- Full role model + build / outreach / OPI / purchases /
-- notifications. Safe to re-run. Supersedes the role model in
-- v1/v2 (it normalizes the existing profiles.role values).
--
-- Roles: PENDING < MEMBER < LEADERSHIP < OFFICER < OWNER
-- Bootstrap yourself as OWNER at the bottom of this file.
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  display_name text,
  bio          text,
  avatar_url   text,
  grade        text
);

alter table public.profiles add column if not exists role          text not null default 'PENDING';
alter table public.profiles add column if not exists special_perms text[] not null default '{}';

-- Normalize any legacy lowercase roles from earlier versions.
update public.profiles set role = 'MEMBER'     where role = 'member';
update public.profiles set role = 'LEADERSHIP' where role = 'leadership';
update public.profiles set role = 'PENDING'
  where role is null or role not in ('PENDING','MEMBER','LEADERSHIP','OFFICER','OWNER');

alter table public.profiles drop constraint if exists profiles_role_chk;
alter table public.profiles add  constraint profiles_role_chk
  check (role in ('PENDING','MEMBER','LEADERSHIP','OFFICER','OWNER'));

-- ============================================================
-- ROLE HELPERS  (security definer to avoid recursive RLS)
-- ============================================================
create or replace function public.app_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'PENDING');
$$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_role() in ('MEMBER','LEADERSHIP','OFFICER','OWNER');
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_role() in ('LEADERSHIP','OFFICER','OWNER');
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_role() = 'OWNER';
$$;

-- Keep the v1/v2 name working (policies on hours_log/events reference it).
create or replace function public.is_leadership()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin();
$$;

-- ============================================================
-- BUILD: zones, schedule, check-ins
-- ============================================================
create table if not exists public.build_zones (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  description text,
  gps_lat     double precision,
  gps_lng     double precision,
  gps_radius_m integer default 100,
  qr_token    text,
  active      boolean not null default true
);

create table if not exists public.build_schedule (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),
  zone_id      uuid references public.build_zones(id) on delete set null,
  title        text not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  rrule        text,                       -- iCal RRULE for recurring windows
  is_recurring boolean not null default false,
  short_notice boolean not null default false
);
create index if not exists idx_build_schedule_starts on public.build_schedule(starts_at);

create table if not exists public.build_checkins (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  session_id    uuid references public.build_schedule(id) on delete cascade,
  zone_id       uuid references public.build_zones(id) on delete set null,
  user_id       uuid references auth.users(id),
  method        text not null default 'gps',     -- gps | qr | manual
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  minutes_logged integer,
  lat           double precision,
  lng           double precision
);
create index if not exists idx_build_checkins_user on public.build_checkins(user_id);

-- ============================================================
-- OUTREACH: events, check-ins
-- ============================================================
create table if not exists public.outreach_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  title       text not null,
  description text,
  location    text,
  lat         double precision,
  lng         double precision,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  qr_token    text
);
create index if not exists idx_outreach_starts on public.outreach_events(starts_at);

create table if not exists public.outreach_checkins (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  event_id      uuid references public.outreach_events(id) on delete cascade,
  user_id       uuid references auth.users(id),
  method        text not null default 'gps',
  checked_in_at timestamptz not null default now(),
  minutes_logged integer,
  lat           double precision,
  lng           double precision
);
create index if not exists idx_outreach_checkins_user on public.outreach_checkins(user_id);

-- ============================================================
-- OPI (Optix Passion Initiative)
-- ============================================================
create table if not exists public.opi_initiatives (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id),
  title       text not null,
  description text,
  doc_url     text,
  status      text not null default 'PENDING'
              check (status in ('PENDING','IN_REVIEW','APPROVED','EXECUTED','REJECTED')),
  reviewer_id uuid references auth.users(id)
);
create index if not exists idx_opi_status on public.opi_initiatives(status);

create table if not exists public.opi_comments (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  initiative_id uuid references public.opi_initiatives(id) on delete cascade,
  user_id       uuid references auth.users(id),
  body          text not null
);

-- ============================================================
-- PURCHASES / REIMBURSEMENTS
-- ============================================================
create table if not exists public.purchases (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id),
  kind        text not null default 'reimbursement',  -- purchase | reimbursement
  description text not null,
  amount      numeric(10,2) not null default 0,
  receipt_url text,
  status      text not null default 'PENDING'
              check (status in ('PENDING','APPROVED','REJECTED')),
  reviewer_id uuid references auth.users(id),
  decided_at  timestamptz
);
create index if not exists idx_purchases_status on public.purchases(status);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid references auth.users(id) on delete cascade,
  type       text not null default 'general',
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz
);
create index if not exists idx_notifications_user on public.notifications(user_id);

create table if not exists public.notification_preferences (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  prefs      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- ============================================================
-- HOURS SUMMARY VIEW  (build + outreach minutes -> hours)
-- ============================================================
create or replace view public.hours_summary as
  select
    p.id           as user_id,
    p.display_name,
    round(coalesce(b.minutes, 0) / 60.0, 1)                          as build_hours,
    round(coalesce(o.minutes, 0) / 60.0, 1)                          as outreach_hours,
    round((coalesce(b.minutes, 0) + coalesce(o.minutes, 0)) / 60.0, 1) as total_hours
  from public.profiles p
  left join (
    select user_id, sum(coalesce(minutes_logged, 0)) as minutes
    from public.build_checkins group by user_id
  ) b on b.user_id = p.id
  left join (
    select user_id, sum(coalesce(minutes_logged, 0)) as minutes
    from public.outreach_checkins group by user_id
  ) o on o.user_id = p.id;

grant select on public.hours_summary to authenticated;

-- ============================================================
-- TRIGGERS
-- ============================================================
-- Auto-create a PENDING profile on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (new.id, split_part(coalesce(new.email, 'member'), '@', 1), 'PENDING')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guard privileged profile columns: only admins may change role / special_perms,
-- and only an OWNER may grant OWNER or OFFICER.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Server-side / SQL Editor / service-role (no auth context) bypasses the
  -- guard so the OWNER can be bootstrapped and admin scripts can run.
  if auth.uid() is null then
    return new;
  end if;
  if (new.role is distinct from old.role
      or new.special_perms is distinct from old.special_perms)
     and not public.is_admin() then
    new.role := old.role;
    new.special_perms := old.special_perms;
  end if;
  if new.role in ('OWNER','OFFICER')
     and old.role is distinct from new.role
     and not public.is_owner() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileges_trg on public.profiles;
create trigger guard_profile_privileges_trg
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles                 enable row level security;
alter table public.build_zones              enable row level security;
alter table public.build_schedule           enable row level security;
alter table public.build_checkins           enable row level security;
alter table public.outreach_events          enable row level security;
alter table public.outreach_checkins        enable row level security;
alter table public.opi_initiatives          enable row level security;
alter table public.opi_comments             enable row level security;
alter table public.purchases                enable row level security;
alter table public.notifications            enable row level security;
alter table public.notification_preferences enable row level security;

-- ---- profiles -------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- ---- build_zones / build_schedule: read members, write admin --
drop policy if exists zones_read on public.build_zones;
create policy zones_read on public.build_zones for select to authenticated using (public.is_member());
drop policy if exists zones_write on public.build_zones;
create policy zones_write on public.build_zones for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists sched_read on public.build_schedule;
create policy sched_read on public.build_schedule for select to authenticated using (public.is_member());
drop policy if exists sched_write on public.build_schedule;
create policy sched_write on public.build_schedule for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- build_checkins: own or admin ----------------------------
drop policy if exists bci_read on public.build_checkins;
create policy bci_read on public.build_checkins for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists bci_insert on public.build_checkins;
create policy bci_insert on public.build_checkins for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists bci_update on public.build_checkins;
create policy bci_update on public.build_checkins for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
drop policy if exists bci_delete on public.build_checkins;
create policy bci_delete on public.build_checkins for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---- outreach_events: read members, write admin --------------
drop policy if exists oe_read on public.outreach_events;
create policy oe_read on public.outreach_events for select to authenticated using (public.is_member());
drop policy if exists oe_write on public.outreach_events;
create policy oe_write on public.outreach_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- outreach_checkins: own or admin -------------------------
drop policy if exists oci_read on public.outreach_checkins;
create policy oci_read on public.outreach_checkins for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists oci_insert on public.outreach_checkins;
create policy oci_insert on public.outreach_checkins for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists oci_update on public.outreach_checkins;
create policy oci_update on public.outreach_checkins for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ---- opi_initiatives: own or admin; edit own while PENDING ----
drop policy if exists opi_read on public.opi_initiatives;
create policy opi_read on public.opi_initiatives for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists opi_insert on public.opi_initiatives;
create policy opi_insert on public.opi_initiatives for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists opi_update on public.opi_initiatives;
create policy opi_update on public.opi_initiatives for update to authenticated
  using ((user_id = auth.uid() and status = 'PENDING') or public.is_admin())
  with check ((user_id = auth.uid()) or public.is_admin());

-- ---- opi_comments: visible to initiative owner + admins -------
drop policy if exists opic_read on public.opi_comments;
create policy opic_read on public.opi_comments for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.opi_initiatives i
               where i.id = initiative_id and i.user_id = auth.uid())
  );
drop policy if exists opic_insert on public.opi_comments;
create policy opic_insert on public.opi_comments for insert to authenticated
  with check (
    user_id = auth.uid() and (
      public.is_admin()
      or exists (select 1 from public.opi_initiatives i
                 where i.id = initiative_id and i.user_id = auth.uid())
    )
  );

-- ---- purchases: own or admin; decisions by admin -------------
drop policy if exists pur_read on public.purchases;
create policy pur_read on public.purchases for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists pur_insert on public.purchases;
create policy pur_insert on public.purchases for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists pur_update on public.purchases;
create policy pur_update on public.purchases for update to authenticated
  using ((user_id = auth.uid() and status = 'PENDING') or public.is_admin())
  with check ((user_id = auth.uid()) or public.is_admin());

-- ---- notifications: own; admins may create for anyone --------
drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists notif_insert on public.notifications;
create policy notif_insert on public.notifications for insert to authenticated
  with check (public.is_admin() or user_id = auth.uid());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---- notification_preferences: own only ----------------------
drop policy if exists np_all on public.notification_preferences;
create policy np_all on public.notification_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- BOOTSTRAP: make yourself OWNER (edit email, run once)
-- ============================================================
-- update public.profiles set role = 'OWNER'
--   where id = (select id from auth.users where email = 'you@example.com');
