import {it,expect} from 'vitest'
import {eventState} from './outreach'
it('derives states at exact start/end boundaries with cancellation precedence',()=>{
  const event={cancelled:false,starts_at:'2026-10-29T10:00:00Z',ends_at:'2026-10-29T11:00:00Z'}
  expect(eventState(event,Date.parse('2026-10-29T09:59:59Z'))).toBe('Scheduled')
  expect(eventState(event,Date.parse(event.starts_at))).toBe('In progress')
  expect(eventState(event,Date.parse(event.ends_at))).toBe('Completed')
  expect(eventState({...event,cancelled:true},Date.parse(event.starts_at))).toBe('Cancelled')
})
