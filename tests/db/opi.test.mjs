import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {connect,transaction,asUser,rpc,PERSONAS,personaId} from './helpers.mjs'
let db;before(async()=>{db=await connect()});after(async()=>{await db.end()})
async function denied(c,fn){await c.query('savepoint denied_opi');await assert.rejects(fn);await c.query('rollback to savepoint denied_opi')}
test('OPI versions are immutable, scoped and retained through changes/resubmission',async()=>{
 await transaction(db,async c=>{
  await asUser(c,PERSONAS.memberA)
  await denied(c,()=>rpc(c,'opi_action',{action:'submit',title:'Invalid',summary:'Summary',document_url:'https://docs.google.com/spreadsheets/d/123'}))
  const opi=await rpc(c,'opi_action',{action:'submit',title:'Community project',summary:'Initial summary',document_url:'https://docs.google.com/document/d/local-doc/edit'})
  await denied(c,()=>rpc(c,'opi_action',{action:'resubmit',id:opi.id,title:'Edited',summary:'Edited',document_url:opi.document_url}))
  await asUser(c,PERSONAS.memberB);assert.equal((await c.query('select * from public.opis where id=$1',[opi.id])).rows.length,0)
  await asUser(c,PERSONAS.president);await rpc(c,'opi_action',{action:'changes',id:opi.id,feedback:'Clarify plan'})
  await asUser(c,PERSONAS.memberA);await rpc(c,'opi_action',{action:'resubmit',id:opi.id,title:'Revised project',summary:'Full revised summary',document_url:'https://docs.google.com/document/d/revised-doc/edit'})
  const versions=(await c.query('select title,summary from public.opi_versions where opi_id=$1 order by submitted_at,id',[opi.id])).rows
  assert.equal(versions.length,2);assert(versions.some(v=>v.summary==='Initial summary'));assert(versions.some(v=>v.summary==='Full revised summary'))
  assert.equal((await c.query('select feedback from public.opi_feedback where opi_id=$1',[opi.id])).rows[0].feedback,'Clarify plan')
 })
})
test('failed conversion leaves Approved and successful conversion creates one event exactly once',async()=>{
 await transaction(db,async c=>{
  await asUser(c,PERSONAS.memberA);const opi=await rpc(c,'opi_action',{action:'submit',title:'Conversion',summary:'Event description',document_url:'https://docs.google.com/document/d/convert-doc/edit'})
  await asUser(c,PERSONAS.president);await rpc(c,'opi_action',{action:'approve',id:opi.id})
  const fields={action:'convert',id:opi.id,title:'Converted event',description:'Event description',location:'Library',starts_at:'2040-01-01T10:00:00Z',ends_at:'2040-01-01T11:00:00Z'}
  await denied(c,()=>rpc(c,'opi_action',{...fields,ends_at:null}))
  assert.equal((await c.query('select status,event_id from public.opis where id=$1',[opi.id])).rows[0].status,'APPROVED')
  await asUser(c,personaId(21));await denied(c,()=>rpc(c,'opi_action',fields))
  await asUser(c,PERSONAS.president);const converted=await rpc(c,'opi_action',fields)
  assert.equal(converted.status,'CONVERTED');assert(converted.event_id)
  await denied(c,()=>rpc(c,'opi_action',fields));await denied(c,()=>rpc(c,'opi_action',{action:'reopen',id:opi.id}))
  assert.equal((await c.query('select count(*)::int n from public.outreach_events where id=$1',[converted.event_id])).rows[0].n,1)
 })
})
