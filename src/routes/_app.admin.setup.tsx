import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { can } from '~/lib/rbac'
import { fmtDate, fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { ProfileRow, TaskGroup } from '~/lib/types'
import { card, cardHead, cardTitle, btn, btnGhost, input, label } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/setup')({
  component: Setup,
})

// Team-wide configuration that previously had no screen: seasons (hour
// targets), invite links, member groups, and task groups. Each section is
// shown only to accounts holding its permission (owners/officers hold all).
function Setup() {
  const { profile } = useAuth()
  const { flash, Toast } = useToast()
  const sections = [
    can(profile, 'manage_seasons') && <Seasons key="s" flash={flash} />,
    can(profile, 'manage_invitations') && <Invites key="i" flash={flash} />,
    can(profile, 'manage_groups') && <Groups key="g" flash={flash} />,
    can(profile, 'manage_tasks') && <TaskGroups key="t" flash={flash} />,
  ].filter(Boolean)

  return (
    <>
      {sections.length ? (
        sections
      ) : (
        <div className={`${card} p-8 text-center text-sm text-ink-soft`}>
          You need the Manage seasons, invitations, groups or tasks permission to use Setup.
        </div>
      )}
      {Toast}
    </>
  )
}

type Flash = (text: string, err?: boolean) => void

/* ------------------------------- Seasons -------------------------------- */

type Season = { id: string; created_at: string; name: string; is_current: boolean; outreach_target: number | null; build_target: number | null }

function Seasons({ flash }: { flash: Flash }) {
  const [rows, setRows] = useState<Season[]>([])
  const [name, setName] = useState('')
  const [outreach, setOutreach] = useState('')
  const [build, setBuild] = useState('')
  const [edits, setEdits] = useState<Record<string, { outreach: string; build: string }>>({})

  async function load() {
    const { data } = await supabase.from('seasons').select('*').order('created_at', { ascending: false })
    setRows((data as Season[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  const num = (s: string) => (s.trim() === '' ? null : Number(s))

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return flash('Season name required', true)
    const first = rows.length === 0
    const { error } = await supabase
      .from('seasons')
      .insert({ name: name.trim(), outreach_target: num(outreach), build_target: num(build), is_current: first })
    if (error) return flash(error.message, true)
    setName('')
    setOutreach('')
    setBuild('')
    flash(first ? 'Season created and set as current' : 'Season created')
    load()
  }

  async function makeCurrent(id: string) {
    // Only one current season: clear the others first.
    const { error: e1 } = await supabase.from('seasons').update({ is_current: false }).neq('id', id).eq('is_current', true)
    const { error: e2 } = await supabase.from('seasons').update({ is_current: true }).eq('id', id)
    if (e1 || e2) return flash((e1 || e2)!.message, true)
    flash('Current season updated')
    load()
  }

  async function saveTargets(s: Season) {
    const ed = edits[s.id]
    const { error } = await supabase
      .from('seasons')
      .update({ outreach_target: num(ed.outreach), build_target: num(ed.build) })
      .eq('id', s.id)
    if (error) return flash(error.message, true)
    setEdits(({ [s.id]: _, ...rest }) => rest)
    flash('Targets saved')
    load()
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Seasons & hour targets</span>
      </div>
      <form onSubmit={create} className="p-5 grid sm:grid-cols-4 gap-4 items-end border-b border-white/6">
        <label className="block sm:col-span-2">
          <span className={label}>New season</span>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="2027 season" />
        </label>
        <label className="block">
          <span className={label}>Outreach target (hrs)</span>
          <input className={input} inputMode="decimal" value={outreach} onChange={(e) => setOutreach(e.target.value)} />
        </label>
        <label className="block">
          <span className={label}>Build target (hrs)</span>
          <input className={input} inputMode="decimal" value={build} onChange={(e) => setBuild(e.target.value)} />
        </label>
        <button className={`${btn} sm:col-span-4 sm:w-fit`}>Create season</button>
      </form>
      <div className="divide-y divide-white/4">
        {rows.map((s) => {
          const ed = edits[s.id]
          return (
            <div key={s.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
              <span className="font-medium">{s.name}</span>
              {s.is_current && <Badge label="current" tone="accent" />}
              {ed ? (
                <>
                  <input
                    className={`${input} w-28 h-8`}
                    aria-label={`${s.name} outreach target`}
                    inputMode="decimal"
                    value={ed.outreach}
                    onChange={(e) => setEdits({ ...edits, [s.id]: { ...ed, outreach: e.target.value } })}
                  />
                  <input
                    className={`${input} w-28 h-8`}
                    aria-label={`${s.name} build target`}
                    inputMode="decimal"
                    value={ed.build}
                    onChange={(e) => setEdits({ ...edits, [s.id]: { ...ed, build: e.target.value } })}
                  />
                  <button onClick={() => saveTargets(s)} className={btnGhost}>
                    Save
                  </button>
                </>
              ) : (
                <span className="text-xs text-ink-soft font-mono">
                  outreach {s.outreach_target ?? '—'} h · build {s.build_target ?? '—'} h
                </span>
              )}
              <span className="ml-auto flex gap-2">
                {!ed && (
                  <button
                    onClick={() =>
                      setEdits({ ...edits, [s.id]: { outreach: String(s.outreach_target ?? ''), build: String(s.build_target ?? '') } })
                    }
                    className={btnGhost}
                  >
                    Edit targets
                  </button>
                )}
                {!s.is_current && (
                  <button onClick={() => makeCurrent(s.id)} className={btnGhost}>
                    Make current
                  </button>
                )}
              </span>
            </div>
          )
        })}
        {rows.length === 0 && (
          <div className="px-5 py-6 text-center text-sm text-ink-soft">
            No seasons yet. Create one so hour targets and progress bars work.
          </div>
        )}
      </div>
    </section>
  )
}

/* ----------------------------- Invite links ----------------------------- */

type Invite = { id: string; created_at: string; code: string; expires_at: string; revoked: boolean }

const makeCode = () => {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alikes (0/o, 1/l/i)
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

function Invites({ flash }: { flash: Flash }) {
  const { user } = useAuth()
  const [rows, setRows] = useState<Invite[]>([])
  const [days, setDays] = useState(7)

  const linkFor = (code: string) => `${window.location.origin}${import.meta.env.BASE_URL}invite?code=${code}`

  async function load() {
    const { data } = await supabase.from('invitations').select('*').order('created_at', { ascending: false }).limit(50)
    setRows((data as Invite[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  async function create() {
    const code = makeCode()
    const expires_at = new Date(Date.now() + days * 864e5).toISOString()
    const { error } = await supabase.from('invitations').insert({ code, expires_at, created_by: user!.id, revoked: false })
    if (error) return flash(error.message, true)
    try {
      await navigator.clipboard.writeText(linkFor(code))
      flash('Invite link created and copied')
    } catch {
      flash('Invite link created')
    }
    load()
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(linkFor(code))
      flash('Link copied')
    } catch {
      flash('Copy failed — select the link manually', true)
    }
  }

  async function revoke(id: string) {
    const { error } = await supabase.from('invitations').update({ revoked: true }).eq('id', id)
    if (error) return flash(error.message, true)
    flash('Invite revoked')
    load()
  }

  const now = Date.now()
  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Invite links</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-soft">Expires in</span>
          {[1, 7, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`${btnGhost} ${days === d ? 'bg-accent/15 border-accent/40 text-accent' : ''}`}
            >
              {d}d
            </button>
          ))}
          <button onClick={create} className={btnGhost}>
            New link
          </button>
        </div>
      </div>
      <p className="px-5 pt-3 text-xs text-ink-soft">
        Anyone with an active link can sign up; their account still waits for approval under Members → Pending.
      </p>
      <div className="divide-y divide-white/4 mt-2">
        {rows.map((r) => {
          const expired = new Date(r.expires_at).getTime() < now
          const status = r.revoked ? 'revoked' : expired ? 'expired' : 'active'
          return (
            <div key={r.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
              <code className={`font-mono text-xs break-all ${status === 'active' ? '' : 'text-ink-soft line-through'}`}>{linkFor(r.code)}</code>
              <Badge label={status} tone={status === 'active' ? 'APPROVED' : 'neutral'} />
              <span className="text-[11px] text-ink-soft">
                {status === 'active' ? `expires ${fmtDateTime(r.expires_at)}` : `created ${fmtDate(r.created_at)}`}
              </span>
              {status === 'active' && (
                <span className="ml-auto flex gap-2">
                  <button onClick={() => copy(r.code)} className={btnGhost}>
                    Copy
                  </button>
                  <button onClick={() => revoke(r.id)} className={`${btnGhost} text-[#f07070]`}>
                    Revoke
                  </button>
                </span>
              )}
            </div>
          )
        })}
        {rows.length === 0 && <div className="px-5 py-6 text-center text-sm text-ink-soft">No invite links yet.</div>}
      </div>
    </section>
  )
}

/* -------------------------------- Groups -------------------------------- */

type Group = { id: string; name: string }

function Groups({ flash }: { flash: Flash }) {
  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<ProfileRow[]>([])
  const [links, setLinks] = useState<{ group_id: string; user_id: string }[]>([])
  const [name, setName] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  async function load() {
    const [{ data: g }, { data: m }, { data: l }] = await Promise.all([
      supabase.from('groups').select('id, name').order('name'),
      supabase.from('profiles').select('id, display_name').eq('account_status', 'active').neq('role', 'PENDING').order('display_name'),
      supabase.from('group_members').select('group_id, user_id'),
    ])
    setGroups((g as Group[]) || [])
    setMembers((m as ProfileRow[]) || [])
    setLinks((l as { group_id: string; user_id: string }[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const { error } = await supabase.from('groups').insert({ name: name.trim() })
    if (error) return flash(error.message, true)
    setName('')
    flash('Group created')
    load()
  }

  async function toggle(groupId: string, userId: string, inGroup: boolean) {
    const { error } = inGroup
      ? await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', userId)
      : await supabase.from('group_members').insert({ group_id: groupId, user_id: userId })
    if (error) return flash(error.message, true)
    load()
  }

  async function remove(g: Group) {
    if (!confirm(`Delete the group "${g.name}"? Members stay; only the group is removed.`)) return
    await supabase.from('group_members').delete().eq('group_id', g.id)
    const { error } = await supabase.from('groups').delete().eq('id', g.id)
    if (error) return flash(error.message, true)
    flash('Group deleted')
    load()
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Member groups</span>
        <form onSubmit={create} className="flex gap-2">
          <input className={`${input} h-8 w-48`} placeholder="e.g. Mechanical" aria-label="New group name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className={btnGhost}>Add</button>
        </form>
      </div>
      <div className="divide-y divide-white/4">
        {groups.map((g) => {
          const ids = new Set(links.filter((l) => l.group_id === g.id).map((l) => l.user_id))
          return (
            <div key={g.id} className="px-5 py-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setOpen(open === g.id ? null : g.id)} aria-expanded={open === g.id} className="font-medium hover:text-accent">
                  {open === g.id ? '▾' : '▸'} {g.name}
                </button>
                <span className="text-xs text-ink-soft">
                  {ids.size} member{ids.size === 1 ? '' : 's'}
                </span>
                <button onClick={() => remove(g)} className={`${btnGhost} ml-auto text-[#f07070]`}>
                  Delete
                </button>
              </div>
              {open === g.id && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 mt-3">
                  {members.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/[0.03] px-2 py-1 rounded-md">
                      <input type="checkbox" className="h-4 w-4 accent-accent" checked={ids.has(m.id)} onChange={() => toggle(g.id, m.id, ids.has(m.id))} />
                      <span className="truncate">{m.display_name ?? m.id}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {groups.length === 0 && <div className="px-5 py-6 text-center text-sm text-ink-soft">No groups yet (e.g. sub-teams).</div>}
      </div>
    </section>
  )
}

/* ------------------------------ Task groups ----------------------------- */

const COLORS = ['#b4f54e', '#4ec9f5', '#f5a54e', '#f07070', '#b58cf5', '#5dd89a', '#e7c08a', '#9aa4b2']

function TaskGroups({ flash }: { flash: Flash }) {
  const [rows, setRows] = useState<TaskGroup[]>([])
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])

  async function load() {
    const { data } = await supabase.from('task_groups').select('*').order('name')
    setRows((data as TaskGroup[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const { error } = await supabase.from('task_groups').insert({ name: name.trim(), color })
    if (error) return flash(error.message, true)
    setName('')
    flash('Task group created')
    load()
  }

  async function remove(g: TaskGroup) {
    if (!confirm(`Delete task group "${g.name}"?`)) return
    const { error } = await supabase.from('task_groups').delete().eq('id', g.id)
    if (error) return flash(error.message.includes('foreign key') ? 'Tasks still use this group — move them first' : error.message, true)
    flash('Task group deleted')
    load()
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Task groups</span>
      </div>
      <form onSubmit={create} className="p-5 flex flex-wrap items-end gap-3 border-b border-white/6">
        <label className="block">
          <span className={label}>Name</span>
          <input className={`${input} w-48`} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Drivetrain" />
        </label>
        <fieldset>
          <legend className={label}>Color</legend>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-lg border-2 ${color === c ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </fieldset>
        <button className={btnGhost}>Add group</button>
      </form>
      <div className="p-5 flex flex-wrap gap-2">
        {rows.map((g) => (
          <span key={g.id} className="inline-flex items-center gap-2 pl-3 pr-1 h-8 rounded-lg border border-white/10 bg-white/5 text-sm">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
            {g.name}
            <button onClick={() => remove(g)} aria-label={`Delete ${g.name}`} className="h-6 w-6 rounded-md text-ink-soft hover:text-[#f07070] hover:bg-white/10">
              ×
            </button>
          </span>
        ))}
        {rows.length === 0 && <span className="text-sm text-ink-soft">No task groups yet.</span>}
      </div>
    </section>
  )
}
