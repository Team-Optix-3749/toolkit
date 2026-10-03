import { createFileRoute } from '@tanstack/react-router'
import { OwnerTable } from '~/components/OwnerTable'

export const Route = createFileRoute('/_app/owner/tasks')({
  component: () => (
    <OwnerTable
      title="Tasks"
      table="tasks"
      select="id, title, status, deadline, created_at"
      searchFields={['title', 'status']}
      renderRow={(r) => ({
        primary: String(r.title ?? '—'),
        secondary: r.deadline
          ? `Due ${new Date(String(r.deadline)).toLocaleDateString()}`
          : r.created_at
            ? `Created ${new Date(String(r.created_at)).toLocaleDateString()}`
            : null,
        tag: String(r.status ?? ''),
      })}
    />
  ),
})
