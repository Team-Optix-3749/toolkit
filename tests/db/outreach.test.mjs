import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {connect,transaction,asUser,rpc,PERSONAS,personaId} from './helpers.mjs'
let db;before(async()=>{db=await connect()});after(async()=>{await db.end()})
const event=(client,start='2040-01-01T10:00:00Z',end='2040-01-01T12:00:00Z')=>rpc(client,'outreach_action',{action:'create',title:'Boundary event',description:'Community workshop',location:'Library',starts_at:start,ends_at:end})
async function denied(client,fn){await client.query('savepoint denied');await assert.rejects(fn);await client.query('rollback to savepoint denied')}
test('event administration does not grant attendance; lead scope, exact credit and RSVP boundaries',async()=>{
 await transaction(db,async client=>{
  await asUser(client,personaId(18));const e=await event(client)
  await denied(client,()=>rpc(client,'outreach_action',{action:'attendance',event_id:e.id,member_id:PERSONAS.memberA,arrival:e.starts_at,departure:'2040-01-01T10:01:30Z'}))
  await rpc(client,'outreach_action',{action:'leads',id:e.id,member_ids:[PERSONAS.eventLead]})
  await asUser(client,PERSONAS.eventLead)
  const row=await rpc(client,'outreach_action',{action:'attendance',event_id:e.id,member_id:PERSONAS.memberA,arrival:e.starts_at,departure:'2040-01-01T10:01:30Z'})
  assert.equal(row.credited_minutes,1.5)
  await denied(client,()=>rpc(client,'outreach_action',{action:'attendance',event_id:e.id,member_id:PERSONAS.memberB,arrival:'2040-01-01T09:00:00Z'}))
  await asUser(client,PERSONAS.memberA)
  await rpc(client,'outreach_action',{action:'rsvp',event_id:e.id,planned:true})
  await rpc(client,'outreach_action',{action:'rsvp',event_id:e.id,planned:false})
  await denied(client,()=>rpc(client,'outreach_action',{action:'self_checkin',event_id:e.id}))
 })
})
test('overlap rejection, adjacency, cancellation and failed restore are atomic',async()=>{
 await transaction(db,async client=>{
  await asUser(client,PERSONAS.president);const a=await event(client),b=await event(client)
  await rpc(client,'outreach_action',{action:'attendance',event_id:a.id,member_id:PERSONAS.memberA,arrival:a.starts_at,departure:'2040-01-01T11:00:00Z'})
  await denied(client,()=>rpc(client,'outreach_action',{action:'attendance',event_id:b.id,member_id:PERSONAS.memberA,arrival:'2040-01-01T10:30:00Z',departure:b.ends_at}))
  await rpc(client,'outreach_action',{action:'attendance',event_id:b.id,member_id:PERSONAS.memberA,arrival:'2040-01-01T11:00:00Z',departure:b.ends_at})
  await rpc(client,'outreach_action',{action:'cancel',id:a.id})
  await rpc(client,'outreach_action',{action:'attendance',event_id:b.id,member_id:PERSONAS.memberA,arrival:a.starts_at,departure:b.ends_at})
  await denied(client,()=>rpc(client,'outreach_action',{action:'restore',id:a.id}))
  assert.equal((await client.query('select cancelled from public.outreach_events where id=$1',[a.id])).rows[0].cancelled,true)
  assert.equal(Number((await client.query('select credited_minutes from public.outreach_attendance where event_id=$1',[a.id])).rows[0].credited_minutes),0)
 })
})
test('season individual caps dynamically count raw approvals without capping event credit',async()=>{
 await transaction(db,async client=>{
  await asUser(client,PERSONAS.president)
  const season='20000000-0000-4000-8000-000000000001'
  const initial=await rpc(client,'individual_credit',{season_id:season,member_id:PERSONAS.memberA})
  assert.equal(initial.raw_approved_minutes,480)
  for(const [cap,counted] of [[360,360],[300,300],[600,480]]){
   await rpc(client,'individual_outreach_action',{action:'set_cap',season_id:season,cap_minutes:cap})
   const totals=await rpc(client,'individual_credit',{season_id:season,member_id:PERSONAS.memberA})
   assert.equal(totals.raw_approved_minutes,480);assert.equal(totals.counted_individual_minutes,counted)
   assert.equal(totals.official_outreach_minutes,counted+totals.event_minutes)
  }
  const other=await rpc(client,'individual_credit',{season_id:'20000000-0000-4000-8000-000000000002',member_id:PERSONAS.memberA})
  assert.equal(other.raw_approved_minutes,0)
  await asUser(client,PERSONAS.memberA)
  await denied(client,()=>rpc(client,'individual_outreach_action',{action:'set_cap',season_id:season,cap_minutes:0}))
 })
})
