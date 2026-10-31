import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import { connect, transaction, asUser, rpc, PERSONAS, personaId } from './helpers.mjs'

let db
before(async () => { db = await connect() })
after(async () => { await db?.end() })
const seasonManager = personaId(17)

async function rejected(client, run, pattern) {
  await client.query('savepoint rejected_action')
  try { await assert.rejects(run, pattern) }
  finally { await client.query('rollback to savepoint rejected_action') }
}

test('season manager creates trimmed unique seasons, edits exact targets and cannot configure caps', async () => {
  await transaction(db, async (client) => {
    await asUser(client, seasonManager)
    const name = `Season ${randomUUID()}`
    const season = await rpc(client, 'season_action', { action: 'create', name: `  ${name}  `, outreach_target: 1.5, build_target: 61 / 60 })
    assert.equal(season.name, name)
    assert.equal(season.individual_outreach_cap_minutes, 360)
    assert.equal(season.outreach_target, 1.5)
    assert.equal(season.build_target, 61 / 60)
    await rejected(client, () => rpc(client, 'season_action', { action: 'create', name: ` ${name} ` }), /unique|duplicate/i)
    const edited = await rpc(client, 'season_action', { action: 'edit', id: season.id, name: `${name} edited`, outreach_target: 0 })
    assert.equal(edited.name, `${name} edited`)
    assert.equal(edited.outreach_target, 0)
    assert.equal(edited.build_target, season.build_target)
    assert.equal(edited.individual_outreach_cap_minutes, 360)
    for (const field of ['individual_outreach_cap_minutes', 'cap_minutes']) {
      await rejected(client, () => rpc(client, 'season_action', { action: 'edit', id: season.id, [field]: 0 }), /Unsupported season fields/)
    }
    await rejected(client, () => client.query('update public.seasons set outreach_target=99 where id=$1', [season.id]), /permission denied/)
  })
})

test('invalid names, numeric targets, IDs and actions reject without changing current season', async () => {
  await transaction(db, async (client) => {
    await asUser(client, seasonManager)
    const initial = (await client.query('select id from public.seasons where is_current')).rows
    for (const name of ['', '   ', null, 123]) {
      await rejected(client, () => rpc(client, 'season_action', { action: 'create', name }), /name.*required/i)
    }
    for (const field of ['outreach_target', 'build_target']) {
      for (const value of [-1, null, 'NaN', 'Infinity', true, {}, []]) {
        await rejected(client, () => rpc(client, 'season_action', { action: 'create', name: randomUUID(), [field]: value }), /finite|numeric|syntax/i)
      }
    }
    for (const payload of [{ action: 'remove' }, { action: 'set_current' }, { action: 'set_current', id: randomUUID() }, { action: 'edit', id: initial[0].id, is_current: false }]) {
      await rejected(client, () => rpc(client, 'season_action', payload), /Unknown|id is required|not found|Unsupported/)
    }
    assert.deepEqual((await client.query('select id from public.seasons where is_current')).rows, initial)
    await rejected(client, () => client.query("insert into public.seasons(name,individual_outreach_cap_minutes) values($1,'NaN')", [randomUUID()]), /permission denied/)
    await client.query('reset role')
    for (const value of ['-1', 'NaN', 'Infinity', '-Infinity']) {
      await rejected(client, () => client.query('insert into public.seasons(name,individual_outreach_cap_minutes) values($1,$2)', [randomUUID(), value]), /check constraint/)
    }
  })
})

test('first season is current automatically and a failed creation cannot clear it', async () => {
  await transaction(db, async (client) => {
    // Isolate an empty installation transactionally without disturbing fixture history.
    await client.query('truncate public.seasons cascade')
    await asUser(client, seasonManager)
    const first = await rpc(client, 'season_action', { action: 'create', name: 'First', is_current: false })
    assert.equal(first.is_current, true)
    await rejected(client, () => rpc(client, 'season_action', { action: 'create', name: ' First ', is_current: true }), /unique|duplicate/i)
    assert.deepEqual((await client.query('select id from public.seasons where is_current')).rows, [{ id: first.id }])
    const second = await rpc(client, 'season_action', { action: 'create', name: 'Second' })
    assert.equal(second.is_current, false)
    assert.equal((await rpc(client, 'season_action', { action: 'set_current', id: second.id })).is_current, true)
    assert.deepEqual((await client.query('select id from public.seasons where is_current')).rows, [{ id: second.id }])
  })
})

test('season current switches preserve explicit parent attribution and expose no private account data', async () => {
  await transaction(db, async (client) => {
    const before = {}
    for (const table of ['build_sessions', 'outreach_events', 'tasks', 'individual_outreach', 'opis']) {
      before[table] = (await client.query(`select id,season_id from public.${table} order by id`)).rows
    }
    await asUser(client, seasonManager)
    const season = await rpc(client, 'season_action', { action: 'create', name: `Future ${randomUUID()}` })
    const result = await rpc(client, 'season_action', { action: 'set_current', id: season.id })
    assert.deepEqual(Object.keys(result).sort(), ['id', 'created_at', 'name', 'is_current', 'outreach_target', 'build_target', 'individual_outreach_cap_minutes'].sort())
    await client.query('reset role')
    for (const table of Object.keys(before)) {
      assert.deepEqual((await client.query(`select id,season_id from public.${table} order by id`)).rows, before[table], `${table} attribution must not follow the current marker`)
    }
    await asUser(client, PERSONAS.memberA)
    assert((await client.query('select id from public.seasons where id=$1', [season.id])).rows.length === 1)
    await rejected(client, () => rpc(client, 'season_action', { action: 'edit', id: season.id, name: 'Not authorized' }), /permission required/i)
    await asUser(client, PERSONAS.officerNoGrants)
    await rejected(client, () => rpc(client, 'season_action', { action: 'set_current', id: season.id }), /permission required/i)
    await asUser(client, PERSONAS.pending)
    assert.equal((await client.query('select id from public.seasons')).rows.length, 0)
  })
})

test('concurrent current switches serialize and readers retain one committed marker', async () => {
  const first = await connect()
  const second = await connect()
  const observer = await connect()
  const sessions = []
  const ids = []
  const original = (await db.query('select id from public.seasons where is_current')).rows[0].id
  try {
    await transaction(db, async (client) => {
      sessions.push(await asUser(client, seasonManager))
      for (const suffix of ['A', 'B']) ids.push((await rpc(client, 'season_action', { action: 'create', name: `Concurrent ${suffix} ${randomUUID()}` })).id)
    }, { commit: true })
    await first.query('begin')
    sessions.push(await asUser(first, seasonManager))
    await rpc(first, 'season_action', { action: 'set_current', id: ids[0] })
    assert.equal((await observer.query('select id from public.seasons where is_current')).rows[0].id, original)
    await second.query('begin')
    sessions.push(await asUser(second, seasonManager))
    const waiting = rpc(second, 'season_action', { action: 'set_current', id: ids[1] })
    await first.query('commit')
    assert.equal((await waiting).id, ids[1])
    await second.query('commit')
    assert.deepEqual((await observer.query('select id from public.seasons where is_current')).rows, [{ id: ids[1] }])
  } finally {
    await first.query('rollback')
    await second.query('rollback')
    await transaction(db, async (client) => {
      sessions.push(await asUser(client, seasonManager))
      await rpc(client, 'season_action', { action: 'set_current', id: original })
      await client.query('reset role')
      await client.query('delete from public.seasons where id=any($1::uuid[])', [ids])
      await client.query('delete from auth.sessions where id=any($1::uuid[])', [sessions])
    }, { commit: true })
    await Promise.all([first.end(), second.end(), observer.end()])
  }
})

test('President settings support only validated documented fields and canonical timezone', async () => {
  await transaction(db, async (client) => {
    await asUser(client, PERSONAS.president)
    const initial = await rpc(client, 'settings_action', { action: 'get' })
    assert.equal(initial.timezone, 'America/Los_Angeles')
    assert.deepEqual(Object.keys(initial).sort(), ['org_name', 'timezone', 'build_default_radius_m'].sort())
    const saved = await rpc(client, 'settings_action', { action: 'edit', org_name: '  Local Team  ', build_default_radius_m: 1609.344, timezone: 'America/Los_Angeles' })
    assert.equal(saved.org_name, 'Local Team')
    assert.equal(saved.build_default_radius_m, '1609.344')
    for (const fields of [{ org_name: '' }, { org_name: null }, { timezone: 'America/Chicago' }, { timezone: null }, { build_default_radius_m: 0 }, { build_default_radius_m: -1 }, { build_default_radius_m: 'NaN' }, { build_default_radius_m: 'Infinity' }, { build_default_radius_m: null }, { unknown: 'value' }, { permissions: ['manage_accounts'] }]) {
      await rejected(client, () => rpc(client, 'settings_action', { action: 'edit', ...fields }), /required|Timezone|finite|Unsupported/i)
      assert.deepEqual(await rpc(client, 'settings_action', { action: 'get' }), saved)
    }
    await rejected(client, () => client.query("update public.org_settings set value='UTC' where key='timezone'"), /permission denied/)
    for (const user of [seasonManager, PERSONAS.officer, PERSONAS.memberA, PERSONAS.pending]) {
      await asUser(client, user)
      await rejected(client, () => rpc(client, 'settings_action', { action: 'get' }), /President permission required/)
      await rejected(client, () => rpc(client, 'settings_action', { action: 'edit', org_name: 'Unauthorized' }), /President permission required/)
    }
  })
})

test('interim hours aggregates preserve exact 90-second and 61-minute credit without widening access', async () => {
  await transaction(db, async (client) => {
    const session = (await client.query("select id from public.build_sessions where season_id='20000000-0000-4000-8000-000000000001' and not cancelled limit 1")).rows[0].id
    await client.query('delete from public.build_records where member_id=$1', [PERSONAS.memberA])
    for (const [start, end, minutes] of [
      ['2040-01-01T00:00:00Z', '2040-01-01T00:01:30Z', 1.5],
      ['2040-01-02T00:00:00Z', '2040-01-02T01:01:00Z', 61],
    ]) {
      const record = (await client.query(`insert into public.build_records(session_id,member_id,check_in,check_out,checkout_method,credited_minutes)
        values($1,$2,$3,$4,'administrative correction',extract(epoch from ($4::timestamptz-$3::timestamptz))/60.0) returning id`,
      [session, PERSONAS.memberA, start, end])).rows[0]
      await asUser(client, PERSONAS.memberA)
      const totals=await rpc(client,'season_hours',{season_id:'20000000-0000-4000-8000-000000000001'})
      const row=totals.members.find(row=>row.id===PERSONAS.memberA)
      assert(Math.abs(Number(row.build_minutes)-minutes)<1e-12)
      if(minutes===61)assert.equal((Number(row.build_minutes)/60).toFixed(2),'1.02')
      await client.query('reset role')
      await client.query('delete from public.build_records where id=$1', [record.id])
    }
    await asUser(client, PERSONAS.pending)
    await rejected(client,()=>rpc(client,'season_hours',{}))
  })
})
