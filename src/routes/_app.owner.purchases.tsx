import { createFileRoute } from '@tanstack/react-router'
import { OwnerTable } from '~/components/OwnerTable'

export const Route = createFileRoute('/_app/owner/purchases')({
  component: () => (
    <OwnerTable
      title="Purchases"
      table="purchases"
      select="id, description, amount, status, created_at"
      searchFields={['description', 'status']}
      renderRow={(r) => ({
        primary: String(r.description ?? '—'),
        secondary: `$${Number(r.amount ?? 0).toFixed(2)} · ${r.created_at ? new Date(String(r.created_at)).toLocaleDateString() : ''}`,
        tag: String(r.status ?? ''),
      })}
    />
  ),
})
