import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {connect,transaction,asUser,rpc,PERSONAS,personaId} from './helpers.mjs'
let db;before(async()=>{db=await connect()});after(async()=>{await db.end()})
async function denied(c,fn){await c.query('savepoint retained');await assert.rejects(fn);await c.query('rollback to savepoint retained')}
test('purchase owner submits/edits pending and only explicit reviewer decides once',async()=>{
 await transaction(db,async c=>{
  await asUser(c,PERSONAS.memberA)
  await denied(c,()=>rpc(c,'purchase_action',{action:'submit',kind:'purchase',description:'Parts',amount:-1}))
  const request=await rpc(c,'purchase_action',{action:'submit',kind:'purchase',description:'Parts',amount:12.5})
  assert.equal(request.user_id,PERSONAS.memberA);assert.equal(request.status,'PENDING')
  await denied(c,()=>rpc(c,'purchase_action',{action:'approve',id:request.id}))
  const edited=await rpc(c,'purchase_action',{action:'edit_pending',id:request.id,amount:10});assert.equal(Number(edited.amount),10)
  await asUser(c,personaId(23));const approved=await rpc(c,'purchase_action',{action:'approve',id:request.id});assert.equal(approved.status,'APPROVED');assert.equal(approved.reviewer_id,personaId(23))
  await denied(c,()=>rpc(c,'purchase_action',{action:'reject',id:request.id}))
  await asUser(c,PERSONAS.memberA);await denied(c,()=>rpc(c,'purchase_action',{action:'edit_pending',id:request.id,amount:1}))
 })
})

test('new scouting validates event match/team while staff edits preserve author',async()=>{
 await transaction(db,async c=>{
  const event='93000000-0000-4000-8000-000000000001'
  await asUser(c,PERSONAS.memberA)
  const pit=(await c.query("insert into public.pit_scouting(event_id,team_number,scout_id,data) values($1,3749,$2,'{}') returning id",[event,PERSONAS.memberA])).rows[0]
  await denied(c,()=>c.query("insert into public.match_scouting(event_id,team_number,scout_id,match_number,match_type,data) values($1,9999,$2,1,'qm','{}')",[event,PERSONAS.memberA]))
  await asUser(c,personaId(24))
  await c.query("update public.pit_scouting set data='{\"staff_note\":\"retained author\"}' where id=$1",[pit.id])
  await denied(c,()=>c.query('update public.pit_scouting set scout_id=$1 where id=$2',[personaId(24),pit.id]))
 })
})
