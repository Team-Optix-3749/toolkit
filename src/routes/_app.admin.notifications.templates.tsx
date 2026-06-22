import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { RequireOwner } from '~/components/Guards'
import { card, cardHead, cardTitle, label, input, textarea, btn, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/notifications/templates')({
  component: () => (
    <RequireOwner>
      <Templates />
    </RequireOwner>
  ),
})

type Template = { id: string; name: string; subject: string; body: string }

function Templates() {
  const { flash, Toast } = useToast()
  const [rows, setRows] = useState<Template[]>([])
  const [sel, setSel] = useState<Template | null>(null)

  async function load() {
    const { data, error } = await supabase.from('email_templates').select('*').order('name')
    if (error) return flash('Load failed: ' + error.message, true)
    setRows((data as Template[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  function blankEdit() {
    setSel({ id: '', name: '', subject: '', body: '' })
  }

  async function save() {
    if (!sel) return
    if (!sel.name.trim()) return flash('Name required', true)
    const payload = { name: sel.name.trim(), subject: sel.subject, body: sel.body }
    const { error } = sel.id
      ? await supabase.from('email_templates').update(payload).eq('id', sel.id)
      : await supabase.from('email_templates').insert(payload)
    if (error) return flash(error.message, true)
    flash('Template saved')
    setSel(null)
    load()
  }

  async function del(id: string) {
    if (!confirm('Delete template?')) return
    const { error } = await supabase.from('email_templates').delete().eq('id', id)
    if (error) return flash(error.message, true)
    setSel(null)
    load()
  }

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Email templates</span>
          <button onClick={blankEdit} className={btnGhost}>
            New
          </button>
        </div>
        <div className="divide-y divide-line">
          {rows.map((t) => (
            <button key={t.id} onClick={() => setSel(t)} className="w-full text-left px-5 py-3 hover:bg-canvas">
              <div className="font-medium">{t.name}</div>
              <div className="text-sm text-ink-soft truncate">{t.subject}</div>
            </button>
          ))}
          {rows.length === 0 && <div className="px-5 py-6 text-ink-soft text-sm">No templates yet.</div>}
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>{sel ? (sel.id ? 'Edit template' : 'New template') : 'Editor'}</span>
        </div>
        <div className="p-5">
          {!sel ? (
            <p className="text-sm text-ink-soft">Select a template to edit, or create a new one.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={label}>Name (key)</label>
                <input className={input} value={sel.name} onChange={(e) => setSel({ ...sel, name: e.target.value })} />
              </div>
              <div>
                <label className={label}>Subject</label>
                <input className={input} value={sel.subject} onChange={(e) => setSel({ ...sel, subject: e.target.value })} />
              </div>
              <div>
                <label className={label}>Body (HTML / text)</label>
                <textarea rows={10} className={textarea} value={sel.body} onChange={(e) => setSel({ ...sel, body: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button onClick={save} className={btn}>
                  Save
                </button>
                {sel.id && (
                  <button onClick={() => del(sel.id)} className="h-10 px-4 text-sm border border-[#e3a9a1] text-[#c0392b] bg-[#fbeeec] hover:bg-[#f7e2de]">
                    Delete
                  </button>
                )}
                <button onClick={() => setSel(null)} className="h-10 px-4 text-sm text-ink-soft hover:text-ink">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
      {Toast}
    </div>
  )
}
