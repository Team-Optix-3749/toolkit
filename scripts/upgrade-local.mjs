import pg from 'pg'
import { readFile, readdir } from 'node:fs/promises'
import { inspect, localDatabaseUrl } from './check-schema.mjs'
import { analyze } from './lib/upgrade.mjs'

const args = process.argv.slice(2)
const index = args.indexOf('--mapping')
if (args.some((arg,i) => !['--mapping','--apply'].includes(arg) && args[i-1] !== '--mapping')) throw new Error('Usage: node scripts/upgrade-local.mjs [--mapping corrections.json] [--apply]')
if (index>=0 && !args[index+1]) throw new Error('--mapping requires a JSON path')
const mapping = index<0 ? {} : JSON.parse(await readFile(args[index+1],'utf8'))
const client = new pg.Client({connectionString:localDatabaseUrl()})
await client.connect()
try {
  const report = await inspect(client,mapping)
  console.log(JSON.stringify({shape:report.shape,counts:report.counts,errors:report.errors},null,2))
  if (report.errors.length) throw new Error('Preflight failed. No schema or source data was changed.')
  if (args.includes('--apply')) {
    await client.query('begin')
    try {
      await client.query("select pg_advisory_xact_lock(hashtextextended('toolkit-schema-upgrade',0))")
      // Lock all source tables, then validate the same snapshot used by the import.
      const tables = (await client.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(row => row.tablename)
      const source = {}
      for (const table of tables) {
        const quoted = `"${table.replaceAll('"','""')}"`
        await client.query(`lock table public.${quoted} in access exclusive mode`)
        source[table] = (await client.query(`select to_jsonb(t) as row from public.${quoted} t`)).rows.map(row => row.row)
      }
      const lockedReport = analyze(source,mapping)
      if (lockedReport.errors.length) throw new Error(`Source changed after preflight: ${JSON.stringify(lockedReport.errors)}`)
      const names = (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(name => /^\d+_.*\.sql$/.test(name)).sort()
      await client.query("select set_config('toolkit.upgrade_mapping',$1,true)",[JSON.stringify(mapping)])
      await client.query("select set_config('toolkit.upgrade_validated','yes',true)")
      for (const name of names) await client.query(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'))
      await client.query('create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text primary key, statements text[], name text)')
      for (const name of names) await client.query('insert into supabase_migrations.schema_migrations(version,name) values($1,$2) on conflict(version) do nothing',[name.split('_')[0],name.slice(name.indexOf('_')+1,-4)])
      await client.query('commit')
      console.log('Local upgrade committed atomically. Original source payloads remain in private toolkit_upgrade.source_rows.')
    } catch(error) { await client.query('rollback'); throw error }
  }
} finally { await client.end() }
