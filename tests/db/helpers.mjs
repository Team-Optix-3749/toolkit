import { randomUUID } from 'node:crypto'
import pg from 'pg'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
export const LOCAL_PASSWORD = 'Optix-local-only-3749!'
export const personaId = (number) => `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`
export const PERSONAS = Object.freeze({
  president: personaId(1), officer: personaId(2), leadership: personaId(3),
  memberA: personaId(4), memberB: personaId(5), mentor: personaId(6),
  pending: personaId(7), unverified: personaId(8), deactivated: personaId(9),
  reviewer: personaId(10), eventLead: personaId(11), officerNoGrants: personaId(12),
})
export const PERMISSIONS = Object.freeze([
  'manage_accounts', 'manage_invitations', 'manage_tasks', 'manage_groups',
  'manage_seasons', 'manage_outreach_events', 'manage_outreach_attendance',
  'manage_build_hours', 'manage_opis', 'export_records', 'manage_purchases', 'manage_scouting',
])

export function requireLocalURL(value, protocols = ['postgres:', 'postgresql:']) {
  const url = new URL(value)
  if (!protocols.includes(url.protocol) || !LOCAL_HOSTS.has(url.hostname)) {
    throw new Error('Tests require an explicit localhost URL')
  }
  // Connection-string query parameters can override the parsed host in libpq/pg.
  if ([...url.searchParams.keys()].some((key) => key !== 'sslmode') || url.hash) {
    throw new Error('Connection URL must not override localhost connection settings')
  }
  return url
}

export const DATABASE_URL = process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
requireLocalURL(DATABASE_URL)

export async function connect(connectionString = DATABASE_URL) {
  requireLocalURL(connectionString)
  const client = new pg.Client({ connectionString })
  await client.connect()
  return client
}

// Every test rolls back by default, including fake Auth sessions and claim changes.
export async function transaction(client, run, { commit = false } = {}) {
  await client.query('begin')
  try {
    const result = await run(client)
    await client.query(commit ? 'commit' : 'rollback')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  }
}

// Call inside transaction(). Matching local auth.sessions rows are essential:
// a JWT subject alone must never bypass the production session validator.
export async function asUser(client, id, { sessionId = randomUUID(), createSession = true } = {}) {
  await client.query('reset role')
  if (createSession) {
    await client.query(`
      insert into auth.sessions (id, user_id, created_at, updated_at, aal)
      values ($1, $2, now(), now(), 'aal1')
      on conflict (id) do nothing`, [sessionId, id])
    const { rows } = await client.query('select user_id from auth.sessions where id=$1', [sessionId])
    if (rows[0]?.user_id !== id) throw new Error('Fake session belongs to a different user')
  }
  const claims = { sub: id, role: 'authenticated', aud: 'authenticated', aal: 'aal1', session_id: sessionId }
  await client.query(`select set_config('request.jwt.claim.sub',$1,true),
    set_config('request.jwt.claim.role','authenticated',true),
    set_config('request.jwt.claims',$2,true)`, [id, JSON.stringify(claims)])
  await client.query('set local role authenticated')
  return sessionId
}

export async function rpc(client, name, payload) {
  if (!/^[a-z][a-z_0-9]*$/.test(name)) throw new Error('Invalid RPC name')
  const { rows } = await client.query(`select public.${name}($1::jsonb) as result`, [JSON.stringify(payload)])
  return rows[0].result
}

// Real Auth-issued credentials are required for token revocation/browser checks.
// Never return or log service-role keys from this helper.
export async function signIn(email, password = LOCAL_PASSWORD) {
  if (!email.endsWith('@example.test')) throw new Error('Only fake local identities may sign in')
  const value = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
  const url = requireLocalURL(value, ['http:', 'https:'])
  if (url.username || url.password) throw new Error('API URL must not contain credentials')
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!key) throw new Error('Set VITE_SUPABASE_ANON_KEY to the local publishable/anon key')
  const response = await fetch(new URL('/auth/v1/token?grant_type=password', url), {
    method: 'POST',
    redirect: 'error',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw new Error(`Local fake-account sign-in failed (${response.status})`)
  return response.json()
}
