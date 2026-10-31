create or replace function public.season_hours(payload jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path='' as $$
declare season public.seasons;members jsonb;inactive boolean:=coalesce((payload->>'include_inactive')::boolean,false);
begin
 if not public.is_member() then raise exception 'Active verified session required';end if;
 if inactive and not(public.has_perm('manage_accounts') or public.has_perm('export_records')) then raise exception 'Inactive directory authority required';end if;
 if payload?'season_id' then select * into season from public.seasons where id=(payload->>'season_id')::uuid;if not found then raise exception 'Season not found';end if;else select * into season from public.seasons where is_current;end if;
 if season.id is null then return jsonb_build_object('season',null,'members','[]'::jsonb);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'build_minutes',coalesce(b.minutes,0),'event_outreach_minutes',coalesce(o.minutes,0),'individual_approved_minutes',coalesce(i.minutes,0),'individual_counted_minutes',least(coalesce(i.minutes,0),season.individual_outreach_cap_minutes),'outreach_minutes',coalesce(o.minutes,0)+least(coalesce(i.minutes,0),season.individual_outreach_cap_minutes)) order by p.display_name,p.id),'[]') into members
 from public.profiles p
 left join(select r.member_id,sum(case when r.check_out is null and s.closes_at<=now() then extract(epoch from(s.closes_at-r.check_in))/60 else r.credited_minutes end) minutes from public.build_records r join public.build_sessions s on s.id=r.session_id where s.season_id=season.id and r.credit_enabled group by r.member_id)b on b.member_id=p.id
 left join(select a.member_id,sum(a.credited_minutes) minutes from public.outreach_attendance a join public.outreach_events e on e.id=a.event_id where e.season_id=season.id and a.credit_enabled group by a.member_id)o on o.member_id=p.id
 left join(select user_id,sum(approved_minutes) minutes from public.individual_outreach where season_id=season.id and status='APPROVED' group by user_id)i on i.user_id=p.id
 where p.role<>'PENDING' and(p.account_status='active' or inactive or(not season.is_current and(b.member_id is not null or o.member_id is not null or i.user_id is not null)));
 return jsonb_build_object('season',to_jsonb(season),'members',members);
end $$;
create or replace function public.export_records(payload jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare kind text:=payload->>'record_type';rows jsonb;last_at timestamptz;last_id uuid;count_rows integer;
begin
 if not public.has_perm('export_records') then raise exception 'Export records permission required';end if;
 if kind not in('outreach','build','individual') or kind is null then raise exception 'Unknown export type';end if;
 if(payload?'from' and payload->>'from'!~'(Z|[+-][0-9]{2}:[0-9]{2})$') or(payload?'to' and payload->>'to'!~'(Z|[+-][0-9]{2}:[0-9]{2})$') then raise exception 'Offset-qualified filter timestamps required';end if;
 if payload?'from' and payload?'to' and(payload->>'to')::timestamptz<=(payload->>'from')::timestamptz then raise exception 'Invalid export interval';end if;
 select coalesce(jsonb_agg(value order by at,id),'[]'),(array_agg(at order by at desc,id desc))[1],(array_agg(id order by at desc,id desc))[1],count(*) into rows,last_at,last_id,count_rows from(
 select * from(
 select a.arrival at,a.id,jsonb_build_object('Season',s.name,'Event',e.title,'Member name',p.display_name,'Arrival',a.arrival,'Departure',a.departure,'Credited minutes',a.credited_minutes,'Attendance status',case when a.departure is null then 'present' else 'completed' end,'Event status',case when e.cancelled then 'Cancelled' when now()<e.starts_at then 'Scheduled' when now()<e.ends_at then 'In progress' else 'Completed' end) value
 from public.outreach_attendance a join public.outreach_events e on e.id=a.event_id join public.seasons s on s.id=e.season_id join public.profiles p on p.id=a.member_id
 where kind='outreach' and(not(payload?'season_id') or s.id=(payload->>'season_id')::uuid) and(not(payload?'member_id') or p.id=(payload->>'member_id')::uuid) and(not(payload?'event_id') or e.id=(payload->>'event_id')::uuid)
 union all
 select r.check_in,r.id,jsonb_build_object('Season',s.name,'Build location',l.name,'Build session',b.title,'Member name',p.display_name,'Check-in',r.check_in,'Check-out',r.check_out,'Credited minutes',case when not r.credit_enabled then 0 when r.check_out is null and b.closes_at<=now() then extract(epoch from(b.closes_at-r.check_in))/60 else r.credited_minutes end,'Checkout method',case when r.check_out is null then '' else r.checkout_method end,'Session status',case when b.cancelled then 'Cancelled' when now()<b.opens_at then 'Scheduled' when now()<b.closes_at then 'In progress' else 'Completed' end)
 from public.build_records r join public.build_sessions b on b.id=r.session_id join public.build_locations l on l.id=b.location_id join public.seasons s on s.id=b.season_id join public.profiles p on p.id=r.member_id
 where kind='build' and(not(payload?'season_id') or s.id=(payload->>'season_id')::uuid) and(not(payload?'member_id') or p.id=(payload->>'member_id')::uuid) and(not(payload?'session_id') or b.id=(payload->>'session_id')::uuid)
 union all
 select(i.event_date::timestamp at time zone 'America/Los_Angeles'),i.id,jsonb_build_object('Season',s.name,'Member name',p.display_name,'Request',i.event_name,'Event date',i.event_date,'Claimed minutes',i.claimed_minutes,'Approved minutes',i.approved_minutes,'Status',i.status)
 from public.individual_outreach i join public.seasons s on s.id=i.season_id join public.profiles p on p.id=i.user_id
 where kind='individual' and(not(payload?'season_id') or s.id=(payload->>'season_id')::uuid) and(not(payload?'member_id') or p.id=(payload->>'member_id')::uuid)
 ) source where(not(payload?'from') or at>=(payload->>'from')::timestamptz) and(not(payload?'to') or at<(payload->>'to')::timestamptz)
 and(not(payload?'cursor') or(at,id)>((payload->'cursor'->>'at')::timestamptz,(payload->'cursor'->>'id')::uuid)) order by at,id limit 500) page;
 return jsonb_build_object('rows',rows,'next_cursor',case when count_rows=500 then jsonb_build_object('at',last_at,'id',last_id) else null end);
end $$;
revoke all on function public.season_hours(jsonb),public.export_records(jsonb) from public,anon,authenticated;
grant execute on function public.season_hours(jsonb),public.export_records(jsonb) to authenticated;
drop view public.hours_summary;
