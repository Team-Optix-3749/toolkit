import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { can } from '~/lib/rbac'
import { fmtDate, fmtDateTime } from '~/lib/format'
import { Badge } from '~/components/Badge'
import type { ProfileRow, TaskGroup, Season, SeasonActionPayload } from '~/lib/types'
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

type SeasonDraft = { name: string; outreach: string; build: string }

function Seasons({ flash }: { flash: Flash }) {
  const [rows, setRows] = useState<Season[]>([])
  const [draft, setDraft] = useState<SeasonDraft>({ name: '', outreach: '0', build: '0' })
  const [edits, setEdits] = useState<Record<string, SeasonDraft>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const { data, error } = await supabase.from('seasons')
        .select('id, created_at, name, is_current, outreach_target, build_target, individual_outreach_cap_minutes')
        .order('created_at', { ascending: false })
      if (error) throw error
      setRows((data as Season[]) || [])
    } catch (cause) {
      setLoadError(message(cause, 'Could not load seasons. Please retry.'))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  function message(cause: unknown, fallback: string) {
    return cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string' ? cause.message : fallback
  }

  function values(value: SeasonDraft) {
    const outreach = Number(value.outreach)
    const build = Number(value.build)
    if (!value.name.trim()) throw new Error('Season name is required.')
    if (!value.outreach.trim() || !value.build.trim() || !Number.isFinite(outreach) || !Number.isFinite(build) || outreach < 0 || build < 0) {
      throw new Error('Targets must be finite, nonnegative hours. Enter 0 for an unset target.')
    }
    return { name: value.name.trim(), outreach_target: outreach, build_target: build }
  }

  async function mutate(payload: SeasonActionPayload, success: string, saved?: () => void) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const { error } = await supabase.rpc('season_action', { payload })
      if (error) throw error
      saved?.()
      flash(success)
      await load()
    } catch (cause) {
      const detail = message(cause, 'Season change failed. Please retry.')
      setError(detail)
      flash(detail, true)
    } finally {
      setBusy(false)
    }
  }

  function save(event: React.FormEvent, id?: string) {
    event.preventDefault()
    try {
      const fields = values(id ? edits[id] : draft)
      void mutate(id ? { action: 'edit', id, ...fields } : { action: 'create', ...fields },
        id ? 'Season saved' : 'Season created', () => {
          if (id) setEdits(({ [id]: _, ...rest }) => rest)
          else setDraft({ name: '', outreach: '0', build: '0' })
        })
    } catch (cause) {
      setError(message(cause, 'Check the season name and targets.'))
    }
  }

  function fields(value: SeasonDraft, change: (next: SeasonDraft) => void, prefix: string) {
    return <>
      <label className="block sm:col-span-2">
        <span className={label}>{prefix} name</span>
        <input required className={input} value={value.name} onChange={(event) => change({ ...value, name: event.target.value })} placeholder="2027 season" />
      </label>
      <label className="block">
        <span className={label}>Outreach target (hours)</span>
        <input required type="number" min="0" step="any" className={input} value={value.outreach} onChange={(event) => change({ ...value, outreach: event.target.value })} />
      </label>
      <label className="block">
        <span className={label}>Build target (hours)</span>
        <input required type="number" min="0" step="any" className={input} value={value.build} onChange={(event) => change({ ...value, build: event.target.value })} />
      </label>
    </>
  }

  return (
    <section className={card} aria-busy={busy || loading}>
      <div className={cardHead}><span className={cardTitle}>Seasons & hour targets</span></div>
      <p className="px-5 pt-4 text-sm text-ink-soft">Targets apply uniformly to every member. Seasons have no implied date range: records belong to their explicitly selected season. Changing the current season does not move historical records.</p>
      {error && <p role="alert" className="px-5 pt-4 text-sm text-red-400">{error}</p>}
      {loadError && <div role="alert" className="p-5 text-sm"><p>{loadError}</p><button type="button" className={btnGhost} disabled={loading || busy} onClick={() => void load()}>Retry loading seasons</button></div>}
      <form onSubmit={(event) => save(event)}>
        <fieldset disabled={busy || loading || !!loadError} className="p-5 grid sm:grid-cols-4 gap-4 items-end border-b border-white/6">
          {fields(draft, setDraft, 'New season')}
          <p className="sm:col-span-4 text-xs text-ink-soft">The first season becomes current automatically. New seasons start with an individual outreach cap of 360 minutes (6 hours).</p>
          <button className={`${btn} sm:col-span-4 sm:w-fit`}>{busy ? 'Saving…' : 'Create season'}</button>
        </fieldset>
      </form>
      <div className="divide-y divide-white/4">
        {loading && <p role="status" className="p-5 text-sm text-ink-soft">Loading seasons…</p>}
        {!loading && !loadError && rows.map((season) => {
          const edit = edits[season.id]
          return (
            <div key={season.id} className="px-5 py-4 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{season.name}</span>
                {season.is_current && <Badge label="current" tone="accent" />}
                {!edit && <span className="text-xs text-ink-soft font-mono">outreach {season.outreach_target} h · build {season.build_target} h</span>}
                <span className="ml-auto flex gap-2">
                  {!edit && <button type="button" disabled={busy || loading} className={btnGhost} onClick={() => setEdits({ ...edits, [season.id]: { name: season.name, outreach: String(season.outreach_target), build: String(season.build_target) } })}>Edit season</button>}
                  {!season.is_current && <button type="button" disabled={busy || loading} className={btnGhost} onClick={() => void mutate({ action: 'set_current', id: season.id }, 'Current season updated')}>Make current</button>}
                </span>
              </div>
              <p className="text-xs text-ink-soft">Individual outreach cap: {season.individual_outreach_cap_minutes} minutes per member. Attendance managers configure this separately from season targets; event outreach is not capped.</p>
              {edit && <form onSubmit={(event) => save(event, season.id)}><fieldset disabled={busy || loading} className="grid sm:grid-cols-4 gap-3 items-end">
                {fields(edit, (next) => setEdits({ ...edits, [season.id]: next }), 'Season')}
                <div className="sm:col-span-4 flex gap-2"><button className={btnGhost}>Save season</button><button type="button" className={btnGhost} onClick={() => setEdits(({ [season.id]: _, ...rest }) => rest)}>Cancel edit</button></div>
              </fieldset></form>}
            </div>
          )
        })}
        {!loading && !loadError && rows.length === 0 && <p className="px-5 py-6 text-center text-sm text-ink-soft">Season setup required. Create a season before saving season-attributed records.</p>}
      </div>
    </section>
  )
}

/* ----------------------------- Invite links ----------------------------- */

type Invite = { id: string; created_at: string; expires_at: string; revoked: boolean }

function Invites({ flash }: { flash: Flash }) {
  const [rows, setRows] = useState<Invite[]>([])
  const [days, setDays] = useState(7)
  const [newLink, setNewLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function load() {
    const { data, error } = await supabase.rpc('invitation_action', {payload:{action:'list'}})
    if (error) {setError(error.message);return}
    setError('');setRows(data as Invite[])
  }
  useEffect(() => {void load()}, [])
  async function create() {
    setBusy(true);setError('')
    const {data,error} = await supabase.rpc('invitation_action',{payload:{action:'create',expires_at:new Date(Date.now()+days*864e5).toISOString()}})
    setBusy(false)
    if(error){setError(error.message);return}
    const link=`${window.location.origin}${import.meta.env.BASE_URL}invite?code=${encodeURIComponent(data.code)}`
    setNewLink(link)
    try {await navigator.clipboard.writeText(link);flash('Invitation created and copied')}catch {flash('Invitation created; copy the displayed link')}
    await load()
  }
  async function revoke(id:string){
    setBusy(true)
    const {error}=await supabase.rpc('invitation_action',{payload:{action:'revoke',id}})
    setBusy(false)
    if(error){setError(error.message);return}
    flash('Invitation revoked');await load()
  }
  return <section className={card}>
    <div className={cardHead}><span className={cardTitle}>Reusable invitations</span><div className="flex flex-wrap gap-2">
      {[1,7,30].map(value=><button key={value} aria-pressed={days===value} onClick={()=>setDays(value)} className={btnGhost}>{value}d</button>)}
      <button disabled={busy} onClick={()=>void create()} className={btnGhost}>New link</button>
    </div></div>
    <div className="p-5 space-y-3"><p className="text-sm text-ink-soft">Verified users may accept an active reusable invitation as ordinary members, without grants. The bearer link is shown only at creation.</p>
      {newLink && <div><label htmlFor="new-invite-link" className={label}>New invitation — save this link</label><input id="new-invite-link" readOnly value={newLink} className={input} onFocus={event=>event.target.select()} /></div>}
      {error && <div role="alert"><p>{error}</p><button onClick={()=>void load()}>Retry</button></div>}
      {rows.map(row=><div key={row.id} className="flex flex-wrap items-center gap-3 border-t border-line py-3"><span className="font-mono text-xs">{row.id}</span><Badge label={row.revoked?'revoked':new Date(row.expires_at).getTime()<=Date.now()?'expired':'active'} /><span>Expires {fmtDateTime(row.expires_at)}</span>{!row.revoked && <button disabled={busy} onClick={()=>void revoke(row.id)} className={btnGhost}>Revoke</button>}</div>)}
      {!rows.length && <p>No invitations yet.</p>}
    </div>
  </section>
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
      supabase.from('public_directory').select('id, display_name').order('display_name'),
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
    const { error } = await supabase.rpc('group_action',{payload:{action:'create',name:name.trim()}})
    if (error) return flash(error.message, true)
    setName('')
    flash('Group created')
    load()
  }

  async function toggle(groupId: string, userId: string, inGroup: boolean) {
    const member_ids = links.filter(link=>link.group_id===groupId&&(!inGroup||link.user_id!==userId)).map(link=>link.user_id)
    if(!inGroup) member_ids.push(userId)
    const { error } = await supabase.rpc('group_action',{payload:{action:'members',id:groupId,member_ids}})
    if (error) return flash(error.message, true)
    load()
  }

  async function remove(g: Group) {
    if (!confirm(`Delete the group "${g.name}"? Members stay; only the group is removed.`)) return
    const { error } = await supabase.rpc('group_action',{payload:{action:'delete',id:g.id}})
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
