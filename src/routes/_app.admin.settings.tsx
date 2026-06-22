import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { useToast } from '~/lib/toast'
import { RequireOwner } from '~/components/Guards'
import { ROLES, ROLE_LABEL, type Role } from '~/lib/rbac'
import { card, cardHead, cardTitle, label, input, btn } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/settings')({
  component: () => (
    <RequireOwner>
      <Settings />
    </RequireOwner>
  ),
})

type Setting = { key: string; value: string | null }

function Settings() {
  const { flash, Toast } = useToast()
  const [settings, setSettings] = useState<Setting[]>([])
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')

  async function load() {
    const { data, error } = await supabase.from('org_settings').select('key, value').order('key')
    if (error) return flash('Load failed: ' + error.message, true)
    setSettings((data as Setting[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  async function upsert(key: string, value: string) {
    const { error } = await supabase
      .from('org_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) return flash(error.message, true)
    flash('Saved')
    load()
  }

  return (
    <>
      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Org settings</span>
        </div>
        <div className="divide-y divide-line">
          {settings.map((s) => (
            <div key={s.key} className="px-5 py-3 flex items-center gap-3">
              <span className="font-mono text-sm w-48 shrink-0">{s.key}</span>
              <input
                className={input}
                defaultValue={s.value ?? ''}
                onBlur={(e) => {
                  if (e.target.value !== (s.value ?? '')) upsert(s.key, e.target.value)
                }}
              />
            </div>
          ))}
          {settings.length === 0 && <div className="px-5 py-6 text-ink-soft text-sm">No settings yet — add one below.</div>}
        </div>
        <div className="p-5 border-t border-line flex items-end gap-3">
          <div className="flex-1">
            <label className={label}>New key</label>
            <input className={input} value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="org_name" />
          </div>
          <div className="flex-1">
            <label className={label}>Value</label>
            <input className={input} value={newVal} onChange={(e) => setNewVal(e.target.value)} />
          </div>
          <button
            onClick={() => {
              if (!newKey.trim()) return flash('Key required', true)
              upsert(newKey.trim(), newVal)
              setNewKey('')
              setNewVal('')
            }}
            className={btn}
          >
            Add
          </button>
        </div>
      </section>

      <section className={card}>
        <div className={cardHead}>
          <span className={cardTitle}>Roles</span>
        </div>
        <div className="p-5">
          <div className="flex gap-2 flex-wrap">
            {ROLES.map((r) => (
              <span key={r} className="text-[11px] font-mono uppercase tracking-wide px-2 py-1 border border-line text-ink-soft">
                {ROLE_LABEL[r as Role]}
              </span>
            ))}
          </div>
        </div>
      </section>
      {Toast}
    </>
  )
}
