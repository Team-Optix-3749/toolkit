-- ============================================================
-- OPTIX — Supabase schema  v4  (run AFTER v3)
-- ------------------------------------------------------------
-- Adds owner-area backing: org_settings, email_templates,
-- the receipts storage bucket, and list_cron_jobs(). Safe to re-run.
-- ============================================================

-- ----- org settings (key/value) ----------------------------
create table if not exists public.org_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
alter table public.org_settings enable row level security;
drop policy if exists org_settings_read on public.org_settings;
create policy org_settings_read on public.org_settings for select to authenticated
  using (public.is_admin());
drop policy if exists org_settings_write on public.org_settings;
create policy org_settings_write on public.org_settings for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

insert into public.org_settings (key, value) values
  ('org_name', 'Optix Robotics'),
  ('timezone', 'America/Chicago'),
  ('build_default_radius_m', '100')
on conflict (key) do nothing;

-- ----- email templates (Resend) -----------------------------
create table if not exists public.email_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  subject    text,
  body       text,
  updated_at timestamptz not null default now()
);
alter table public.email_templates enable row level security;
drop policy if exists email_templates_all on public.email_templates;
create policy email_templates_all on public.email_templates for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ----- receipts storage bucket ------------------------------
insert into storage.buckets (id, name, public)
  values ('receipts', 'receipts', true)
  on conflict (id) do nothing;

drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts');
drop policy if exists receipts_read on storage.objects;
create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts');
drop policy if exists receipts_delete on storage.objects;
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (owner = auth.uid() or public.is_admin()));

-- ----- list_cron_jobs(): safe even when pg_cron is absent ---
create or replace function public.list_cron_jobs()
returns table(jobid bigint, jobname text, schedule text, active boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    return;
  end if;
  if to_regclass('cron.job') is null then
    return;  -- pg_cron not installed
  end if;
  return query execute 'select jobid, jobname, schedule, active from cron.job';
end;
$$;
grant execute on function public.list_cron_jobs() to authenticated;
