-- Import validated sources without compatibility aliases or duplicate official rows.
-- All unmapped fields remain private in toolkit_upgrade.source_rows.
create or replace function toolkit_upgrade.import_row(target text, value jsonb) returns void
language plpgsql set search_path = '' as $$
declare columns_sql text; values_sql text; names text[]; existing jsonb; k text; differs text[]; compared jsonb; source_value jsonb; normalized_value jsonb;
begin
  select array_agg(c.column_name order by c.ordinal_position) into names
  from information_schema.columns c where c.table_schema='public' and c.table_name=target and value ? c.column_name;
  if names is null then raise exception 'No mapped columns for %',target; end if;
  if value ? 'id' then
    execute format('select to_jsonb(t) from public.%I t where id = $1::uuid',target) into existing using value->>'id';
  elsif value ? 'event_id' and value ? 'member_id' then
    execute format('select to_jsonb(t) from public.%I t where event_id = $1::uuid and member_id = $2::uuid',target) into existing using value->>'event_id',value->>'member_id';
  end if;
  if existing is not null then
    compared := toolkit_upgrade.map_row(target,existing);
    select array_agg(e.key) into differs from jsonb_each(value) e where e.key=any(names) and compared ? e.key and compared->e.key is distinct from e.value;
    if differs is not null then raise exception 'Conflicting duplicate %.% fields %; source untouched',target,value->>'id',differs; end if;
    return;
  end if;
  select string_agg(format('%I',name),','), string_agg(format('(jsonb_populate_record(null::public.%I,$1)).%I',target,name),',') into columns_sql,values_sql from unnest(names) name;
  execute format('insert into public.%I (%s) select %s',target,columns_sql,values_sql) using value;
end $$;
revoke all on function toolkit_upgrade.import_row(text,jsonb) from public,anon,authenticated;
do $$
declare r record; p record; mapped jsonb; target text; columns_sql text; link text; v uuid;
begin
  -- Apply only supplied corrections. Each field is constrained by the local preflight.
  for p in select * from toolkit_upgrade.corrections loop
    if p.target_table not in ('profiles','build_locations','build_sessions','outreach_events','build_records','outreach_attendance','tasks','individual_outreach','opis') then raise exception 'Unsupported correction table %',p.target_table; end if;
    select string_agg(format('%I = (jsonb_populate_record(null::public.%I,$1)).%I',c.column_name,p.target_table,c.column_name),',') into columns_sql
    from information_schema.columns c where c.table_schema='public' and c.table_name=p.target_table and p.patch ? c.column_name;
    if columns_sql is not null then execute format('update public.%I set %s where id=$2::uuid',p.target_table,columns_sql) using p.patch,p.target_id; end if;
  end loop;
  for r in select s.* from toolkit_upgrade.source_rows s
    where source_table in ('build_zones','build_schedule','build_checkins','outreach_planned_attendance','outreach_checkins','opi_initiatives','opi_comments')
    order by array_position(array['build_zones','build_schedule','build_checkins','outreach_planned_attendance','outreach_checkins','opi_initiatives','opi_comments'],source_table),source_key loop
    target := toolkit_upgrade.target_name(r.source_table);
    mapped := toolkit_upgrade.map_row(r.source_table,r.payload) || coalesce((select patch from toolkit_upgrade.corrections c where c.target_table=target and c.target_id=r.source_key),'{}');
    if target='build_records' and mapped->>'check_out' is not null then mapped := mapped || jsonb_build_object('credited_minutes',extract(epoch from ((mapped->>'check_out')::timestamptz-(mapped->>'check_in')::timestamptz))/60); end if;
    if target='outreach_attendance' and mapped->>'departure' is not null then mapped := mapped || jsonb_build_object('credited_minutes',extract(epoch from ((mapped->>'departure')::timestamptz-(mapped->>'arrival')::timestamptz))/60); end if;
    perform toolkit_upgrade.import_row(target,mapped);
    if target='opis' then
      -- One actual available legacy snapshot, never invented revision history.
      if not exists(select 1 from public.opi_versions where opi_id=(mapped->>'id')::uuid) then
        perform toolkit_upgrade.import_row('opi_versions',jsonb_build_object('id',gen_random_uuid(),'opi_id',mapped->'id','title',mapped->'title','summary',mapped->'summary','document_url',mapped->'document_url','submitted_at',mapped->'created_at'));
      end if;
    end if;
  end loop;
  for r in select * from toolkit_upgrade.source_rows where source_table='outreach_events' loop
    update public.outreach_events set latitude=coalesce(latitude,(r.payload->>'lat')::double precision),longitude=coalesce(longitude,(r.payload->>'lng')::double precision) where id=(r.payload->>'id')::uuid;
    for link in select jsonb_array_elements_text(coalesce(r.payload->'lead_ids','[]')) loop
      insert into public.outreach_leads(event_id,member_id) values((r.payload->>'id')::uuid,link::uuid) on conflict do nothing;
    end loop;
  end loop;
  -- Numeric elapsed minutes are authoritative. Raw rounded caches remain private.
  update public.build_records set credited_minutes=extract(epoch from (check_out-check_in))/60 where check_out is not null;
  update public.outreach_attendance set credited_minutes=extract(epoch from (departure-arrival))/60 where departure is not null;
  if exists(select 1 from public.profiles) and (select count(*) from public.profiles where role='OWNER')<>1 then raise exception 'Exactly one explicitly selected President required'; end if;
end $$;
-- Existing constraints become fully validated only after all sources are mapped.
do $$ declare c record; begin
  for c in select n.nspname,t.relname,k.conname from pg_constraint k join pg_class t on t.oid=k.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and not k.convalidated and k.contype in ('f','c') loop
    execute format('alter table %I.%I validate constraint %I',c.nspname,c.relname,c.conname);
  end loop;
end $$;
revoke all on all tables in schema toolkit_upgrade from public,anon,authenticated;
revoke all on all functions in schema toolkit_upgrade from public,anon,authenticated;
