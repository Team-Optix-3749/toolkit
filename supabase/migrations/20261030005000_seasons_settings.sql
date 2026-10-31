-- Seasons have explicit attribution, not inferred calendar boundaries. Uniform targets
-- are independent of the attendance-manager-controlled individual outreach cap.
alter table public.seasons add column if not exists individual_outreach_cap_minutes numeric not null default 360;
alter table public.seasons add constraint seasons_valid_name check (name = btrim(name) and length(name) > 0);
alter table public.seasons add constraint seasons_valid_targets check (
  outreach_target >= 0 and outreach_target < 'Infinity'::numeric and
  build_target >= 0 and build_target < 'Infinity'::numeric and
  individual_outreach_cap_minutes >= 0 and individual_outreach_cap_minutes < 'Infinity'::numeric
);
create unique index if not exists seasons_trimmed_name_key on public.seasons (btrim(name));
create unique index if not exists baseline_seasons_current_idx on public.seasons (is_current) where is_current;
revoke insert, update, delete, truncate, references, trigger on public.seasons from public, anon, authenticated;

create or replace function public.season_action(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  operation text := payload->>'action';
  season public.seasons;
  target_id uuid;
  field text;
  unknown text[];
  make_current boolean := false;
begin
  if not public.has_perm('manage_seasons') then raise exception 'Manage seasons permission required'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or operation is null or operation not in ('create','edit','set_current') then
    raise exception 'Unknown season action';
  end if;
  select array_agg(key) into unknown from jsonb_object_keys(payload) key
  where not (key = any(case operation
    when 'create' then array['action','name','outreach_target','build_target','is_current']
    when 'edit' then array['action','id','name','outreach_target','build_target']
    else array['action','id'] end));
  if unknown is not null then raise exception 'Unsupported season fields: %', unknown; end if;
  if operation = 'create' or payload ? 'name' then
    if jsonb_typeof(payload->'name') is distinct from 'string' or nullif(btrim(payload->>'name'),'') is null then
      raise exception 'Season name is required';
    end if;
  end if;
  foreach field in array array['outreach_target','build_target'] loop
    if payload ? field and (jsonb_typeof(payload->field) is distinct from 'number' or
      not ((payload->>field)::numeric >= 0 and (payload->>field)::numeric < 'Infinity'::numeric)) then
      raise exception '% must be a finite nonnegative number', field;
    end if;
  end loop;
  if payload ? 'is_current' and jsonb_typeof(payload->'is_current') is distinct from 'boolean' then
    raise exception 'is_current must be a boolean';
  end if;
  -- All season mutations share one lock: concurrent first creation and current
  -- switches cannot commit an ownerless marker or race the unique current index.
  perform pg_advisory_xact_lock(hashtextextended('toolkit.seasons', 0));
  if operation = 'create' then
    make_current := coalesce((payload->>'is_current')::boolean, false)
      or not exists(select 1 from public.seasons);
    if make_current then update public.seasons set is_current = false where is_current; end if;
    insert into public.seasons(name,outreach_target,build_target,is_current)
    values(btrim(payload->>'name'),coalesce((payload->>'outreach_target')::numeric,0),
      coalesce((payload->>'build_target')::numeric,0),make_current)
    returning * into season;
  else
    target_id := (payload->>'id')::uuid;
    if target_id is null then raise exception 'Season id is required'; end if;
    select * into season from public.seasons where id = target_id for update;
    if not found then raise exception 'Season not found'; end if;
    if operation = 'set_current' then
      update public.seasons set is_current = false where is_current and id <> target_id;
      update public.seasons set is_current = true where id = target_id returning * into season;
    else
      update public.seasons set
        name = case when payload ? 'name' then btrim(payload->>'name') else name end,
        outreach_target = case when payload ? 'outreach_target' then (payload->>'outreach_target')::numeric else outreach_target end,
        build_target = case when payload ? 'build_target' then (payload->>'build_target')::numeric else build_target end
      where id = target_id returning * into season;
    end if;
  end if;
  return to_jsonb(season);
end;
$$;
revoke all on function public.season_action(jsonb) from public, anon, authenticated;
grant execute on function public.season_action(jsonb) to authenticated;

-- The policy timezone is not an arbitrary organization preference. Existing
-- legacy defaults are corrected here without touching admission or grants.
insert into public.org_settings(key,value) values('timezone','America/Los_Angeles')
on conflict(key) do update set value = excluded.value, updated_at = now();
alter table public.org_settings add constraint org_settings_canonical_timezone
  check (key <> 'timezone' or value is not distinct from 'America/Los_Angeles');
revoke insert, update, delete, truncate, references, trigger on public.org_settings from public, anon, authenticated;

create or replace function public.settings_action(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  operation text := payload->>'action';
  unknown text[];
  field text;
  result jsonb;
begin
  if not public.is_owner() then raise exception 'President permission required'; end if;
  if jsonb_typeof(payload) is distinct from 'object' or operation is null or operation not in ('get','edit') then
    raise exception 'Unknown settings action';
  end if;
  select array_agg(key) into unknown from jsonb_object_keys(payload) key
  where not (key = any(case operation when 'get' then array['action']
    else array['action','org_name','timezone','build_default_radius_m'] end));
  if unknown is not null then raise exception 'Unsupported settings fields: %', unknown; end if;
  if operation = 'edit' then
    if payload ? 'org_name' and (jsonb_typeof(payload->'org_name') is distinct from 'string' or nullif(btrim(payload->>'org_name'),'') is null) then
      raise exception 'Organization name is required';
    end if;
    if payload ? 'timezone' and (jsonb_typeof(payload->'timezone') is distinct from 'string' or payload->>'timezone' <> 'America/Los_Angeles') then
      raise exception 'Timezone must be America/Los_Angeles';
    end if;
    if payload ? 'build_default_radius_m' and (jsonb_typeof(payload->'build_default_radius_m') is distinct from 'number' or
      not ((payload->>'build_default_radius_m')::numeric > 0 and (payload->>'build_default_radius_m')::numeric < 'Infinity'::numeric)) then
      raise exception 'Build default radius must be a finite positive number';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('toolkit.settings', 0));
    foreach field in array array['org_name','timezone','build_default_radius_m'] loop
      if payload ? field then
        insert into public.org_settings(key,value) values(field,case when field = 'org_name' then btrim(payload->>field) else payload->>field end)
        on conflict(key) do update set value = excluded.value, updated_at = now();
      end if;
    end loop;
  end if;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into result from public.org_settings
  where key in ('org_name','timezone','build_default_radius_m');
  return result;
end;
$$;
revoke all on function public.settings_action(jsonb) from public, anon, authenticated;
grant execute on function public.settings_action(jsonb) to authenticated;

-- Preserve the interim aggregate contract and its authorization filter, but do
-- not round authoritative computation. Season-specific reporting replaces this
-- legacy projection in the reporting cutover; its existing cap is unchanged here.
create or replace view public.hours_summary with (security_invoker=false,security_barrier=true) as
select p.id as user_id,p.display_name,
  coalesce(b.minutes,0)/60.0 as build_hours,
  (coalesce(o.minutes,0)+least(coalesce(i.hours,0),6)*60)/60.0 as outreach_hours,
  (coalesce(b.minutes,0)+coalesce(o.minutes,0)+least(coalesce(i.hours,0),6)*60)/60.0 as total_hours
from public.profiles p
left join (select member_id,sum(coalesce(credited_minutes,0)) as minutes from public.build_records where credit_enabled group by member_id) b on b.member_id=p.id
left join (select member_id,sum(coalesce(credited_minutes,0)) as minutes from public.outreach_attendance where credit_enabled group by member_id) o on o.member_id=p.id
left join (select user_id,sum(coalesce(credited_hours,hours,0)) as hours from public.individual_outreach where status='APPROVED' group by user_id) i on i.user_id=p.id
where public.is_member() and p.role<>'PENDING'
  and (p.id=auth.uid() or public.has_perm('manage_accounts') or public.has_perm('export_records'));
