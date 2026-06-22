import { RRule, rrulestr } from 'rrule'

// Expand a stored session into upcoming occurrence start-times.
// One-off sessions (no rrule) just return their own start if upcoming.
export function nextOccurrences(
  startsAt: string,
  rrule: string | null,
  count = 5,
  from = new Date(),
): Date[] {
  if (!rrule) {
    const d = new Date(startsAt)
    return d >= from ? [d] : []
  }
  try {
    // Anchor the rule to the session start via DTSTART.
    const dtstart = new Date(startsAt)
    const rule =
      rrule.includes('DTSTART')
        ? (rrulestr(rrule) as RRule)
        : new RRule({ ...RRule.parseString(rrule), dtstart })
    return rule.all((_d, i) => i < count + 20).filter((d) => d >= from).slice(0, count)
  } catch {
    const d = new Date(startsAt)
    return d >= from ? [d] : []
  }
}

// Build an RRULE string from simple form inputs.
export function buildRRule(opts: {
  freq: 'DAILY' | 'WEEKLY'
  interval: number
  byday?: string[] // ['MO','WE']
  count?: number
}): string {
  const parts = [`FREQ=${opts.freq}`, `INTERVAL=${Math.max(1, opts.interval)}`]
  if (opts.freq === 'WEEKLY' && opts.byday?.length) parts.push(`BYDAY=${opts.byday.join(',')}`)
  if (opts.count) parts.push(`COUNT=${opts.count}`)
  return parts.join(';')
}

export const WEEKDAYS: [string, string][] = [
  ['MO', 'Mon'],
  ['TU', 'Tue'],
  ['WE', 'Wed'],
  ['TH', 'Thu'],
  ['FR', 'Fri'],
  ['SA', 'Sat'],
  ['SU', 'Sun'],
]
