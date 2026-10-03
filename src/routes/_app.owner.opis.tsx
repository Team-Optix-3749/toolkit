import { createFileRoute } from '@tanstack/react-router'
import { OwnerTable } from '~/components/OwnerTable'

export const Route = createFileRoute('/_app/owner/opis')({
  component: () => (
    <OwnerTable
      title="OPIs"
      table="opis"
      select="id, title, status, created_at"
      searchFields={['title', 'status']}
      renderRow={(r) => ({
        primary: String(r.title ?? '—'),
        secondary: r.created_at ? new Date(String(r.created_at)).toLocaleString() : null,
        tag: String(r.status ?? ''),
      })}
    />
  ),
})
