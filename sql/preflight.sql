-- Read-only inventory. Safe for an authorized operator to run on a hosted database.
-- No mutation, secret/token contents, Auth identities or attachment bytes are returned.
begin transaction read only;
select jsonb_build_object(
  'columns', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from information_schema.columns c where table_schema = 'public'),
  'constraints', (select coalesce(jsonb_agg(jsonb_build_object('table', c.conrelid::regclass::text, 'name', c.conname, 'definition', pg_get_constraintdef(c.oid))), '[]') from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public'),
  'policies', (select coalesce(jsonb_agg(to_jsonb(p)), '[]') from pg_policies p where schemaname in ('public','storage')),
  'grants', (select coalesce(jsonb_agg(to_jsonb(g)), '[]') from information_schema.role_table_grants g where table_schema in ('public','storage')),
  'functions', (select coalesce(jsonb_agg(jsonb_build_object('schema', n.nspname, 'name', p.proname, 'arguments', pg_get_function_identity_arguments(p.oid), 'security_definer', p.prosecdef, 'config', p.proconfig, 'acl', p.proacl::text, 'definition', pg_get_functiondef(p.oid))), '[]') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'),
  'triggers', (select coalesce(jsonb_agg(jsonb_build_object('table', t.tgrelid::regclass::text, 'name', t.tgname, 'definition', pg_get_triggerdef(t.oid))), '[]') from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where not t.tgisinternal and n.nspname in ('public','auth','storage')),
  'views', (select coalesce(jsonb_agg(to_jsonb(v)), '[]') from pg_views v where schemaname = 'public'),
  'extensions', (select coalesce(jsonb_agg(jsonb_build_object('name', extname, 'version', extversion)), '[]') from pg_extension),
  'cron_present', to_regclass('cron.job') is not null,
  'storage_present', to_regclass('storage.buckets') is not null,
  'buckets', case when to_regclass('storage.buckets') is null then null else
    query_to_xml('select id,name,public,file_size_limit,allowed_mime_types from storage.buckets',false,true,'')::text end,
  'cron', case when to_regclass('cron.job') is null then null else
    query_to_xml('select jobid,jobname,schedule,active from cron.job',false,true,'')::text end
) as inventory;
commit;
