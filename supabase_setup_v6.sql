-- ============================================================
-- OPTIX - Supabase schema  v6  (run AFTER v5)
-- ------------------------------------------------------------
-- Lets leadership set the exact number of hours an approved
-- Individual Outreach submission credits toward a member's
-- total (e.g. claimed 8 but credit 6, or approve but credit 0).
-- Safe to re-run.
-- ============================================================

-- ----- credited hours chosen by the reviewer ----------------
alter table public.individual_outreach
  add column if not exists credited_hours numeric(4,1);

-- ============================================================
-- HOURS SUMMARY VIEW  (approved individual outreach now uses
-- the reviewer-set credited_hours, falling back to the claimed
-- hours for rows approved before this column existed; the
-- per-member total is still capped at 6 individual hours)
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
    select user_id, sum(coalesce(credited_hours, hours, 0)) as hours
    from public.individual_outreach where status = 'APPROVED' group by user_id
  ) io on io.user_id = p.id;

grant select on public.hours_summary to authenticated;
