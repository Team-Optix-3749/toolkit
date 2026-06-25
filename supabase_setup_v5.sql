-- ============================================================
-- OPTIX - Supabase schema  v5  (run AFTER v4)
-- ------------------------------------------------------------
-- Adds Individual Outreach Hours: members submit a form with
-- photo/video proof, leadership approves/rejects, and approved
-- hours (capped at 6 total per member) fold into outreach hours.
-- Also: profiles.department, signup display-name from metadata.
-- Safe to re-run.
-- ============================================================

-- ----- profiles.department ----------------------------------
alter table public.profiles add column if not exists department text;

-- ============================================================
-- INDIVIDUAL OUTREACH HOURS
-- ============================================================
create table if not exists public.individual_outreach (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid references auth.users(id),
  full_name       text not null,
  department      text,                              -- Build | Technology | Business | Outreach
  event_name      text not null,
  what_you_did    text not null,
  impact          text not null,                     -- how it helped the community
  hours           numeric(4,1) not null default 0,   -- full hours claimed (credit capped at 6)
  event_date      date not null,
  proof_urls      text[] not null default '{}',      -- up to 5 image/video URLs
  people_impacted integer,
  status          text not null default 'PENDING'
                  check (status in ('PENDING','APPROVED','REJECTED')),
  reviewer_id     uuid references auth.users(id),
  decided_at      timestamptz
);
create index if not exists idx_individual_outreach_status on public.individual_outreach(status);
create index if not exists idx_individual_outreach_user on public.individual_outreach(user_id);

alter table public.individual_outreach enable row level security;

-- own or admin; insert own; edit own while PENDING, decisions by admin
drop policy if exists io_read on public.individual_outreach;
create policy io_read on public.individual_outreach for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists io_insert on public.individual_outreach;
create policy io_insert on public.individual_outreach for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists io_update on public.individual_outreach;
create policy io_update on public.individual_outreach for update to authenticated
  using ((user_id = auth.uid() and status = 'PENDING') or public.is_admin())
  with check ((user_id = auth.uid()) or public.is_admin());
drop policy if exists io_delete on public.individual_outreach;
create policy io_delete on public.individual_outreach for delete to authenticated
  using ((user_id = auth.uid() and status = 'PENDING') or public.is_admin());

-- ----- outreach-proofs storage bucket -----------------------
insert into storage.buckets (id, name, public)
  values ('outreach-proofs', 'outreach-proofs', true)
  on conflict (id) do nothing;

drop policy if exists outreach_proofs_insert on storage.objects;
create policy outreach_proofs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'outreach-proofs');
drop policy if exists outreach_proofs_read on storage.objects;
create policy outreach_proofs_read on storage.objects for select to authenticated
  using (bucket_id = 'outreach-proofs');
drop policy if exists outreach_proofs_delete on storage.objects;
create policy outreach_proofs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'outreach-proofs' and (owner = auth.uid() or public.is_admin()));

-- ============================================================
-- HOURS SUMMARY VIEW  (build + outreach check-ins + approved
-- individual outreach, capped at 6 hrs of individual credit)
-- ============================================================
create or replace view public.hours_summary as
  select
    p.id           as user_id,
    p.display_name,
    round(coalesce(b.minutes, 0) / 60.0, 1)                                            as build_hours,
    round((coalesce(o.minutes, 0) + least(coalesce(io.hours, 0), 6) * 60) / 60.0, 1)   as outreach_hours,
    round((coalesce(b.minutes, 0) + coalesce(o.minutes, 0)
           + least(coalesce(io.hours, 0), 6) * 60) / 60.0, 1)                          as total_hours
  from public.profiles p
  left join (
    select user_id, sum(coalesce(minutes_logged, 0)) as minutes
    from public.build_checkins group by user_id
  ) b on b.user_id = p.id
  left join (
    select user_id, sum(coalesce(minutes_logged, 0)) as minutes
    from public.outreach_checkins group by user_id
  ) o on o.user_id = p.id
  left join (
    select user_id, sum(coalesce(hours, 0)) as hours
    from public.individual_outreach where status = 'APPROVED' group by user_id
  ) io on io.user_id = p.id;

grant select on public.hours_summary to authenticated;

-- ============================================================
-- SIGNUP DISPLAY NAME  (use the name chosen at signup, falling
-- back to an OAuth-provided name, then the email prefix)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, 'member'), '@', 1)
    ),
    'PENDING'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
