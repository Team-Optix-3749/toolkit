import {describe,it,expect} from 'vitest'
import {deadlineInstant,isOverdue,TEAM_ZONE,teamDateTime,teamInput} from './time'
import {fmtDate,hoursFromMinutes,minutesBetween} from './format'
describe('exact elapsed credit and date-only display',()=>{
  it('keeps90seconds fractional and rounds only formatted hours',()=>{
    expect(minutesBetween('2026-10-29T10:00:00Z','2026-10-29T10:01:30Z')).toBe(1.5)
    expect(hoursFromMinutes(61)).toBe(61/60)
    expect(hoursFromMinutes(61).toFixed(2)).toBe('1.02')
  })
  it('preserves the calendar date without UTC-midnight parsing',()=>{
    expect(fmtDate('2026-10-29')).toContain('29')
  })
})
describe('Los Angeles wall-clock input',()=>{
  it('rejects gaps and requires a choice for folds',()=>{
    expect(TEAM_ZONE).toBe('America/Los_Angeles')
    for(const choice of ['reject','earlier','later'] as const) expect(()=>teamDateTime('2026-03-08T02:30',choice)).toThrow()
    expect(()=>teamDateTime('2026-11-01T01:30')).toThrow()
    expect(teamDateTime('2026-11-01T01:30','earlier')).toBe('2026-11-01T08:30:00Z')
    expect(teamDateTime('2026-11-01T01:30','later')).toBe('2026-11-01T09:30:00Z')
  })
  it('keeps nullable controls empty and roundtrips saved instants',()=>{
    expect(teamInput(null)).toBe('');expect(teamInput('')).toBe('')
    expect(teamInput('2026-10-29T19:30:00Z')).toBe('2026-10-29T12:30')
    expect(teamDateTime(teamInput('2026-10-29T19:30:00Z'))).toBe('2026-10-29T19:30:00Z')
  })
  it('ends deadlines at next team midnight and never alters task status',()=>{
    expect(deadlineInstant('2026-10-29')).toBe('2026-10-30T07:00:00Z')
    expect(isOverdue('2026-10-29','assigned','2026-10-30T06:59:59Z')).toBe(false)
    expect(isOverdue('2026-10-29','assigned','2026-10-30T07:00:00Z')).toBe(true)
    expect(isOverdue('2026-10-29','completed','2026-11-01T00:00:00Z')).toBe(false)
    expect(isOverdue(null,'assigned')).toBe(false)
  })
})
