import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import { Badge } from '~/components/Badge'
import { fmtDate, fmtDateTime } from '~/lib/format'
import type { Task, TaskGroup, TaskEvidence, TaskHistory, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, btn, btnGhost, label, input, textarea } from '~/lib/ui'

export const Route = createFileRoute('/_app/tasks/$id')({
  component: TaskDetail,
})

type Assignee = { task_id: string; user_id: string }

const STATUS_ACTIONS: Record<string, { label: string; next: string }[]> = {
  assigned: [{ label: 'Start', next: 'in_progress' }],
  in_progress: [
    { label: 'Submit for review', next: 'submitted' },
    { label: 'Mark complete', next: 'completed' },
    { label: 'Cancel', next: 'cancelled' },
  ],
  submitted: [
    { label: 'Request changes', next: 'changes_requested' },
    { label: 'Approve', next: 'completed' },
  ],
  changes_requested: [{ label: 'Resubmit', next: 'resubmitted' }],
  resubmitted: [
    { label: 'Request changes', next: 'changes_requested' },
    { label: 'Approve', next: 'completed' },
  ],
  completed: [],
  cancelled: [{ label: 'Reopen', next: 'assigned' }],
}

function TaskDetail() {
  const { id } = Route.useParams()
  const { user, profile } = useAuth()
  const { flash, Toast } = useToast()
  const [task, setTask] = useState<Task | null>(null)
  const [group, setGroup] = useState<TaskGroup | null>(null)
  const [assignees, setAssignees] = useState<Assignee[]>([])
  const [reviewers, setReviewers] = useState<Assignee[]>([])
  const [evidence, setEvidence] = useState<TaskEvidence[]>([])
  const [history, setHistory] = useState<TaskHistory[]>([])
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({})
  const [feedback, setFeedback] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newLink, setNewLink] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const uid = user!.id
  const canManage = profile?.permissions?.includes('manage_tasks') || ['LEADERSHIP', 'OFFICER', 'OWNER'].includes(profile?.role ?? '')
  const isAssignee = assignees.some(a => a.user_id === uid)
  const isReviewer = reviewers.some(r => r.user_id === uid)

  async function load() {
    const [{ data: t }, { data: a }, { data: r }, { data: e }, { data: h }] = await Promise.all([
      supabase.from('tasks').select('*').eq('id', id).single(),
      supabase.from('task_assignees').select('*').eq('task_id', id),
      supabase.from('task_reviewers').select('*').eq('task_id', id),
      supabase.from('task_evidence').select('*').eq('task_id', id).order('created_at'),
      supabase.from('task_history').select('*').eq('task_id', id).order('created_at'),
    ])
    if (t) {
      setTask(t as Task)
      if ((t as Task).group_id) {
        const { data: g } = await supabase.from('task_groups').select('*').eq('id', (t as Task).group_id!).single()
        setGroup(g as TaskGroup | null)
      }
    }
    setAssignees((a as Assignee[]) || [])
    setReviewers((r as Assignee[]) || [])
    setEvidence((e as TaskEvidence[]) || [])
    setHistory((h as TaskHistory[]) || [])

    const userIds = new Set<string>()
    ;(a as Assignee[] || []).forEach(x => userIds.add(x.user_id))
    ;(r as Assignee[] || []).forEach(x => userIds.add(x.user_id))
    ;(h as TaskHistory[] || []).forEach(x => { if (x.user_id) userIds.add(x.user_id) })
    ;(e as TaskEvidence[] || []).forEach(x => { if (x.user_id) userIds.add(x.user_id) })
    if (userIds.size > 0) {
      const { data: p } = await supabase.from('profiles').select('id, display_name, role, avatar_url').in('id', [...userIds])
      if (p) setProfiles(Object.fromEntries((p as ProfileRow[]).map(x => [x.id, x])))
    }
  }

  useEffect(() => { load() }, [id])

  async function transition(next: string) {
    if (!task) return
    if ((next === 'changes_requested' || next === 'cancelled') && !feedback.trim()) {
      return flash('Please provide feedback', true)
    }
    setBusy(true)
    const { error } = await supabase.from('tasks').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { setBusy(false); return flash(error.message, true) }
    await supabase.from('task_history').insert({
      task_id: id,
      user_id: uid,
      from_status: task.status,
      to_status: next,
      feedback: feedback.trim() || null,
    })
    setFeedback('')
    setBusy(false)
    flash(`Task → ${next.replace(/_/g, ' ')}`)
    load()
  }

  async function addNote() {
    if (!newNote.trim()) return
    setBusy(true)
    const { error } = await supabase.from('task_evidence').insert({
      task_id: id, user_id: uid, kind: 'note', content: newNote.trim(),
    })
    setBusy(false)
    if (error) return flash(error.message, true)
    setNewNote('')
    load()
  }

  async function addLink() {
    if (!newLink.trim()) return
    setBusy(true)
    const { error } = await supabase.from('task_evidence').insert({
      task_id: id, user_id: uid, kind: 'link', content: newLink.trim(),
    })
    setBusy(false)
    if (error) return flash(error.message, true)
    setNewLink('')
    load()
  }

  async function uploadPicture(file: File) {
    setBusy(true)
    const path = `${uid}/${id}/${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from('task-evidence').upload(path, file)
    if (upErr) { setBusy(false); return flash('Upload failed: ' + upErr.message, true) }
    const { data: urlData } = supabase.storage.from('task-evidence').getPublicUrl(path)
    const fileUrl = urlData?.publicUrl ?? path
    const { error } = await supabase.from('task_evidence').insert({
      task_id: id, user_id: uid, kind: 'picture', content: file.name, file_url: fileUrl,
    })
    setBusy(false)
    if (error) return flash(error.message, true)
    load()
  }

  if (!task) {
    return <div className="text-center text-ink-soft text-sm py-12">Loading…</div>
  }

  const actions = STATUS_ACTIONS[task.status] || []
  const filteredActions = actions.filter(a => {
    if (a.next === 'submitted' || a.next === 'resubmitted') return task.requires_review && (isAssignee || canManage)
    if (a.next === 'in_progress') return isAssignee || canManage
    if (a.next === 'completed' && task.requires_review && (task.status === 'submitted' || task.status === 'resubmitted')) return isReviewer || canManage
    if (a.next === 'completed') return !task.requires_review && (isAssignee || canManage)
    if (a.next === 'changes_requested') return isReviewer || canManage
    if (a.next === 'cancelled' || a.next === 'assigned') return canManage
    return canManage
  })

  const needsFeedback = filteredActions.some(a => a.next === 'changes_requested' || a.next === 'cancelled')
  const overdue = task.deadline && new Date(task.deadline) < new Date() && !['completed', 'cancelled'].includes(task.status)
  const getName = (uid: string | null) => uid ? profiles[uid]?.display_name ?? '—' : '—'

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-ink-soft">
        <Link to="/tasks" className="hover:text-accent">Tasks</Link>
        <span>/</span>
        <span className="text-ink">{task.title}</span>
      </div>

      <section className={card}>
        <div className={cardHead}>
          <div className="flex items-center gap-3">
            <span className={cardTitle}>Task detail</span>
            <Badge label={task.status.replace(/_/g, ' ')} tone={task.status} />
            {overdue && <span className="text-[11px] font-mono text-[#c0392b]">OVERDUE</span>}
          </div>
        </div>
        <div className="p-5 space-y-4">
          <h2 className="text-lg font-semibold">{task.title}</h2>
          {task.description && <p className="text-sm text-ink-soft whitespace-pre-wrap">{task.description}</p>}

          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-[11px] font-mono uppercase text-ink-soft mb-1">Deadline</div>
              <div className={overdue ? 'text-[#c0392b] font-medium' : ''}>{task.deadline ? fmtDate(task.deadline) : '—'}</div>
            </div>
            {group && (
              <div>
                <div className="text-[11px] font-mono uppercase text-ink-soft mb-1">Group</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                  {group.name}
                </div>
              </div>
            )}
            <div>
              <div className="text-[11px] font-mono uppercase text-ink-soft mb-1">Assignees</div>
              <div>{assignees.length > 0 ? assignees.map(a => getName(a.user_id)).join(', ') : '—'}</div>
            </div>
            {task.requires_review && (
              <div>
                <div className="text-[11px] font-mono uppercase text-ink-soft mb-1">Reviewers</div>
                <div>{reviewers.length > 0 ? reviewers.map(r => getName(r.user_id)).join(', ') : '—'}</div>
              </div>
            )}
            <div>
              <div className="text-[11px] font-mono uppercase text-ink-soft mb-1">Review required</div>
              <div>{task.requires_review ? 'Yes' : 'No'}</div>
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase text-ink-soft mb-1">Created</div>
              <div>{fmtDateTime(task.created_at)}</div>
            </div>
          </div>

          {filteredActions.length > 0 && (
            <div className="border-t border-line pt-4 space-y-3">
              {needsFeedback && (
                <div>
                  <label className={label}>Feedback</label>
                  <textarea
                    className={textarea}
                    rows={2}
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="Required for changes requested or cancellation"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {filteredActions.map(a => (
                  <button
                    key={a.next}
                    onClick={() => transition(a.next)}
                    disabled={busy}
                    className={a.next === 'cancelled' ? btnGhost : btn}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Evidence */}
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Evidence</span>
        </div>
        <div className="divide-y divide-line">
          {evidence.map(e => (
            <div key={e.id} className="px-5 py-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge label={e.kind} tone="neutral" />
                <span className="text-xs text-ink-soft">{getName(e.user_id)} · {fmtDateTime(e.created_at)}</span>
              </div>
              {e.kind === 'link' ? (
                <a href={e.content} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline break-all">
                  {e.content}
                </a>
              ) : e.kind === 'picture' && e.file_url ? (
                <div>
                  <a href={e.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline">
                    {e.content}
                  </a>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{e.content}</p>
              )}
            </div>
          ))}
          {evidence.length === 0 && (
            <div className="px-5 py-6 text-center text-ink-soft text-sm">No evidence added yet.</div>
          )}
        </div>

        {(isAssignee || canManage) && (
          <div className="border-t border-line p-5 space-y-3">
            <div className="flex gap-2">
              <input className={`flex-1 ${input}`} placeholder="Add a note…" value={newNote} onChange={e => setNewNote(e.target.value)} />
              <button onClick={addNote} disabled={busy || !newNote.trim()} className={btnGhost}>Add note</button>
            </div>
            <div className="flex gap-2">
              <input className={`flex-1 ${input}`} placeholder="Add a link…" value={newLink} onChange={e => setNewLink(e.target.value)} />
              <button onClick={addLink} disabled={busy || !newLink.trim()} className={btnGhost}>Add link</button>
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadPicture(e.target.files[0]) }} />
              <button onClick={() => fileRef.current?.click()} disabled={busy} className={btnGhost}>Upload picture</button>
            </div>
          </div>
        )}
      </section>

      {/* History */}
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>History</span>
        </div>
        <div className="divide-y divide-line">
          {history.map(h => (
            <div key={h.id} className="px-5 py-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{getName(h.user_id)}</span>
                <span className="text-ink-soft">→</span>
                <Badge label={h.to_status.replace(/_/g, ' ')} tone={h.to_status} />
                <span className="text-xs text-ink-soft ml-auto">{fmtDateTime(h.created_at)}</span>
              </div>
              {h.feedback && <p className="text-sm text-ink-soft mt-1 whitespace-pre-wrap">{h.feedback}</p>}
            </div>
          ))}
          {history.length === 0 && (
            <div className="px-5 py-6 text-center text-ink-soft text-sm">No history yet.</div>
          )}
        </div>
      </section>

      {Toast}
    </>
  )
}
