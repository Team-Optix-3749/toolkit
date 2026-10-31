import type { OutreachEvent } from './types'
export function eventState(event: Pick<OutreachEvent,'cancelled'|'starts_at'|'ends_at'>, now = Date.now()): 'Scheduled' | 'In progress' | 'Completed' | 'Cancelled' {
  if(event.cancelled) return 'Cancelled'
  if(now < Date.parse(event.starts_at)) return 'Scheduled'
  return now < Date.parse(event.ends_at) ? 'In progress' : 'Completed'
}
