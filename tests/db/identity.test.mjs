import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'
import {
  asUser, connect, LOCAL_PASSWORD, PERMISSIONS, PERSONAS, personaId,
  requireLocalURL, rpc, signIn, transaction,
} from './helpers.mjs'

let db
before(async () => { db = await connect() })
after(async () => { await db?.end() })

async function denied(client, operation, code) {
  await client.query('savepoint identity_expected_denial')
  let error
  try { await operation() } catch (failure) { error = failure }
  await client.query('rollback to savepoint identity_expected_denial')
  await client.query('release savepoint identity_expected_denial')
  assert.ok(error, 'The forbidden operation must fail')
  if (code) assert.equal(error.code, code)
}

async function owner(client) {
  await client.query('reset role')
  await client.query(`select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true)`)
}

async function provision(client, { id = randomUUID(), role = 'MEMBER', verified = true,
  type = 'member', grants = [], metadata = {}, email = `identity-${id}@example.test`, password = false } = {}) {
  await owner(client)
  await client.query(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token)
    values('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,
      case when $5 then extensions.crypt($6,extensions.gen_salt('bf')) else '' end,
      case when $3 then now() else null end,'{"provider":"email","providers":["email"]}',$4,now(),now(),'','','','')`,
  [id, email, verified, JSON.stringify({ display_name: 'Fake Identity Boundary', account_type: type, ...metadata }), password, LOCAL_PASSWORD])
  await client.query(`insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
    values($1::uuid,$1::uuid,$1::text,jsonb_build_object('sub',$1::text,'email',$2::text,'email_verified',$3::boolean),'email',now(),now())`, [id,email,verified])
  if (role !== 'PENDING' || grants.length) {
    await client.query('update public.profiles set role=$2,permissions=$3 where id=$1', [id,role,grants])
  }
  return { id, email }
}

const action = (client, operation, id, values = {}) => rpc(client, 'account_action', { action: operation, id, ...values })

test('privileged signup metadata never provisions authority, grants, or active admission', async () => {
  await transaction(db, async (client) => {
    const person = await provision(client, { role: 'PENDING', type: 'mentor', metadata: {
      role: 'OWNER', account_status: 'active', permissions: PERMISSIONS, special_perms: PERMISSIONS,
      displayed_role: 'President', verified: true,
    } })
    const { rows: [profile] } = await client.query('select role,permissions,account_type,displayed_role from public.profiles where id=$1', [person.id])
    assert.equal(profile.role, 'PENDING')
    assert.equal(profile.account_type, 'mentor')
    assert.equal(profile.displayed_role, null)
    assert.deepEqual(profile.permissions, [])
    await asUser(client, person.id)
    assert.equal((await rpc(client, 'profile_action', { action: 'get_self' })).verified, true)
    assert.equal((await client.query('select public.is_member() value')).rows[0].value, false)
  })
})

test('missing, malformed, mismatched, expired and revoked session claims deny admission', async () => {
  await transaction(db, async (client) => {
    const sid = await asUser(client, PERSONAS.memberA)
    assert.equal((await client.query('select public.is_member() value')).rows[0].value, true)
    for (const session of [undefined, 'not-a-uuid', randomUUID()]) {
      await client.query(`select set_config('request.jwt.claims',$1,true)`, [JSON.stringify({ sub: PERSONAS.memberA, role: 'authenticated', session_id: session })])
      assert.equal((await client.query('select public.is_member() value')).rows[0].value, false)
      await denied(client, () => rpc(client, 'profile_action', { action: 'get_self' }), '28000')
    }
    await owner(client)
    await client.query('update auth.sessions set not_after=now()-interval \'1 second\' where id=$1', [sid])
    await asUser(client, PERSONAS.memberA, { sessionId: sid, createSession: false })
    assert.equal((await client.query('select public.is_member() value')).rows[0].value, false)
    await asUser(client, PERSONAS.memberB, { sessionId: sid, createSession: false })
    assert.equal((await client.query('select public.is_member() value')).rows[0].value, false)
    await owner(client)
    await client.query('delete from auth.sessions where id=$1', [sid])
    await asUser(client, PERSONAS.memberA, { sessionId: sid, createSession: false })
    assert.equal((await client.query('select count(*)::int n from public.seasons')).rows[0].n, 0)
  })
})

test('pending, unverified and deactivated identities cannot enter protected tables or directories', async () => {
  await transaction(db, async (client) => {
    const unverified = await provision(client, { verified: false })
    for (const id of [PERSONAS.pending, PERSONAS.unverified, PERSONAS.deactivated, unverified.id]) {
      await asUser(client, id)
      assert.equal((await client.query('select public.is_member() value')).rows[0].value, false)
      assert.equal((await client.query('select count(*)::int n from public.public_directory')).rows[0].n, 0)
      assert.equal((await client.query('select count(*)::int n from public.historical_profiles')).rows[0].n, 0)
      assert.equal((await client.query('select count(*)::int n from public.scout_events')).rows[0].n, 0)
      await denied(client,()=>rpc(client,'season_hours',{}))
      await denied(client, () => rpc(client, 'account_directory', {}), '42501')
      assert.equal((await rpc(client, 'profile_action', { action: 'get_self' })).id, id)
    }
  })
})

test('only President is implicit-all; each isolated ordinary grant authorizes only itself', async () => {
  await transaction(db, async (client) => {
    for (const id of [PERSONAS.officerNoGrants, PERSONAS.leadership]) {
      await asUser(client, id)
      assert.equal((await client.query('select public.is_student_admin() value')).rows[0].value, true)
      for (const permission of PERMISSIONS) assert.equal((await client.query('select public.has_perm($1) value',[permission])).rows[0].value, false)
    }
    for (let i=0; i<PERMISSIONS.length; i++) {
      await asUser(client, personaId(i+13))
      for (const permission of PERMISSIONS) assert.equal((await client.query('select public.has_perm($1) value',[permission])).rows[0].value, permission===PERMISSIONS[i])
    }
    await asUser(client, PERSONAS.president)
    for (const permission of PERMISSIONS) assert.equal((await client.query('select public.has_perm($1) value',[permission])).rows[0].value, true)
    assert.equal((await client.query("select public.has_perm('unknown_permission') value")).rows[0].value, false)
  })
})

test('admitted users see named season totals without exposing private claim details',async()=>{
 await transaction(db,async client=>{
  await asUser(client,PERSONAS.memberA)
  const totals=await rpc(client,'season_hours',{})
  assert(totals.members.some(row=>row.id===PERSONAS.memberB))
  assert(totals.members.every(row=>!('email'in row)&&!('proof_urls'in row)))
  await denied(client,()=>rpc(client,'season_hours',{include_inactive:true}))
  await asUser(client,personaId(13))
  assert((await rpc(client,'season_hours',{include_inactive:true})).members.some(row=>row.id===PERSONAS.deactivated))
 })
})

test('base profile selects, self insertion and direct authority writes are denied even to President', async () => {
  await transaction(db, async (client) => {
    for (const id of [PERSONAS.memberA, personaId(13), PERSONAS.president]) {
      await asUser(client, id)
      await denied(client, () => client.query('select * from public.profiles'), '42501')
      await denied(client, () => client.query("update public.profiles set role='OWNER',permissions=$2,account_status='active' where id=$1",[id,PERMISSIONS]), '42501')
      await denied(client, () => client.query('insert into public.profiles(id) values($1)',[randomUUID()]), '42501')
      await denied(client, () => client.query('delete from public.profiles where id=$1',[id]), '42501')
    }
  })
})

test('profile RPC permits safe own cosmetic edits, preserves omitted fields, and rejects authority and unsafe avatars', async () => {
  await transaction(db, async (client) => {
    await asUser(client, PERSONAS.memberA)
    const before = await rpc(client,'profile_action',{action:'get_self'})
    const edited = await rpc(client,'profile_action',{action:'edit_self',display_name:'Safe Name',displayed_role:'President',bio:'New biography',avatar_url:'https://example.test/avatar.png'})
    assert.equal(edited.role, before.role)
    assert.deepEqual(edited.permissions, before.permissions)
    assert.equal(edited.displayed_role,'President')
    assert.equal(edited.department,before.department)
    assert.equal((await client.query("select public.has_perm('manage_accounts') value")).rows[0].value,false)
    const cleared = await rpc(client,'profile_action',{action:'edit_self',bio:null})
    assert.equal(cleared.bio,null)
    for (const values of [{role:'OWNER'},{permissions:PERMISSIONS},{account_status:'active'},{id:PERSONAS.memberB},{account_type:'mentor'}]) {
      await denied(client,()=>rpc(client,'profile_action',{action:'edit_self',...values}),'42501')
    }
    await denied(client,()=>rpc(client,'profile_action',{action:'edit_self',avatar_url:'javascript:alert(1)'}),'22023')
    await denied(client,()=>rpc(client,'profile_action',{action:'edit_self',display_name:'   '}),'22023')
  })
})

test('directory projections exclude contact and grants while historical names survive deactivation', async () => {
  await transaction(db, async (client) => {
    await asUser(client, PERSONAS.memberA)
    const { rows } = await client.query('select to_jsonb(d) profile from public.public_directory d')
    assert.ok(rows.length>0)
    for (const {profile} of rows) {
      assert.equal(Object.hasOwn(profile,'email'),false)
      assert.equal(Object.hasOwn(profile,'permissions'),false)
      assert.equal(profile.account_status,'active')
    }
    assert.equal(rows.some(({profile})=>profile.id===PERSONAS.deactivated || profile.id===PERSONAS.pending),false)
    const historical = await client.query('select to_jsonb(h) profile from public.historical_profiles h where id=$1',[PERSONAS.deactivated])
    assert.deepEqual(Object.keys(historical.rows[0].profile).sort(),['display_name','id'])
    const own = await rpc(client,'account_directory',{})
    assert.equal(own.length,1)
    assert.equal(own[0].id,PERSONAS.memberA)
    assert.equal(Object.hasOwn(own[0],'email'),false)
    await asUser(client,personaId(13))
    const directory = await rpc(client,'account_directory',{})
    assert.ok(directory.some(profile=>profile.id===PERSONAS.pending && typeof profile.verified==='boolean' && profile.email))
  })
})

test('verified ordinary admission clears grants; unverified and repeated admission fail', async () => {
  await transaction(db, async (client) => {
    const prospective = await provision(client,{role:'PENDING',type:'mentor',grants:['manage_tasks']})
    await asUser(client,personaId(13))
    await denied(client,()=>action(client,'approve',PERSONAS.unverified),'22023')
    const approved = await action(client,'approve',prospective.id)
    assert.equal(approved.role,'MEMBER')
    assert.equal(approved.account_type,'mentor')
    assert.deepEqual(approved.permissions,[])
    await denied(client,()=>action(client,'approve',prospective.id),'22023')
    await denied(client,()=>action(client,'reject',prospective.id),'22023')
    await denied(client,()=>action(client,'approve',PERSONAS.officer),'42501')
  })
})

test('ordinary lifecycle cannot target administrators or illegal states and retains admitted attribution', async () => {
  await transaction(db, async (client) => {
    await asUser(client,personaId(13))
    for (const id of [PERSONAS.president,PERSONAS.officer,PERSONAS.leadership]) {
      for (const operation of ['approve','reject','deactivate','reactivate']) await denied(client,()=>action(client,operation,id),'42501')
    }
    await denied(client,()=>action(client,'deactivate',PERSONAS.pending),'22023')
    await denied(client,()=>action(client,'reactivate',PERSONAS.memberA),'22023')
    const deactivated = await action(client,'deactivate',PERSONAS.memberA)
    assert.equal(deactivated.account_status,'deactivated')
    await denied(client,()=>action(client,'deactivate',PERSONAS.memberA),'22023')
    assert.equal((await client.query('select display_name from public.historical_profiles where id=$1',[PERSONAS.memberA])).rows[0].display_name,deactivated.display_name)
    assert.equal((await client.query('select count(*)::int n from public.public_directory where id=$1',[PERSONAS.memberA])).rows[0].n,0)
    assert.equal((await action(client,'reactivate',PERSONAS.memberA)).account_status,'active')
  })
})

test('rejection deletes only an empty prospective Auth identity; retained records block it', async () => {
  await transaction(db, async (client) => {
    const empty = await provision(client,{role:'PENDING'})
    const retained = await provision(client,{role:'PENDING'})
    await client.query('insert into public.group_members(group_id,user_id) select id,$1 from public.groups limit 1',[retained.id])
    await asUser(client,personaId(13))
    assert.deepEqual(await action(client,'reject',empty.id),{id:empty.id,rejected:true})
    await denied(client,()=>action(client,'reject',retained.id),'22023')
    await owner(client)
    assert.equal((await client.query('select count(*)::int n from auth.users where id=$1',[empty.id])).rows[0].n,0)
    assert.equal((await client.query('select count(*)::int n from public.profiles where id=$1',[empty.id])).rows[0].n,0)
    assert.equal((await client.query('select count(*)::int n from public.profiles where id=$1',[retained.id])).rows[0].n,1)
  })
})

test('student administrators assign validated independent grants; account managers cannot', async () => {
  await transaction(db, async (client) => {
    await asUser(client,personaId(13))
    await denied(client,()=>action(client,'set_permissions',PERSONAS.memberA,{permissions:['manage_tasks']}),'42501')
    await asUser(client,PERSONAS.officerNoGrants)
    const updated = await action(client,'set_permissions',PERSONAS.memberA,{permissions:['manage_tasks','manage_tasks','export_records']})
    assert.deepEqual(updated.permissions,['export_records','manage_tasks'])
    assert.equal(updated.role,'MEMBER')
    assert.deepEqual((await action(client,'set_permissions',PERSONAS.pending,{permissions:['manage_build_hours']})).permissions,['manage_build_hours'])
    await denied(client,()=>action(client,'set_permissions',PERSONAS.president,{permissions:[]}),'42501')
    await denied(client,()=>action(client,'set_permissions',PERSONAS.deactivated,{permissions:[]}),'42501')
    for (const permissions of [['manage_everything'],[null],['manage_tasks',3],null,'manage_tasks']) {
      await denied(client,()=>action(client,'set_permissions',PERSONAS.memberA,{permissions}),'22023')
    }
  })
})

test('President alone changes student administrator status and preserves grants across promotion/removal/transfer', async () => {
  await transaction(db, async (client) => {
    const student = await provision(client,{grants:['manage_build_hours']})
    await asUser(client,PERSONAS.officer)
    await denied(client,()=>action(client,'make_administrator',student.id,{role:'OFFICER'}),'42501')
    await denied(client,()=>action(client,'transfer_presidency',student.id),'42501')
    await asUser(client,PERSONAS.president)
    await denied(client,()=>action(client,'make_administrator',PERSONAS.mentor,{role:'OFFICER'}),'22023')
    await denied(client,()=>action(client,'make_administrator',student.id,{role:'OWNER'}),'22023')
    const administrator = await action(client,'make_administrator',student.id,{role:'LEADERSHIP'})
    assert.deepEqual(administrator.permissions,['manage_build_hours'])
    assert.equal(administrator.role,'LEADERSHIP')
    assert.deepEqual((await action(client,'remove_administrator',student.id)).permissions,['manage_build_hours'])
    const president = await action(client,'transfer_presidency',student.id)
    assert.equal(president.role,'OWNER')
    assert.deepEqual(president.permissions,['manage_build_hours'])
    await owner(client)
    const {rows:[former]}=await client.query('select role,permissions from public.profiles where id=$1',[PERSONAS.president])
    assert.equal(former.role,'OFFICER')
    assert.deepEqual(former.permissions,[])
    assert.equal((await client.query("select count(*)::int n from public.profiles where role='OWNER' and account_status='active'")).rows[0].n,1)
  })
})

test('unknown actions, missing records and unexpected authority fields explicitly fail', async () => {
  await transaction(db,async client=>{
    await asUser(client,PERSONAS.president)
    await denied(client,()=>rpc(client,'account_action',{action:'delete',id:PERSONAS.memberA}),'22023')
    await denied(client,()=>rpc(client,'account_action',{action:'deactivate'}),'22023')
    await denied(client,()=>action(client,'deactivate',randomUUID()),'P0002')
    await denied(client,()=>action(client,'deactivate',PERSONAS.memberA,{role:'OWNER'}),'22023')
    await denied(client,()=>rpc(client,'profile_action',{action:'unknown'}),'22023')
  })
})

test('removed destructive RPCs and anonymous mutators are not callable; protected rows cannot be purged', async () => {
  await transaction(db,async client=>{
    const {rows}=await client.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('owner_delete_row','owner_delete_member')")
    assert.equal(rows.length,0)
    await asUser(client,PERSONAS.president)
    await denied(client,()=>client.query('delete from public.tasks'),'42501')
    await denied(client,()=>client.query('delete from public.opis'),'42501')
    await client.query('set local role anon')
    await denied(client,()=>rpc(client,'account_action',{action:'deactivate',id:PERSONAS.memberA}),'42501')
    await denied(client,()=>rpc(client,'profile_action',{action:'get_self'}),'42501')
    await denied(client,()=>client.query('select public.handle_new_user()'),'42501')
  })
})

test('concurrent Presidency transfers serialize to one winner and preserve all configurable grants', async () => {
  const left = await connect(), right = await connect()
  try {
    await left.query('begin'); await right.query('begin')
    const sid = await asUser(left,PERSONAS.president)
    // The competing connection must see the real shared session row after commit.
    await left.query('commit')
    await left.query('begin')
    await asUser(left,PERSONAS.president,{sessionId:sid,createSession:false})
    await asUser(right,PERSONAS.president,{sessionId:sid,createSession:false})
    const initial = await db.query('select id,role,permissions from public.profiles where id=any($1::uuid[])',[ [PERSONAS.president,PERSONAS.memberA,PERSONAS.memberB] ])
    const first = await action(left,'transfer_presidency',PERSONAS.memberA)
    assert.equal(first.role,'OWNER')
    const waiting = action(right,'transfer_presidency',PERSONAS.memberB)
    await left.query('commit')
    await assert.rejects(waiting,{code:'42501'})
    await right.query('rollback')
    const {rows}=await db.query('select id,role,permissions from public.profiles where id=any($1::uuid[])',[initial.rows.map(row=>row.id)])
    for(const row of rows) assert.deepEqual(row.permissions,initial.rows.find(old=>old.id===row.id).permissions)
    assert.equal(rows.filter(row=>row.role==='OWNER').length,1)
    assert.equal(rows.find(row=>row.id===PERSONAS.memberA).role,'OWNER')
  } finally {
    await left.query('rollback'); await right.query('rollback')
    // Restore only the three fixture role fields changed by this committed race.
    await db.query('begin')
    try {
      await db.query("update public.profiles set role='MEMBER' where id=$1",[PERSONAS.memberA])
      await db.query("update public.profiles set role='OWNER' where id=$1",[PERSONAS.president])
      await db.query('commit')
    } catch(error) { await db.query('rollback'); throw error }
    await left.end(); await right.end()
  }
})

function authConfiguration() {
  const url = requireLocalURL(process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321',['http:','https:'])
  const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  assert.ok(key,'Real Auth regression requires a local anon key in the test process environment')
  return {url:url.origin,key}
}
async function apiRequest(path, {token,body,method='POST'}={}) {
  const {url,key}=authConfiguration()
  const wireBody = path.startsWith('/rest/v1/rpc/') ? {payload:body} : body
  const response=await fetch(`${url}${path}`,{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(wireBody?{body:JSON.stringify(wireBody)}:{})})
  let data
  try {data=await response.json()} catch {data=null}
  return {response,data}
}

test('real issued access and refresh credentials stay revoked after deactivation/reactivation; fresh sign-in works', async () => {
  const target = await provision(db,{password:true})
  let credentials
  try {
    credentials=await signIn(target.email)
    const sid=JSON.parse(Buffer.from(credentials.access_token.split('.')[1],'base64url').toString()).session_id
    assert.ok(sid,'Auth must issue a session_id')
    const initial=await apiRequest('/rest/v1/rpc/profile_action',{token:credentials.access_token,body:{action:'get_self'}})
    assert.equal(initial.response.ok,true)
    assert.equal(initial.data.id,target.id)
    await transaction(db,async client=>{
      await asUser(client,personaId(13))
      await action(client,'deactivate',target.id)
    },{commit:true})
    const revoked=await apiRequest('/rest/v1/rpc/profile_action',{token:credentials.access_token,body:{action:'get_self'}})
    assert.equal(revoked.response.ok,false)
    assert.equal(revoked.data.code,'28000')
    assert.equal((await db.query('select count(*)::int n from auth.sessions where user_id=$1',[target.id])).rows[0].n,0)
    assert.equal((await db.query('select count(*)::int n from auth.refresh_tokens where user_id=$1',[target.id])).rows[0].n,0)
    const refresh=await apiRequest('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:credentials.refresh_token}})
    assert.equal(refresh.response.ok,false)
    await transaction(db,async client=>{
      await asUser(client,personaId(13))
      await action(client,'reactivate',target.id)
    },{commit:true})
    const stale=await apiRequest('/rest/v1/rpc/profile_action',{token:credentials.access_token,body:{action:'get_self'}})
    assert.equal(stale.response.ok,false)
    assert.equal(stale.data.code,'28000')
    const stillRevoked=await apiRequest('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:credentials.refresh_token}})
    assert.equal(stillRevoked.response.ok,false)
    const fresh=await signIn(target.email)
    const freshState=await apiRequest('/rest/v1/rpc/profile_action',{token:fresh.access_token,body:{action:'get_self'}})
    assert.equal(freshState.response.ok,true)
    assert.equal(freshState.data.account_status,'active')
    const table=await apiRequest('/rest/v1/seasons?select=id',{method:'GET',token:fresh.access_token})
    assert.equal(table.response.ok,true)
    assert.ok(table.data.length>0)
  } finally {
    await owner(db)
    await db.query('delete from public.notifications where user_id=$1',[target.id])
    await db.query('delete from public.notification_preferences where user_id=$1',[target.id])
    await db.query('delete from public.profiles where id=$1',[target.id])
    await db.query('delete from auth.users where id=$1',[target.id])
  }
})

test('private storage checks current session and scoped owner/reviewer permissions',async()=>{
  await transaction(db,async client=>{
    const objects = [
      ['receipts',`${PERSONAS.memberA}/identity-receipt.png`],
      ['outreach-proofs',`${PERSONAS.memberA}/identity-proof.png`],
    ]
    await client.query("insert into storage.objects(bucket_id,name,owner,owner_id) values($1,$2,$3::uuid,$3::text),($4,$5,$3::uuid,$3::text)",[objects[0][0],objects[0][1],PERSONAS.memberA,objects[1][0],objects[1][1]])
    await client.query('update public.individual_outreach set proof_urls=$2 where id=$1',['90000000-0000-4000-8000-000000000001',[objects[1][1]]])
    const {rows:buckets}=await client.query("select public from storage.buckets where id in ('task-evidence','receipts','outreach-proofs')")
    assert.equal(buckets.length,3)
    assert.ok(buckets.every(bucket=>bucket.public===false))
    await asUser(client,PERSONAS.memberA)
    assert.equal((await client.query('select count(*)::int n from storage.objects where name=any($1::text[])',[objects.map(row=>row[1])])).rows[0].n,2)
    await asUser(client,PERSONAS.memberB)
    assert.equal((await client.query('select count(*)::int n from storage.objects where name=any($1::text[])',[objects.map(row=>row[1])])).rows[0].n,0)
    await asUser(client,personaId(23))
    assert.equal((await client.query('select count(*)::int n from storage.objects where name=$1',[objects[0][1]])).rows[0].n,1)
    await asUser(client,personaId(19))
    assert.equal((await client.query('select count(*)::int n from storage.objects where name=$1',[objects[1][1]])).rows[0].n,1)
    await asUser(client,PERSONAS.deactivated)
    assert.equal((await client.query('select count(*)::int n from storage.objects where name=any($1::text[])',[objects.map(row=>row[1])])).rows[0].n,0)
  })
})
