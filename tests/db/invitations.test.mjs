import assert from 'node:assert/strict'
import {after,before,test} from 'node:test'
import {randomUUID} from 'node:crypto'
import {connect,transaction,asUser,PERSONAS} from './helpers.mjs'
let db
before(async()=>{db=await connect()})
after(async()=>{await db.end()})
const action=async(client,payload)=>(await client.query('select public.invitation_action($1) as value',[payload])).rows[0].value
async function prospective(client,verified=true){
  await client.query('reset role');await client.query("select set_config('request.jwt.claims','{}',true),set_config('request.jwt.claim.sub','',true)")
  const id=randomUUID()
  await client.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,case when $3 then now() else null end,'{\"display_name\":\"Invite Student\",\"account_type\":\"member\"}')",[id,`${id}@example.test`,verified])
  return id
}
test('one reusable invitation atomically admits multiple verified users without grants',async()=>{
  await transaction(db,async client=>{
    await asUser(client,PERSONAS.president)
    const invitation=await action(client,{action:'create',expires_at:new Date(Date.now()+86400000).toISOString()})
    assert.equal((await action(client,{action:'inspect',code:invitation.code})).state,'valid')
    const listed=await action(client,{action:'list'})
    assert(listed.every(row=>!('code'in row)&&!('token_hash'in row)))
    for(let n=0;n<2;n++){
      const id=await prospective(client);await asUser(client,id)
      assert.equal((await action(client,{action:'redeem',code:invitation.code})).state,'admitted')
      const profile=(await client.query("select public.profile_action('{\"action\":\"get_self\"}') as p")).rows[0].p
      assert.equal(profile.role,'MEMBER');assert.deepEqual(profile.permissions,[])
    }
  })
})
test('unverified, expired, revoked and invalid redemption never admits or exposes tokens',async()=>{
  await transaction(db,async client=>{
    await asUser(client,PERSONAS.president)
    const invitation=await action(client,{action:'create',expires_at:new Date(Date.now()+86400000).toISOString()})
    const id=await prospective(client,false);await asUser(client,id)
    await client.query('savepoint rejected_invite')
    await assert.rejects(action(client,{action:'redeem',code:invitation.code}),/Verify your email/)
    await client.query('rollback to savepoint rejected_invite')
    await client.query('reset role');await client.query('update auth.users set email_confirmed_at=now() where id=$1',[id])
    await asUser(client,PERSONAS.president);await action(client,{action:'revoke',id:invitation.id})
    await asUser(client,id)
    assert.equal((await action(client,{action:'redeem',code:invitation.code})).state,'invalid')
    assert.equal((await action(client,{action:'inspect',code:'unknown-token-value'})).state,'invalid')
    await client.query('reset role');await client.query('update public.invitations set revoked=false,expires_at=now()-interval \'1 second\' where id=$1',[invitation.id])
    await asUser(client,id)
    assert.equal((await action(client,{action:'redeem',code:invitation.code})).state,'expired')
    assert.equal((await client.query("select public.profile_action('{\"action\":\"get_self\"}') p")).rows[0].p.role,'PENDING')
    await client.query('savepoint token_access');await assert.rejects(client.query('select * from public.invitations'),{code:'42501'});await client.query('rollback to savepoint token_access')
  })
})
