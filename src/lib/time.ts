import { Temporal } from '@js-temporal/polyfill'
export const TEAM_ZONE = 'America/Los_Angeles'
export function teamDateTime(value: string, disambiguation: 'reject' | 'earlier' | 'later' = 'reject'): string {
  const plain = Temporal.PlainDateTime.from(value)
  const zoned = plain.toZonedDateTime(TEAM_ZONE, { disambiguation })
  if (!zoned.toPlainDateTime().equals(plain)) throw new RangeError('This Los Angeles time does not exist during the daylight-saving transition.')
  return zoned.toInstant().toString()
}
export function deadlineInstant(value: string): string {
  return Temporal.PlainDate.from(value).add({days:1}).toZonedDateTime({timeZone:TEAM_ZONE,plainTime:'00:00'}).toInstant().toString()
}
export function isOverdue(date: string | null, status: string, now = new Date().toISOString()): boolean {
  return !!date && !['completed','cancelled'].includes(status.toLowerCase()) && Temporal.Instant.compare(now, deadlineInstant(date)) >= 0
}
export function teamInput(value?: string | null): string {
  if (value === null || value === '') return ''
  return Temporal.Instant.from(value ?? new Date().toISOString()).toZonedDateTimeISO(TEAM_ZONE).toPlainDateTime().toString({smallestUnit:'minute',roundingMode:'trunc'})
}
