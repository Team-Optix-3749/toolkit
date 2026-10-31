import { createFileRoute, Link } from '@tanstack/react-router'
import { OwnerTable } from '~/components/OwnerTable'

export const Route = createFileRoute('/_app/owner/events')({
  component: () => (
    <OwnerTable
      title="Outreach events"
      table="outreach_events"
      select="id, title, location, starts_at, cancelled"
      orderBy="starts_at"
      ascending={false}
      searchFields={['title', 'location']}
      renderLink={(r) => <Link to="/outreach/events/$id" params={{ id: r.id }} className="text-xs text-accent hover:underline">View event →</Link>}
      renderRow={(r) => ({
        primary: String(r.title ?? '—'),
        secondary: `${r.location ? r.location + ' · ' : ''}${r.starts_at ? new Date(String(r.starts_at)).toLocaleString() : ''}`,
        tag: r.cancelled ? 'CANCELLED' : null,
      })}
    />
  ),
})
