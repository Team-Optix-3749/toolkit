import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { analyze } from './lib/upgrade.mjs'

export function localDatabaseUrl(value = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres') {
  const parsed = new URL(value)
  if (!['postgres:','postgresql:'].includes(parsed.protocol) || !['localhost','127.0.0.1','[::1]'].includes(parsed.hostname)) throw new Error('Schema checks require a localhost PostgreSQL connection; hosted access is forbidden.')
  if ([...parsed.searchParams.keys()].some(key => key !== 'sslmode') || parsed.hash) throw new Error('Connection overrides are forbidden.')
  return value
}
const identifier = value => `"${value.replaceAll('"','""')}"`
export async function inspect(client, mapping = {}) {
  await client.query('begin isolation level repeatable read read only')
  try {
    const sql = await readFile(new URL('../sql/preflight.sql', import.meta.url),'utf8')
    const inventorySql = sql.slice(sql.indexOf('select jsonb_build_object'),sql.lastIndexOf('commit;'))
    const catalog = (await client.query(inventorySql)).rows[0].inventory
    const tables = (await client.query("select tablename from pg_tables where schemaname = 'public' order by tablename")).rows.map(row => row.tablename)
    const data = {}
    for (const table of tables) data[table] = (await client.query(`select to_jsonb(t) as row from public.${identifier(table)} t`)).rows.map(row => row.row)
    const report = analyze(data,mapping)
    if(catalog.storage_present){
      const objects=(await client.query('select bucket_id,name from storage.objects')).rows
      for(const row of data.purchases??[]){
        if(!row.receipt_url)continue
        let path=row.receipt_url
        if(/^https:\/\//.test(path)){
          const match=path.match(/^https:\/\/[A-Za-z0-9.-]+\.supabase\.co\/storage\/v1\/object\/public\/receipts\/([^?#%]+)$/)
          if(!match){report.errors.push({table:'purchases',id:row.id,error:'Unmappable external or encoded receipt URL; correct source explicitly'});continue}
          path=match[1]
        }
        if(!objects.some(object=>object.bucket_id==='receipts'&&object.name===path))report.errors.push({table:'purchases',id:row.id,path,error:'Missing private receipt object'})
      }
    }
    // Public reports contain row IDs and required corrections, not bearer tokens or private source bodies.
    if (catalog.cron_present) catalog.cron = (await client.query('select jobid, jobname, schedule, active from cron.job')).rows
    if (catalog.storage_present) catalog.buckets = (await client.query('select id, name, public, file_size_limit, allowed_mime_types from storage.buckets')).rows
    await client.query('rollback')
    return { ...report, catalog }
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}
async function main() {
  const args = process.argv.slice(2)
  if (args.some((arg,index) => arg !== '--mapping' && args[index-1] !== '--mapping')) throw new Error('Usage: node scripts/check-schema.mjs [--mapping corrections.json]')
  const mappingIndex = args.indexOf('--mapping')
  if (mappingIndex >= 0 && !args[mappingIndex+1]) throw new Error('--mapping requires a JSON path')
  const mapping = mappingIndex < 0 ? {} : JSON.parse(await readFile(args[mappingIndex+1],'utf8'))
  const client = new pg.Client({connectionString:localDatabaseUrl()})
  await client.connect()
  try {
    const {targets, ...report} = await inspect(client,mapping)
    console.log(JSON.stringify(report,null,2))
    if (report.errors.length) process.exitCode = 1
  } finally { await client.end() }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode=1 })
