export const fmtDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '-'

export const fmtDate = (value?: string | null) => {
  if (!value) return '-'
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export const fmtTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '-'

export const hoursFromMinutes = (minutes?: number | null) => (minutes ?? 0) / 60

export const minutesBetween = (start: string, end: string) =>
  (new Date(end).getTime() - new Date(start).getTime()) / 60000

