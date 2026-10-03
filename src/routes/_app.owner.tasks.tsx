import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { card, cardHead, cardTitle } from '~/lib/ui'

export const Route = createFileRoute('/_app/owner/tasks')({
  component: OwnerTasks,
})

type TaskRow = {
  id: string
  title: string
  status: string
  deadline: string | null
  created_at: string
}

type AssigneeMap = Record<string, { id: string; name: string }[]>

function OwnerTasks() {
  const { flash, Toast } = useToast()
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [assignees, setAssignees] = useState<AssigneeMap>({})
  const [view, setView] = useState<'calendar' | 'list'>('calendar')
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [{ data: t }, { data: ta }] = await Promise.all([
      supabase.from('tasks').select('id, title, status, deadline, created_at').order('deadline', { ascending: true, nullsFirst: false }),
      supabase.from('task_assignees').select('task_id, user_id, profiles:profiles!task_assignees_user_id_fkey(id, display_name)'),
    ])
    setTasks((t as TaskRow[]) || [])
    const map: AssigneeMap = {}
    for (const row of (ta as { task_id: string; profiles: { id: string; display_name: string | null } | null }[]) || []) {
      if (!row.profiles) continue
      map[row.task_id] ??= []
      map[row.task_id].push({ id: row.profiles.id, name: row.profiles.display_name ?? 'Unknown' })
    }
    setAssignees(map)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function hardDelete(id: string) {
    setBusy(true)
    const { error } = await supabase.rpc('owner_delete_row', { table_name: 'tasks', row_id: id })
    setBusy(false)
    setConfirmId(null)
    if (error) return flash('Delete failed: ' + error.message, true)
    flash('Task deleted')
    load()
  }

  // Bucket tasks by local YYYY-MM-DD of deadline
  const byDay = useMemo(() => {
    const m: Record<string, TaskRow[]> = {}
    for (const t of tasks) {
      if (!t.deadline) continue
      const d = new Date(t.deadline)
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      ;(m[k] ??= []).push(t)
    }
    return m
  }, [tasks])

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center gap-1.5 bg-panel backdrop-blur-xl border border-white/8 rounded-xl p-1 w-fit">
        {(['calendar', 'list'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`h-8 px-4 text-xs font-mono uppercase tracking-wide rounded-lg transition-all duration-150 ${
              view === v
                ? 'bg-accent/15 text-accent border border-accent/25'
                : 'text-ink-soft hover:text-ink hover:bg-white/5 border border-transparent'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'calendar' ? (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>{monthLabel}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-ink-soft hover:text-ink transition-all"
                title="Previous month"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)) }}
                className="h-8 px-3 text-[11px] font-mono uppercase tracking-wide rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 inline-flex items-center transition-all"
              >
                Today
              </button>
              <button
                onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-ink-soft hover:text-ink transition-all"
                title="Next month"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          <div className="p-3 sm:p-4">
            <MonthGrid cursor={cursor} byDay={byDay} assignees={assignees} onPick={setSelectedDay} selectedDay={selectedDay} loading={loading} />
          </div>
          {selectedDay && (
            <div className="border-t border-white/6 p-5">
              <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-ink-soft mb-3">
                {new Date(selectedDay + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {' · '}{(byDay[selectedDay] ?? []).length} task{(byDay[selectedDay] ?? []).length === 1 ? '' : 's'}
              </div>
              <div className="space-y-2">
                {(byDay[selectedDay] ?? []).map((t) => (
                  <Link
                    key={t.id}
                    to="/tasks/$id"
                    params={{ id: t.id }}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/5 hover:border-white/12 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs text-ink-soft mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-md border border-white/10">{t.status.replace('_', ' ')}</span>
                        {(assignees[t.id] ?? []).slice(0, 3).map((a) => (
                          <span key={a.id}>{a.name}</span>
                        ))}
                        {(assignees[t.id]?.length ?? 0) > 3 && <span>+{assignees[t.id].length - 3}</span>}
                      </div>
                    </div>
                  </Link>
                ))}
                {(byDay[selectedDay] ?? []).length === 0 && (
                  <div className="text-sm text-ink-soft">No tasks due this day.</div>
                )}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>All tasks ({tasks.length})</span>
          </div>
          <div className="divide-y divide-white/4">
            {loading && <div className="px-5 py-6 text-center text-ink-soft text-sm">Loading…</div>}
            {!loading && tasks.length === 0 && <div className="px-5 py-6 text-center text-ink-soft text-sm">No tasks.</div>}
            {tasks.map((t) => {
              const confirming = confirmId === t.id
              const names = (assignees[t.id] ?? []).map((a) => a.name).join(', ')
              return (
                <div key={t.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate flex items-center gap-2">
                      {t.title}
                      <span className="text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 border border-white/10 rounded text-ink-soft">
                        {t.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-ink-soft mt-0.5">
                      {t.deadline ? `Due ${new Date(t.deadline).toLocaleDateString()}` : 'No deadline'}
                      {names ? ` · ${names}` : ''}
                    </div>
                  </div>
                  {confirming ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-[#f07070] font-medium whitespace-nowrap">Delete forever?</span>
                      <button
                        onClick={() => hardDelete(t.id)}
                        disabled={busy}
                        className="h-8 px-3 text-xs font-mono uppercase tracking-wide border border-[#c0392b]/40 text-[#f07070] bg-[#c0392b]/15 rounded-lg hover:bg-[#c0392b]/25 disabled:opacity-40 inline-flex items-center transition-all"
                      >
                        {busy ? '…' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="h-8 px-3 text-xs border border-white/10 rounded-lg text-ink-soft hover:bg-white/10 inline-flex items-center transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(t.id)}
                      className="shrink-0 h-8 px-3 text-xs font-mono uppercase tracking-wide border border-[#c0392b]/30 text-[#f07070] bg-[#c0392b]/10 rounded-lg hover:bg-[#c0392b]/20 inline-flex items-center transition-all"
                    >
                      Delete
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
      {Toast}
    </div>
  )
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function MonthGrid({
  cursor,
  byDay,
  assignees,
  selectedDay,
  onPick,
  loading,
}: {
  cursor: Date
  byDay: Record<string, TaskRow[]>
  assignees: AssigneeMap
  selectedDay: string | null
  onPick: (d: string | null) => void
  loading: boolean
}) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const cells: ({ key: string; day: number } | null)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ key: k, day: d })
  }
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {DOW.map((d) => (
          <div key={d} className="text-[10px] font-mono uppercase tracking-[0.08em] text-ink-soft text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="min-h-20" />
          const items = byDay[c.key] ?? []
          const isToday = c.key === todayKey
          const isSel = c.key === selectedDay
          return (
            <button
              key={c.key}
              onClick={() => onPick(isSel ? null : c.key)}
              className={`min-h-20 text-left p-1.5 rounded-lg border transition-all duration-150 ${
                isSel
                  ? 'bg-accent/15 border-accent/40'
                  : isToday
                    ? 'bg-white/5 border-accent/20 hover:bg-white/8'
                    : items.length
                      ? 'bg-white/[0.03] border-white/10 hover:bg-white/5 hover:border-white/15'
                      : 'border-white/[0.06] hover:bg-white/[0.02]'
              }`}
            >
              <div className={`text-xs font-mono tabular-nums ${isToday ? 'text-accent font-semibold' : 'text-ink-soft'}`}>
                {c.day}
              </div>
              <div className="mt-1 space-y-0.5">
                {items.slice(0, 2).map((t) => (
                  <div
                    key={t.id}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/20 truncate"
                    title={`${t.title} — ${(assignees[t.id] ?? []).map(a => a.name).join(', ')}`}
                  >
                    {t.title}
                  </div>
                ))}
                {items.length > 2 && (
                  <div className="text-[10px] text-ink-soft px-1">+{items.length - 2} more</div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      {loading && (
        <div className="text-center text-xs text-ink-soft mt-3">Loading tasks…</div>
      )}
    </div>
  )
}
