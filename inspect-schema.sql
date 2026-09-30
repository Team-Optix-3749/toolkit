-- ============================================================
-- Inspect the current public schema — run in Supabase SQL Editor.
-- This combines everything into ONE result set.
-- ============================================================

select * from (

  -- TABLES + COLUMNS
  select
    '1_columns' as section,
    c.table_name,
    c.column_name as name,
    c.udt_name as type,
    c.is_nullable as nullable,
    coalesce(c.column_default, '') as default_val,
    '' as detail
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE'

  union all

  -- CHECK CONSTRAINTS
  select
    '2_checks' as section,
    tc.table_name,
    tc.constraint_name as name,
    '' as type,
    '' as nullable,
    '' as default_val,
    cc.check_clause as detail
  from information_schema.table_constraints tc
  join information_schema.check_constraints cc
    on cc.constraint_schema = tc.constraint_schema
    and cc.constraint_name = tc.constraint_name
  where tc.table_schema = 'public' and tc.constraint_type = 'CHECK'

  union all

  -- FOREIGN KEYS
  select
    '3_fkeys' as section,
    kcu.table_name,
    kcu.column_name as name,
    ccu.table_schema || '.' || ccu.table_name || '.' || ccu.column_name as type,
    '' as nullable,
    rc.delete_rule as default_val,
    '' as detail
  from information_schema.referential_constraints rc
  join information_schema.key_column_usage kcu
    on kcu.constraint_name = rc.constraint_name and kcu.constraint_schema = rc.constraint_schema
  join information_schema.constraint_column_usage ccu
    on ccu.constraint_name = rc.unique_constraint_name and ccu.constraint_schema = rc.unique_constraint_schema
  where kcu.table_schema = 'public'

  union all

  -- RLS POLICIES
  select
    '4_rls' as section,
    tablename as table_name,
    policyname as name,
    cmd as type,
    permissive as nullable,
    roles::text as default_val,
    coalesce(qual::text, '') || ' | ' || coalesce(with_check::text, '') as detail
  from pg_policies
  where schemaname = 'public'

  union all

  -- VIEWS
  select
    '5_views' as section,
    table_name,
    '' as name,
    '' as type,
    '' as nullable,
    '' as default_val,
    view_definition as detail
  from information_schema.views
  where table_schema = 'public'

  union all

  -- INDEXES
  select
    '6_indexes' as section,
    tablename as table_name,
    indexname as name,
    '' as type,
    '' as nullable,
    '' as default_val,
    indexdef as detail
  from pg_indexes
  where schemaname = 'public'

  union all

  -- TRIGGERS
  select
    '7_triggers' as section,
    event_object_table as table_name,
    trigger_name as name,
    event_manipulation as type,
    action_timing as nullable,
    '' as default_val,
    action_statement as detail
  from information_schema.triggers
  where trigger_schema = 'public'

  union all

  -- STORAGE BUCKETS
  select
    '8_storage' as section,
    name as table_name,
    id as name,
    case when public then 'public' else 'private' end as type,
    '' as nullable,
    coalesce(file_size_limit::text, '') as default_val,
    coalesce(allowed_mime_types::text, '') as detail
  from storage.buckets

) combined
order by section, table_name, name;
