import { createFileRoute, Link } from '@tanstack/react-router'
import { OwnerTable } from '~/components/OwnerTable'

export const Route = createFileRoute('/_app/owner/purchases')({
  component: () => (
    <OwnerTable
      title="Purchases"
      table="purchases"
      select="id, description, amount, status, created_at"
      searchFields={['description', 'status']}
      renderLink={(r) => <Link to="/admin/purchases/$id/review" params={{ id: r.id }} className="text-xs text-accent hover:underline">View / review →</Link>}
      renderRow={(r) => ({
        primary: String(r.description ?? '—'),
        secondary: `$${Number(r.amount ?? 0).toFixed(2)} · ${r.created_at ? new Date(String(r.created_at)).toLocaleDateString() : ''}`,
        tag: String(r.status ?? ''),
      })}
    />
  ),
})
