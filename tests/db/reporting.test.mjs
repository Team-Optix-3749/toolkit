import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {connect,transaction,asUser,rpc,PERSONAS} from './helpers.mjs'
let db;before(async()=>{db=await connect()});after(async()=>{await db.end()})
test('keyset exports exhaust more than1000 tied timestamps and permission-gate every page',async()=>{
 await transaction(db,async c=>{
  await c.query(`insert into public.individual_outreach(user_id,season_id,full_name,event_name,what_you_did,impact,event_date,people_impacted,status,claimed_minutes)
   select $1,$2,'=Formula Name','Tied request '||n,'Community assistance','Local proof',date '2040-01-01',1,'PENDING',60 from generate_series(1,1005)n`,[PERSONAS.memberA,'20000000-0000-4000-8000-000000000001'])
  await asUser(c,PERSONAS.president)
  const rows=[];let cursor=null
  do{const page=await rpc(c,'export_records',{record_type:'individual',from:'2040-01-01T08:00:00Z',to:'2040-01-02T08:00:00Z',...(cursor?{cursor}:{})});rows.push(...page.rows);cursor=page.next_cursor}while(cursor)
  assert.equal(rows.length,1005);assert.equal(new Set(rows.map(row=>row.Request)).size,1005)
  await asUser(c,PERSONAS.memberA);await c.query('savepoint no_export');await assert.rejects(rpc(c,'export_records',{record_type:'individual'}));await c.query('rollback to savepoint no_export')
 })
})
