import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { Badge } from '~/components/Badge'
import { fmtDate } from '~/lib/format'
import type { Task, TaskGroup } from '~/lib/types'
import { card, cardHead, cardTitle, btnGhost, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/tasks/')({
  component: TasksIndex,
})

const FILTERS = ['all', 'mine', 'review'] as const
type Filter = (typeof FILTERS)[number]

const STATUS_FILTERS = ['active', 'completed', 'cancelled'] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

const ACTIVE_STATUSES = ['assigned', 'in_progress', 'submitted', 'changes_requested', 'resubmitted']

function TasksIndex() {
  const { user, profile } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [groups, setGroups] = useState<TaskGroup[]>([])
  const [myAssigned, setMyAssigned] = useState<Set<string>>(new Set())
  const [myReview, setMyReview] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<Filter>('mine')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const canManage = profile?.permissions?.includes('manage_tasks') || ['LEADERSHIP', 'OFFICER', 'OWNER'].includes(profile?.role ?? '')

  useEffect(() => {
    const uid = user!.id
    ;(async () => {
      const [{ data: t }, { data: g }, { data: assigned }, { data: reviewing }] = await Promise.all([
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
        supabase.from('task_groups').select('*').order('name'),
        supabase.from('task_assignees').select('task_id').eq('user_id', uid),
        supabase.from('task_reviewers').select('task_id').eq('user_id', uid),
      ])
      setTasks((t as Task[]) || [])
      setGroups((g as TaskGroup[]) || [])
      setMyAssigned(new Set((assigned as { task_id: string }[] || []).map(r => r.task_id)))
      setMyReview(new Set((reviewing as { task_id: string }[] || []).map(r => r.task_id)))
    })()
  }, [])

  const filtered = tasks.filter(t => {
    if (statusFilter === 'active' && !ACTIVE_STATUSES.includes(t.status)) return false
    if (statusFilter === 'completed' && t.status !== 'completed') return false
    if (statusFilter === 'cancelled' && t.status !== 'cancelled') return false
    if (filter === 'mine' && !myAssigned.has(t.id)) return false
    if (filter === 'review' && !myReview.has(t.id)) return false
    if (groupFilter && t.group_id !== groupFilter) return false
    return true
  })

  const groupMap = Object.fromEntries(groups.map(g => [g.id, g]))

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
        {canManage && (
          <Link to="/tasks/new" className={btn}>New task</Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`${btnGhost} ${filter === f ? 'bg-canvas border-accent text-accent' : ''}`}
          >
            {f === 'mine' ? 'My tasks' : f === 'review' ? 'My reviews' : 'All'}
          </button>
        ))}
        <span className="w-px bg-line" />
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`${btnGhost} ${statusFilter === s ? 'bg-canvas border-accent text-accent' : ''}`}
          >
            {s}
          </button>
        ))}
        {groups.length > 0 && (
          <>
            <span className="w-px bg-line" />
            <button
              onClick={() => setGroupFilter(null)}
              className={`${btnGhost} ${!groupFilter ? 'bg-canvas border-accent text-accent' : ''}`}
            >
              All groups
            </button>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setGroupFilter(g.id)}
                className={`${btnGhost} ${groupFilter === g.id ? 'bg-canvas border-accent text-accent' : ''}`}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: g.color }} />
                {g.name}
              </button>
            ))}
          </>
        )}
      </div>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="divide-y divide-line">
          {filtered.map(t => {
            const group = t.group_id ? groupMap[t.group_id] : null
            const overdue = t.deadline && new Date(t.deadline) < new Date() && ACTIVE_STATUSES.includes(t.status)
            return (
              <Link
                key={t.id}
                to="/tasks/$id"
                params={{ id: t.id }}
                className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-canvas"
              >
                <div className="min-w-0">
                  <div className={`text-sm font-medium truncate ${overdue ? 'text-[#c0392b]' : ''}`}>
                    {t.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {group && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ink-soft">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                        {group.name}
                      </span>
                    )}
                    {t.deadline && (
                      <span className={`text-[11px] font-mono ${overdue ? 'text-[#c0392b]' : 'text-ink-soft'}`}>
                        Due {fmtDate(t.deadline)}
                      </span>
                    )}
                    {t.requires_review && (
                      <span className="text-[11px] font-mono text-ink-soft">Review required</span>
                    )}
                  </div>
                </div>
                <Badge label={t.status.replace(/_/g, ' ')} tone={t.status} />
              </Link>
            )
          })}
          {filtered.length === 0 && (
            <div className="px-5 py-8 text-center text-ink-soft text-sm">No tasks match your filters.</div>
          )}
        </div>
      </section>
    </>
  )
}
