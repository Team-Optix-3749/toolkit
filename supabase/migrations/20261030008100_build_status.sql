create or replace function public.build_scheduler_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare job record; matches bigint;
begin
 if not public.has_perm('manage_build_hours') then raise exception 'Manage build hours permission required';end if;
 if not exists(select 1 from pg_extension where extname='pg_cron') or to_regclass('cron.job') is null then return jsonb_build_object('state','unavailable');end if;
 execute 'select active,schedule from cron.job where jobname=$1' into job using 'auto-checkout';
 get diagnostics matches = row_count;
 if matches=0 then return jsonb_build_object('state','missing');end if;
 return jsonb_build_object('state',case when job.active then 'healthy' else 'inactive' end,'schedule',job.schedule);
end $$;
revoke all on function public.build_scheduler_status() from public,anon,authenticated;
grant execute on function public.build_scheduler_status() to authenticated;

create or replace view public.hours_summary with (security_invoker=false,security_barrier=true) as
select p.id as user_id,p.display_name,coalesce(b.minutes,0)/60.0 as build_hours,
 (coalesce(o.minutes,0)+coalesce(i.minutes,0))/60.0 as outreach_hours,
 (coalesce(b.minutes,0)+coalesce(o.minutes,0)+coalesce(i.minutes,0))/60.0 as total_hours
from public.profiles p
left join (select r.member_id,sum(case when r.check_out is null and s.closes_at<=now() then extract(epoch from(s.closes_at-r.check_in))/60.0 else r.credited_minutes end) as minutes from public.build_records r join public.build_sessions s on s.id=r.session_id where r.credit_enabled group by r.member_id) b on b.member_id=p.id
left join (select a.member_id,sum(a.credited_minutes) as minutes from public.outreach_attendance a where a.credit_enabled group by a.member_id) o on o.member_id=p.id
left join (select credits.user_id,sum(least(credits.minutes,s.individual_outreach_cap_minutes)) as minutes from
 (select user_id,season_id,sum(approved_minutes) as minutes from public.individual_outreach where status='APPROVED' group by user_id,season_id) credits
 join public.seasons s on s.id=credits.season_id group by credits.user_id) i on i.user_id=p.id
where public.is_member() and p.role<>'PENDING' and(p.id=auth.uid() or public.has_perm('manage_accounts') or public.has_perm('export_records'));
