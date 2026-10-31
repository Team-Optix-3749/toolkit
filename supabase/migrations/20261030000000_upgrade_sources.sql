-- Atomic catalog-gated source capture. Supplied corrections are installed only by
-- scripts/upgrade-local.mjs after its read-only preflight succeeds.
create schema if not exists toolkit_upgrade;
revoke all on schema toolkit_upgrade from public, anon, authenticated;
create table if not exists toolkit_upgrade.source_rows (
  source_table text not null,
  source_key text not null,
  payload jsonb not null,
  primary key (source_table, source_key)
);
create table if not exists toolkit_upgrade.corrections (
  target_table text not null, target_id text not null, patch jsonb not null,
  primary key(target_table,target_id)
);
revoke all on all tables in schema toolkit_upgrade from public, anon, authenticated;
create or replace function toolkit_upgrade.map_row(source text, value jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare result jsonb := value; pair text[]; pairs text[][] := '{}';
begin
  case source
    when 'build_zones' then pairs := array[['gps_lat','latitude'],['gps_lng','longitude'],['gps_radius_m','radius_m']];
    when 'build_schedule' then pairs := array[['starts_at','opens_at'],['ends_at','closes_at'],['zone_id','location_id']];
    when 'build_checkins' then pairs := array[['user_id','member_id'],['checked_in_at','check_in'],['checked_out_at','check_out']];
    when 'outreach_planned_attendance' then pairs := array[['user_id','member_id']];
    when 'outreach_checkins' then pairs := array[['user_id','member_id'],['checked_in_at','arrival'],['departed_at','departure']];
    when 'opi_initiatives' then pairs := array[['user_id','submitter_id'],['description','summary'],['doc_url','document_url'],['linked_event_id','event_id']];
    when 'opi_comments' then pairs := array[['initiative_id','opi_id'],['body','feedback']];
    else null;
  end case;
  if cardinality(pairs)>0 then
    foreach pair slice 1 in array pairs loop
      if result ? pair[1] then result := (result - pair[1]) || jsonb_build_object(pair[2], result->pair[1]); end if;
    end loop;
  end if;
  if source = 'outreach_events' then
    result := result || jsonb_build_object('latitude',coalesce(nullif(result->'latitude','null'),result->'lat'),'longitude',coalesce(nullif(result->'longitude','null'),result->'lng'));
    result := result - 'lat' - 'lng' - 'lead_ids';
  end if;
  if source in ('build_checkins','build_records') then
    result := result || jsonb_build_object('checkout_method',case
      when (result->>'automatically_closed')::boolean is true then 'automatic'
      when result->>'checkout_method' in ('auto','automatic') then 'automatic'
      when result->>'checkout_method' in ('admin','correction','administrative correction') then 'administrative correction'
      else 'member' end);
    if result->>'check_out' is not null then result := result || jsonb_build_object('credited_minutes',extract(epoch from ((result->>'check_out')::timestamptz-(result->>'check_in')::timestamptz))/60); end if;
  end if;
  if source in ('outreach_checkins','outreach_attendance') and result->>'departure' is not null then
    result := result || jsonb_build_object('credited_minutes',extract(epoch from ((result->>'departure')::timestamptz-(result->>'arrival')::timestamptz))/60);
  end if;
  return result;
end $$;
create or replace function toolkit_upgrade.target_name(source text) returns text
language sql immutable set search_path = '' as $$
 select case source when 'build_zones' then 'build_locations' when 'build_schedule' then 'build_sessions'
 when 'build_checkins' then 'build_records' when 'outreach_planned_attendance' then 'outreach_rsvps'
 when 'outreach_checkins' then 'outreach_attendance' when 'opi_initiatives' then 'opis'
 when 'opi_comments' then 'opi_feedback' else source end;
$$;
revoke all on all functions in schema toolkit_upgrade from public, anon, authenticated;
do $$
declare t record; r record; patch record; supplied jsonb := coalesce(nullif(current_setting('toolkit.upgrade_mapping',true),''),'{}')::jsonb;
  target text; mapped jsonb; field text; required text[]; existing jsonb; source_key_value text;
begin
  for t in select tablename from pg_tables where schemaname='public' loop
    if t.tablename not in (
      'seasons','profiles','invitations','groups','group_members','task_groups','tasks','task_assignees','task_assigned_groups','task_reviewers','task_evidence','task_history','task_submissions',
      'members','login_events','events','event_checkins','hours_log','individual_outreach','purchases','notifications','notification_preferences','notification_templates','org_settings','email_templates','qr_tokens',
      'build_locations','build_sessions','build_records','build_qr_tokens','outreach_events','outreach_leads','outreach_rsvps','outreach_attendance','opis','opi_versions','opi_feedback',
      'build_zones','build_schedule','build_checkins','outreach_planned_attendance','outreach_checkins','opi_initiatives','opi_comments',
      'scout_events','scout_event_members','scout_schedule','scout_assignments','scout_match_entries','scout_pit_entries','scout_matches','scout_pits','match_scouting','pit_scouting','scout_match_schedule','scout_match_assignments','scout_pit_assignments','scout_event_schedule','scout_event_assignments') then
      raise exception 'Unrecognized public table: %. Run read-only preflight; source untouched.',t.tablename;
    end if;
    for r in execute format('select to_jsonb(s) as value from public.%I s',t.tablename) loop
      source_key_value := coalesce(r.value->>'id',concat_ws(':',coalesce(r.value->>'event_id',r.value->>'task_id',r.value->>'group_id',r.value->>'key'),coalesce(r.value->>'member_id',r.value->>'user_id')));
      insert into toolkit_upgrade.source_rows values(t.tablename,source_key_value,r.value);
    end loop;
  end loop;
  if exists(select 1 from toolkit_upgrade.source_rows) and current_setting('toolkit.upgrade_validated',true) is distinct from 'yes' then
    raise exception 'Existing data requires scripts/upgrade-local.mjs --mapping <json> --apply after read-only preflight. Source untouched.';
  end if;
  for t in select key,value from jsonb_each(supplied) loop
    for patch in select key,value from jsonb_each(t.value) loop
      insert into toolkit_upgrade.corrections values(t.key,patch.key,patch.value);
    end loop;
  end loop;
  -- No CLI upgrade may bypass explicit association mapping, even without the JS runner.
  for r in select * from toolkit_upgrade.source_rows loop
    target := toolkit_upgrade.target_name(r.source_table);
    mapped := toolkit_upgrade.map_row(r.source_table,r.payload) || coalesce(supplied->target->r.source_key,'{}');
    required := case target
      when 'profiles' then array['display_name','account_type']
      when 'build_locations' then array['name']
      when 'build_sessions' then array['title','location_id','season_id','opens_at','closes_at']
      when 'build_records' then array['member_id','session_id','check_in']
      when 'outreach_events' then array['title','location','season_id','starts_at','ends_at']
      when 'outreach_attendance' then array['member_id','event_id','arrival']
      when 'individual_outreach' then array['season_id']
      when 'tasks' then array['season_id','owner_group_id']
      when 'opis' then array['season_id','submitter_id'] else array[]::text[] end;
    foreach field in array required loop
      if nullif(mapped->>field,'') is null then raise exception 'Mapping required: %.%.% (source value %). Source untouched.',target,r.source_key,field,r.payload->field; end if;
    end loop;
    if target='profiles' and mapped->>'account_type' not in ('member','mentor') then raise exception 'Invalid account_type: %',r.source_key; end if;
  end loop;
  for t in select tablename from pg_tables where schemaname='public' and tablename in
    ('build_zones','build_schedule','build_checkins','outreach_planned_attendance','outreach_checkins','opi_initiatives','opi_comments','members','events','event_checkins','hours_log') loop
    execute format('alter table public.%I set schema toolkit_upgrade',t.tablename);
  end loop;
end $$;
