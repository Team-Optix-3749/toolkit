import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/lib/auth'
import { useToast } from '~/lib/toast'
import type { TaskGroup, ProfileRow } from '~/lib/types'
import { card, cardHead, cardTitle, btn, label, input, textarea } from '~/lib/ui'

export const Route = createFileRoute('/_app/tasks/new')({
  component: NewTask,
})

function NewTask() {
  const { user } = useAuth()
  const { flash, Toast } = useToast()
  const navigate = useNavigate()
  const [groups, setGroups] = useState<TaskGroup[]>([])
  const [members, setMembers] = useState<ProfileRow[]>([])
  const [busy, setBusy] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [groupId, setGroupId] = useState('')
  const [deadline, setDeadline] = useState('')
  const [requiresReview, setRequiresReview] = useState(false)
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [reviewerIds, setReviewerIds] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('task_groups').select('*').order('name'),
      supabase.from('profiles').select('id, display_name, role, avatar_url').eq('account_status', 'active').neq('role', 'PENDING').order('display_name'),
    ]).then(([{ data: g }, { data: m }]) => {
      setGroups((g as TaskGroup[]) || [])
      setMembers((m as ProfileRow[]) || [])
    })
  }, [])

  function toggleId(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return flash('Title required', true)
    setBusy(true)

    const { data: season } = await supabase.from('seasons').select('id').eq('is_current', true).maybeSingle()

    const { data, error } = await supabase.from('tasks').insert({
      created_by: user!.id,
      title: title.trim(),
      description: description.trim() || null,
      group_id: groupId || null,
      deadline: deadline || null,
      requires_review: requiresReview,
      season_id: season?.id ?? null,
      status: 'assigned',
    }).select('id').single()

    if (error) { setBusy(false); return flash(error.message, true) }
    const taskId = (data as { id: string }).id

    if (assigneeIds.length > 0) {
      await supabase.from('task_assignees').insert(assigneeIds.map(uid => ({ task_id: taskId, user_id: uid })))
    }
    if (requiresReview && reviewerIds.length > 0) {
      await supabase.from('task_reviewers').insert(reviewerIds.map(uid => ({ task_id: taskId, user_id: uid })))
    }
    await supabase.from('task_history').insert({
      task_id: taskId, user_id: user!.id, from_status: null, to_status: 'assigned',
    })

    setBusy(false)
    flash('Task created')
    navigate({ to: '/tasks/$id', params: { id: taskId } })
  }

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>New task</span>
      </div>
      <form onSubmit={submit} className="p-5 space-y-4">
        <div>
          <label className={label}>Title</label>
          <input className={input} value={title} onChange={e => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className={label}>Description</label>
          <textarea className={textarea} rows={3} value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Group</label>
            <select className={input} value={groupId} onChange={e => setGroupId(e.target.value)}>
              <option value="">None</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Deadline</label>
            <input type="date" className={input} value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm select-none cursor-pointer">
          <input type="checkbox" checked={requiresReview} onChange={e => setRequiresReview(e.target.checked)} className="h-4 w-4 accent-accent" />
          Requires review before completion
        </label>

        <div>
          <label className={label}>Assignees</label>
          <div className="border border-line p-2 max-h-40 overflow-y-auto space-y-1">
            {members.map(m => (
              <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-canvas px-1 py-0.5">
                <input
                  type="checkbox"
                  checked={assigneeIds.includes(m.id)}
                  onChange={() => toggleId(assigneeIds, setAssigneeIds, m.id)}
                  className="h-3.5 w-3.5 accent-accent"
                />
                {m.display_name ?? m.id}
              </label>
            ))}
          </div>
        </div>

        {requiresReview && (
          <div>
            <label className={label}>Reviewers</label>
            <div className="border border-line p-2 max-h-40 overflow-y-auto space-y-1">
              {members.map(m => (
                <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-canvas px-1 py-0.5">
                  <input
                    type="checkbox"
                    checked={reviewerIds.includes(m.id)}
                    onChange={() => toggleId(reviewerIds, setReviewerIds, m.id)}
                    className="h-3.5 w-3.5 accent-accent"
                  />
                  {m.display_name ?? m.id}
                </label>
              ))}
            </div>
          </div>
        )}

        <button disabled={busy} className={btn}>
          {busy ? 'Creating…' : 'Create task'}
        </button>
      </form>
      {Toast}
    </section>
  )
}
