import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { supabase } from '~/lib/supabase'
import { RequireOwner } from '~/components/Guards'
import { Badge } from '~/components/Badge'
import { card, cardHead, cardTitle, btnGhost } from '~/lib/ui'

export const Route = createFileRoute('/_app/admin/cron-jobs')({
  component: () => (
    <RequireOwner>
      <CronJobs />
    </RequireOwner>
  ),
})

const EXPECTED = [
  ['auto-checkout', 'Closes open build check-ins past their window'],
  ['session-warning', 'Notifies attendees before a session starts'],
  ['outreach-reminder', 'Reminds members about upcoming outreach events'],
]

type Job = { jobid: number; jobname: string; schedule: string; active: boolean }

function CronJobs() {
  const [jobs, setJobs] = useState<Job[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function load() {
    setErr(null)
    const { data, error } = await supabase.rpc('list_cron_jobs')
    if (error) {
      setErr(error.message)
      setJobs(null)
      return
    }
    setJobs((data as Job[]) || [])
  }
  useEffect(() => {
    load()
  }, [])

  const byName = new Map((jobs || []).map((j) => [j.jobname, j]))

  return (
    <section className={card}>
      <div className={cardHead}>
        <span className={cardTitle}>Scheduled jobs</span>
        <button onClick={load} className={btnGhost}>
          Refresh
        </button>
      </div>
      <div className="divide-y divide-line">
        {EXPECTED.map(([name, desc]) => {
          const live = byName.get(name)
          return (
            <div key={name} className="px-5 py-3 flex items-center gap-3">
              <span className="font-mono text-sm w-44 shrink-0">{name}</span>
              <span className="text-sm text-ink-soft flex-1">{desc}</span>
              {live ? (
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs text-ink-soft">{live.schedule}</span>
                  <Badge label={live.active ? 'active' : 'paused'} tone={live.active ? 'APPROVED' : 'PENDING'} />
                </span>
              ) : (
                <Badge label="not provisioned" tone="PENDING" />
              )}
            </div>
          )
        })}
      </div>
      <div className="px-5 py-3 text-sm text-ink-soft border-t border-line">
        {err || (jobs?.length ?? 0) === 0
          ? 'These automated jobs are not active yet.'
          : `${jobs?.length} active job${jobs?.length === 1 ? '' : 's'}.`}
      </div>
    </section>
  )
}
