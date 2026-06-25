-- ============================================================
-- FIX: force-promote your account to OWNER (handles ALL guards)
-- ------------------------------------------------------------
-- Disables EVERY user trigger on profiles (so no guard - whatever its
-- name - can revert the change), promotes you, re-enables triggers,
-- then removes the stale v2 guard and re-patches the v3 guard.
-- Run the whole file at once.
--
-- >>> EDIT the email ONCE on the `lower(u.email) = ...` line. <<<
-- ============================================================

-- 1) Turn off all user triggers on the table for this update.
alter table public.profiles disable trigger user;

update public.profiles p
set role = 'OWNER'
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('adroit.shourya@gmail.com')   -- <<< your email
returning u.email, p.role;

alter table public.profiles enable trigger user;

-- 2) Drop the stale v2 guard (different name) so it stops interfering.
drop trigger  if exists guard_profile_role_trg on public.profiles;
drop function if exists public.guard_profile_role();

-- 3) Re-patch the v3 guard so future SQL-Editor bootstraps also work.
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

-- 4) Final check - should show OWNER.
select p.role, u.email
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('adroit.shourya@gmail.com');     -- <<< your email
