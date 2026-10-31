import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { connect, PERMISSIONS, PERSONAS, personaId, transaction } from './helpers.mjs'

let db
before(async () => { db = await connect() })
after(async () => { await db?.end() })

const TABLES = [
  'profiles', 'seasons', 'invitations', 'groups', 'group_members', 'task_groups',
  'tasks', 'task_submissions', 'task_submission_evidence', 'task_reviewers', 'task_evidence', 'task_history',
  'build_locations', 'build_sessions', 'build_records', 'outreach_events',
  'outreach_leads', 'outreach_rsvps', 'outreach_attendance', 'opis', 'opi_versions',
  'opi_feedback', 'individual_outreach', 'purchases', 'notifications',
  'notification_preferences', 'org_settings', 'scout_events',
  'scout_matches', 'scout_assignments', 'match_scouting', 'pit_scouting',
]

test('every current route-model and retained-feature table exists with RLS', async () => {
  const { rows } = await db.query(`select c.relname,c.relrowsecurity,
    exists(select 1 from pg_policy p where p.polrelid=c.oid) as has_policy
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relname=any($1::text[])`, [TABLES])
  assert.deepEqual(rows.map((r) => r.relname).sort(), [...TABLES].sort())
  for (const row of rows) {
    assert.equal(row.relrowsecurity, true, `${row.relname} requires RLS`)
    assert.equal(row.has_policy, true, `${row.relname} requires a policy`)
  }
})

test('participation credit is numeric and domain attribution has foreign keys', async () => {
  const { rows: credit } = await db.query(`select table_name,data_type from information_schema.columns
    where table_schema='public' and table_name=any($1::text[]) and column_name='credited_minutes'`,
  [['build_records', 'outreach_attendance']])
  assert.equal(credit.length, 2)
  assert.ok(credit.every((row) => row.data_type === 'numeric'))
  const required = [
    ['build_sessions','location_id','build_locations'], ['build_sessions','season_id','seasons'],
    ['build_records','session_id','build_sessions'], ['build_records','member_id','profiles'],
    ['outreach_events','season_id','seasons'], ['outreach_attendance','event_id','outreach_events'],
    ['outreach_attendance','member_id','profiles'], ['opis','submitter_id','profiles'],
    ['opi_versions','opi_id','opis'], ['opi_feedback','opi_id','opis'],
  ]
  const { rows } = await db.query(`select source.relname as source,a.attname as column,target.relname as target
    from pg_constraint con join pg_class source on source.oid=con.conrelid
    join pg_namespace n on n.oid=source.relnamespace
    join pg_class target on target.oid=con.confrelid
    join pg_attribute a on a.attrelid=source.oid and a.attnum=any(con.conkey)
    where con.contype='f' and n.nspname='public'`)
  for (const [source, column, target] of required) {
    assert.ok(rows.some((r) => r.source === source && r.column === column && r.target === target),
      `Missing foreign key ${source}.${column} -> ${target}`)
  }
})

test('domain RPCs and notification internals do not grant anonymous/default execution', async () => {
  const names = ['build_action', 'outreach_action', 'opi_action', 'notify', 'notify_many']
  const { rows } = await db.query(`select p.proname,
    has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
    exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where a.grantee=0 and a.privilege_type='EXECUTE') as public_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any($1::text[])`, [names])
  for (const name of names) assert.ok(rows.some((r) => r.proname === name), `Missing ${name}`)
  for (const row of rows) {
    assert.equal(row.anon_execute, false, `${row.proname} anon execution`)
    assert.equal(row.public_execute, false, `${row.proname} PUBLIC execution`)
  }
  const { rows: triggers } = await db.query(`select t.tgname from pg_trigger t
    where t.tgrelid='auth.users'::regclass and not t.tgisinternal and t.tgenabled<>'D'`)
  assert.ok(triggers.length > 0, 'Auth provisioning trigger must be enabled')
})

test('all three retained attachment buckets exist', async () => {
  const { rows } = await db.query(`select id from storage.buckets where id=any($1::text[])`,
    [['task-evidence', 'receipts', 'outreach-proofs']])
  assert.deepEqual(rows.map((r) => r.id).sort(), ['outreach-proofs', 'receipts', 'task-evidence'])
})

test('local fake personas retain identities, verification states and explicit grants', async () => {
  const ids = Array.from({ length: 24 }, (_, index) => personaId(index + 1))
  const { rows } = await db.query(`select p.id,p.role,p.account_type,p.account_status,p.permissions,
    u.email,u.email_confirmed_at,exists(select 1 from auth.identities i
      where i.user_id=u.id and i.provider='email' and i.provider_id=u.id::text) as has_identity
    from public.profiles p join auth.users u on u.id=p.id where p.id=any($1::uuid[]) order by p.id`, [ids])
  assert.equal(rows.length, 24)
  assert.ok(rows.every((r) => r.email.endsWith('@example.test') && r.has_identity))
  assert.equal(rows.filter((r) => r.role === 'OWNER').length, 1)
  assert.equal(rows[0].id, PERSONAS.president)
  assert.equal(rows[5].account_type, 'mentor')
  assert.equal(rows[6].role, 'PENDING')
  assert.equal(rows[7].email_confirmed_at, null)
  assert.equal(rows[8].account_status, 'deactivated')
  assert.deepEqual(rows[11].permissions, [])
  for (let index = 0; index < PERMISSIONS.length; index++) {
    assert.equal(rows[index + 12].role, 'MEMBER')
    assert.deepEqual(rows[index + 12].permissions, [PERMISSIONS[index]])
  }
})

test('new Auth identity is provisioned without client profile insertion', async () => {
  await transaction(db, async (client) => {
    const id = randomUUID()
    await client.query(`insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data)
      values($1,'authenticated','authenticated',$2,'{"provider":"email","providers":["email"]}',
      '{"name":"Fake Provisioning Test","account_type":"member"}')`,
    [id, `provision-${id}@example.test`])
    const { rows } = await client.query('select role,account_status,permissions from public.profiles where id=$1', [id])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].role, 'PENDING')
    assert.equal(rows[0].account_status, 'active')
    assert.deepEqual(rows[0].permissions, [])
  })
})

test('seed preserves exact participation credit and parent season attribution', async () => {
  for (const [table, parent, parentKey, start, end, id] of [
    ['build_records','build_sessions','session_id','check_in','check_out','41000000-0000-4000-8000-000000000001'],
    ['outreach_attendance','outreach_events','event_id','arrival','departure','51000000-0000-4000-8000-000000000001'],
  ]) {
    const { rows } = await db.query(`select r.member_id,r.credited_minutes,
      extract(epoch from(r.${end}-r.${start}))/60 as elapsed,p.season_id,
      lower_inc(r.credit_interval) as includes_start,upper_inc(r.credit_interval) as includes_end
      from public.${table} r join public.${parent} p on p.id=r.${parentKey} where r.id=$1`, [id])
    assert.equal(rows.length, 1)
    assert.equal(rows[0].member_id, PERSONAS.memberA)
    assert.equal(Number(rows[0].credited_minutes), 1.5)
    assert.equal(Number(rows[0].elapsed), 1.5)
    assert.equal(rows[0].season_id, '20000000-0000-4000-8000-000000000002')
    assert.equal(rows[0].includes_start, true)
    assert.equal(rows[0].includes_end, false)
  }
})

test('group ownership and retained OPI/task/scouting history remain attributed', async () => {
  const { rows: tasks } = await db.query(`select status,owner_group_id from public.tasks
    where id::text like '70000000-%'`)
  assert.equal(tasks.length, 7)
  assert.ok(tasks.every((r) => r.owner_group_id))
  const { rows: versions } = await db.query(`select o.id,v.opi_id,v.title,v.summary,v.document_url
    from public.opis o join public.opi_versions v on v.opi_id=o.id
    where o.id::text like '80000000-%'`)
  assert.equal(versions.length, 6)
  assert.ok(versions.every((r) => r.id === r.opi_id && r.title && r.summary && r.document_url))
  const { rows: history } = await db.query(`select user_id,feedback from public.task_history
    where id='72000000-0000-4000-8000-000000000001'`)
  assert.equal(history[0].user_id, PERSONAS.reviewer)
  assert.ok(history[0].feedback)
  const { rows: scouting } = await db.query(`select scout_id,data from public.match_scouting
    where id='96000000-0000-4000-8000-000000000001'`)
  assert.equal(scouting[0].scout_id, PERSONAS.memberA)
  assert.deepEqual(scouting[0].data.auto_path, [[[0.1, 0.2], [0.3, 0.4]]])
  assert.equal(scouting[0].data.auto_scored, 2)
})
