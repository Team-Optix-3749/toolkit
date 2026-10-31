import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {connect,transaction,asUser,rpc,PERSONAS} from './helpers.mjs'
let db;before(async()=>{db=await connect()});after(async()=>{await db.end()})
async function denied(c,fn){await c.query('savepoint rejected');await assert.rejects(fn);await c.query('rollback to savepoint rejected')}
const sid='40000000-0000-4000-8000-000000000002'
async function resetWindow(c){
 await c.query('delete from public.build_records where session_id=$1',[sid])
 await c.query("update public.build_sessions set cancelled=false,opens_at=now()-interval '1 hour',closes_at=now()+interval '2 hours' where id=$1",[sid])
 await c.query("insert into public.build_records(session_id,member_id,check_in) values($1,$2,now()-interval '10 minutes')",[sid,PERSONAS.memberB])
}
test('rotating QR validates before idempotent admission and manual checkout stays caller-owned',async()=>{
 await transaction(db,async c=>{
  await resetWindow(c)
  await asUser(c,PERSONAS.president);const first=await rpc(c,'build_action',{action:'qr',session_id:sid});const current=await rpc(c,'build_action',{action:'qr',session_id:sid})
  assert.notEqual(first.token,current.token);assert.equal((await c.query('select $1::timestamptz<=clock_timestamp()+interval \'45 seconds\' as valid',[current.expires_at])).rows[0].valid,true)
  await asUser(c,PERSONAS.memberA)
  await denied(c,()=>rpc(c,'build_action',{action:'check_in',session_id:sid,method:'qr',token:first.token}))
  const record=await rpc(c,'build_action',{action:'check_in',session_id:sid,method:'qr',token:current.token})
  assert.equal(record.credited_minutes,0);assert.equal(record.check_out,null)
  const repeated=await rpc(c,'build_action',{action:'check_in',session_id:sid,method:'qr',token:current.token});assert.equal(repeated.id,record.id)
  await denied(c,()=>rpc(c,'build_action',{action:'check_in',session_id:sid,method:'qr',token:first.token}))
  await asUser(c,PERSONAS.memberB);await denied(c,()=>rpc(c,'build_action',{action:'check_out',id:record.id}))
  await asUser(c,PERSONAS.memberA);const closed=await rpc(c,'build_action',{action:'check_out',id:record.id});const again=await rpc(c,'build_action',{action:'check_out',id:record.id})
  assert.equal(closed.check_out,again.check_out);assert.equal(closed.checkout_method,'member')
 })
})
test('QR-only location denies GPS and same-location session windows include cancelled definitions',async()=>{
 await transaction(db,async c=>{
  await resetWindow(c)
  await asUser(c,PERSONAS.memberA);await denied(c,()=>rpc(c,'build_action',{action:'check_in',session_id:sid,method:'gps',latitude:33.0144,longitude:-117.1222}))
  await asUser(c,PERSONAS.president)
  await denied(c,()=>rpc(c,'build_action',{action:'session',title:'Conflicting',location_id:'30000000-0000-4000-8000-000000000002',opens_at:new Date(Date.now()-60000).toISOString(),closes_at:new Date(Date.now()+60000).toISOString()}))
 })
})
test('configured automatic closure is idempotent and no application role can run scheduler',async()=>{
 await transaction(db,async c=>{
  await resetWindow(c)
  await c.query("update public.build_sessions set closes_at=now()-interval '1 second' where id=$1",[sid])
  const count=(await c.query('select toolkit_private.close_due_build_records() n')).rows[0].n;assert.equal(count,1)
  const row=(await c.query('select r.check_out,s.closes_at,r.automatically_closed,r.checkout_method from public.build_records r join public.build_sessions s on s.id=r.session_id where r.session_id=$1',[sid])).rows[0]
  assert.equal(row.check_out.toISOString(),row.closes_at.toISOString());assert.equal(row.automatically_closed,true);assert.equal(row.checkout_method,'automatic')
  assert.equal((await c.query('select toolkit_private.close_due_build_records() n')).rows[0].n,0)
  await asUser(c,PERSONAS.president);await denied(c,()=>c.query('select toolkit_private.close_due_build_records()'))
 })
})

test('shortening closes active reservations at the new future close and cancellation zeros credit',async()=>{
 await transaction(db,async c=>{
  await resetWindow(c)
  await asUser(c,PERSONAS.president)
  const close=(await c.query("select (now()+interval '30 minutes')::text value")).rows[0].value
  const edited=await rpc(c,'build_action',{action:'edit_session',id:sid,closes_at:new Date(close).toISOString()})
  const row=(await c.query('select check_out,automatically_closed from public.build_records where session_id=$1',[sid])).rows[0]
  assert.equal(row.check_out.toISOString(),new Date(edited.closes_at).toISOString());assert.equal(row.automatically_closed,true)
  await rpc(c,'build_action',{action:'cancel',id:sid})
  assert.equal(Number((await c.query('select credited_minutes from public.build_records where session_id=$1',[sid])).rows[0].credited_minutes),0)
 })
})
