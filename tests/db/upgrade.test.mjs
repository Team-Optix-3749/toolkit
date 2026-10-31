import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { analyze } from '../../scripts/lib/upgrade.mjs'
import { connect } from './helpers.mjs'
const id = n => `a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const base = () => ({
  profiles:[{id:id(1),display_name:'Historical Student',role:'OWNER',account_type:'member',account_status:'active',permissions:[]}],
  seasons:[{id:id(2),name:'Upgrade season',is_current:true,outreach_target:10,build_target:20}],
  groups:[{id:id(3),name:'Explicit owning group'}],
  outreach_events:[{id:id(4),title:'Historical event',description:'Historical community workshop',location:'Library',season_id:id(2),starts_at:'2026-01-01T10:00:00+00:00',ends_at:'2026-01-01T11:00:00+00:00',lead_ids:[id(1)],lat:32,lng:-117}],
})
function fixture(shape) {
  const data=base()
  const old={
    build_zones:[{id:id(5),name:'Workshop',gps_lat:32,gps_lng:-117,gps_radius_m:100}],
    build_schedule:[{id:id(6),title:'Historical build',zone_id:id(5),season_id:id(2),starts_at:'2026-01-02T10:00:00+00:00',ends_at:'2026-01-02T11:00:00+00:00',rrule:'FREQ=WEEKLY'}],
    build_checkins:[{id:id(7),session_id:id(6),user_id:id(1),checked_in_at:'2026-01-02T10:00:00+00:00',checked_out_at:'2026-01-02T10:01:30+00:00',credited_minutes:2,minutes_logged:2}],
    outreach_planned_attendance:[{event_id:id(4),user_id:id(1)}],
    outreach_checkins:[{id:id(8),event_id:id(4),user_id:id(1),checked_in_at:'2026-01-01T10:00:00+00:00',departed_at:'2026-01-01T10:01:30+00:00',credited_minutes:2}],
    opi_initiatives:[{id:id(9),user_id:id(1),season_id:id(2),title:'Historical OPI',description:'Actual submission',doc_url:'https://docs.google.com/document/d/local-history/edit',status:'CONVERTED',linked_event_id:id(4),created_at:'2026-01-01T09:00:00Z'}],
    opi_comments:[{id:id(10),initiative_id:id(9),user_id:id(1),body:'Historical review',created_at:'2026-01-01T09:30:00Z'}],
  }
  const normalized=analyze({...data,...old}).targets
  const current=Object.fromEntries(['build_locations','build_sessions','build_records','outreach_rsvps','outreach_attendance','opis','opi_feedback'].map(name=>[name,normalized[name]]))
  if(shape==='legacy') return {...data,...old}
  if(shape==='current') return {...data,...current}
  return {...data,...old,...current}
}
for(const shape of ['legacy','current','both']) test(`${shape} sources preserve attribution, exact credit and stable UUIDs`,()=>{
  const report=analyze(fixture(shape))
  assert.deepEqual(report.errors,[])
  assert.equal(report.shape,shape)
  assert.equal(report.targets.build_records[0].credited_minutes,1.5)
  assert.equal(report.targets.outreach_attendance[0].credited_minutes,1.5)
  assert.deepEqual(report.targets.opi_feedback.map(row=>[row.id,row.user_id,row.feedback]),[[id(10),id(1),'Historical review']])
  assert.deepEqual(report.targets.opis.map(row=>[row.id,row.event_id]),[[id(9),id(4)]])
  assert.equal(report.targets.build_sessions[0].rrule,'FREQ=WEEKLY')
  assert.equal(report.targets.build_records.length,1)
})
test('conflicting copies, missing ends and overlap are reported without mutating input',()=>{
  const data=fixture('both'); data.build_records[0].member_id=id(99)
  data.build_schedule[0].ends_at=null
  const before=structuredClone(data)
  const report=analyze(data)
  assert(report.errors.some(row=>row.id===id(7)&&row.error.includes('conflicting')))
  assert(report.errors.some(row=>row.id===id(6)&&row.field==='closes_at'&&row.value===null))
  assert.deepEqual(data,before)
  const overlap=fixture('legacy'); overlap.outreach_checkins.push({...overlap.outreach_checkins[0],id:id(11)})
  assert(analyze(overlap).errors.some(row=>row.error.includes('overlapping')))
})
test('explicit mappings require existing targets and resolve missing association without guessing',()=>{
  const data=fixture('legacy');data.build_schedule[0].ends_at=null
  assert(analyze(data).errors.some(row=>row.field==='closes_at'))
  const report=analyze(data,{build_sessions:{[id(6)]:{closes_at:'2026-01-02T11:00:00+00:00'}}})
  assert.deepEqual(report.errors,[])
  assert.equal(data.build_schedule[0].ends_at,null)
  assert(analyze(data,{build_sessions:{[id(99)]:{closes_at:'2026-01-02T11:00:00Z'}}}).errors.some(row=>row.error.includes('does not exist')))
})
// Isolated PostgreSQL databases prove actual migration execution for each recognized shape.
// No reset/drop touches the running application database.
for(const shape of ['legacy','current','both']) test(`${shape} upgrade commits once and retains raw history privately`,async()=>{
  const admin=await connect(); const name=`toolkit_upgrade_${shape}_${process.pid}`
  let db
  try {
    await admin.query(`create database ${name} template template0`)
    const pg=(await import('pg')).default
    const url=new URL(process.env.DATABASE_URL??'postgresql://postgres:postgres@127.0.0.1:54322/postgres');url.pathname=`/${name}`
    db=new pg.Client({connectionString:url.href});await db.connect()
    await db.query(`create schema auth; create schema storage; create schema extensions; create extension pgcrypto with schema extensions;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',created_at timestamptz default now());
      create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
      create table auth.refresh_tokens(id bigint generated always as identity,user_id text,session_id uuid,revoked boolean default false);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text,metadata jsonb);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;`)
    const data=fixture(shape)
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id(1),'upgrade@example.test'])
    // Source fixtures deliberately use only mapped/source fields; baseline adds current columns.
    for(const [table,rows] of Object.entries(data)) {
      if(!rows.length)continue
      const names=[...new Set(rows.flatMap(row=>Object.keys(row)))]
      const type=key=>key==='permissions'||key==='lead_ids'?'uuid[]':key==='is_current'?'boolean':key==='latitude'||key==='longitude'||key==='gps_lat'||key==='gps_lng'?'double precision':key.includes('minutes')||key.includes('hours')||key.endsWith('_target')||key==='gps_radius_m'||key==='radius_m'?'numeric':key==='id'||key.endsWith('_id')?'uuid':key.endsWith('_at')||['check_in','check_out','arrival','departure'].includes(key)?'timestamptz':'text'
      await db.query(`create table public.${table}(${names.map(key=>`"${key}" ${key==='permissions'?'text[]':type(key)}`).join(',')}${names.includes('id')?', primary key(id)':''})`)
      for(const row of rows) await db.query(`insert into public.${table}(${names.map(key=>`"${key}"`).join(',')}) values(${names.map((_,i)=>`$${i+1}`).join(',')})`,names.map(key=>row[key]??null))
    }
    if(shape!=='legacy') await db.query(`alter table public.build_records add column credit_interval tstzrange generated always as (tstzrange(check_in,check_out,'[)')) stored;
      create view public.hours_summary as select credited_minutes from public.build_records`)
    await db.query('begin')
    await db.query("select set_config('toolkit.upgrade_validated','yes',true)")
    for(const file of (await readdir(new URL('../../supabase/migrations/',import.meta.url))).sort()) await db.query(await readFile(new URL(`../../supabase/migrations/${file}`,import.meta.url),'utf8'))
    await db.query('commit')
    const result=await db.query('select id,member_id,credited_minutes from public.build_records')
    assert.deepEqual(result.rows.map(row=>({...row,credited_minutes:Number(row.credited_minutes)})),[{id:id(7),member_id:id(1),credited_minutes:1.5}])
    assert.equal((await db.query('select count(*)::integer as n from public.opis')).rows[0].n,1)
    assert.equal((await db.query("select payload->>'minutes_logged' as old from toolkit_upgrade.source_rows where source_table=$1 and source_key=$2",[shape==='current'?'build_records':'build_checkins',id(7)])).rows[0].old,'2')
    assert.equal((await db.query("select has_schema_privilege('authenticated','toolkit_upgrade','usage') as allowed")).rows[0].allowed,false)
  } finally {await db?.end();await admin.query(`drop database if exists ${name} with(force)`);await admin.end()}
})
