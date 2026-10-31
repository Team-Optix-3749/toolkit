import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {connect,transaction,asUser,rpc,PERSONAS} from './helpers.mjs'
let db;before(async()=>{db=await connect()});after(async()=>{await db.end()})
const group='60000000-0000-4000-8000-000000000001'
async function denied(c,fn){await c.query('savepoint denied_task');await assert.rejects(fn);await c.query('rollback to savepoint denied_task')}
test('owning-group assignees contribute shared work and selected reviewer controls legal transitions',async()=>{
 await transaction(db,async c=>{
  await asUser(c,PERSONAS.president);const task=await rpc(c,'task_action',{action:'create',title:'Shared review task',owner_group_id:group,requires_review:true,reviewer_ids:[PERSONAS.reviewer]})
  await asUser(c,PERSONAS.memberA)
  await rpc(c,'task_action',{action:'evidence',id:task.id,kind:'note',content:'Retained group contribution'})
  const submitted=await rpc(c,'task_action',{action:'submit',id:task.id});assert.equal(submitted.status,'submitted')
  await denied(c,()=>rpc(c,'task_action',{action:'approve',id:task.id}))
  await asUser(c,PERSONAS.reviewer);await denied(c,()=>rpc(c,'task_action',{action:'request_changes',id:task.id,feedback:' '}))
  assert.equal((await rpc(c,'task_action',{action:'request_changes',id:task.id,feedback:'Add detail'})).status,'changes_requested')
  await asUser(c,PERSONAS.memberB);assert.equal((await rpc(c,'task_action',{action:'resubmit',id:task.id})).status,'resubmitted')
  await asUser(c,PERSONAS.reviewer);assert.equal((await rpc(c,'task_action',{action:'approve',id:task.id})).status,'completed')
  assert.equal((await c.query('select count(*)::int n from public.task_submissions where task_id=$1',[task.id])).rows[0].n,2)
  await asUser(c,PERSONAS.president);assert.equal((await rpc(c,'task_action',{action:'reopen',id:task.id})).status,'in_progress')
 })
})
test('overview access does not expose private work and moving ownership revokes former assignees immediately',async()=>{
 await transaction(db,async c=>{
  await asUser(c,PERSONAS.president);const task=await rpc(c,'task_action',{action:'create',title:'Private task',owner_group_id:group,requires_review:false})
  await asUser(c,PERSONAS.memberA);await rpc(c,'task_action',{action:'evidence',id:task.id,kind:'note',content:'Private retained note'})
  await asUser(c,PERSONAS.mentor)
  assert.equal((await c.query('select title from public.tasks where id=$1',[task.id])).rows[0].title,'Private task')
  assert.equal((await c.query('select * from public.task_evidence where task_id=$1',[task.id])).rows.length,0)
  await denied(c,()=>rpc(c,'task_action',{action:'complete',id:task.id}))
  await asUser(c,PERSONAS.president);await rpc(c,'task_action',{action:'move_group',id:task.id,owner_group_id:'60000000-0000-4000-8000-000000000004'})
  await asUser(c,PERSONAS.memberA);assert.equal((await c.query('select public.is_task_assignee($1) ok',[task.id])).rows[0].ok,false)
  assert.equal((await c.query('select * from public.task_evidence where task_id=$1',[task.id])).rows.length,0)
  await denied(c,()=>rpc(c,'task_action',{action:'start',id:task.id}))
 })
})
