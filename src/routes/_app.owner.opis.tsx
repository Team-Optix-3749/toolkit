import { createFileRoute, Link } from '@tanstack/react-router'
import { OwnerTable } from '~/components/OwnerTable'

export const Route = createFileRoute('/_app/owner/opis')({
  component: () => (
    <OwnerTable
      title="OPIs"
      table="opis"
      select="id, title, status, created_at"
      searchFields={['title', 'status']}
      renderLink={(r) => <Link to="/admin/opi/$id/review" params={{ id: r.id }} className="text-xs text-accent hover:underline">View / review →</Link>}
      renderRow={(r) => ({
        primary: String(r.title ?? '—'),
        secondary: r.created_at ? new Date(String(r.created_at)).toLocaleString() : null,
        tag: String(r.status ?? ''),
      })}
    />
  ),
})
