// Scouting form definitions. These are game-agnostic on purpose: when the new
// game is revealed, edit the field lists below (keys are stored in `data` jsonb,
// so renaming a key orphans old entries — add new keys instead).

export type CounterField = { kind: 'counter'; key: string; label: string }
export type ToggleField = { kind: 'toggle'; key: string; label: string }
export type ChoiceField = { kind: 'choice'; key: string; label: string; options: [string, string][] }
export type RatingField = { kind: 'rating'; key: string; label: string; max: number }
export type TextField = { kind: 'text'; key: string; label: string; placeholder?: string }
export type NumberField = { kind: 'number'; key: string; label: string; suffix?: string }
export type Field = CounterField | ToggleField | ChoiceField | RatingField | TextField | NumberField

export type Section = { title: string; fields: Field[] }

export const MATCH_SECTIONS: Section[] = [
  {
    title: 'Autonomous',
    fields: [
      { kind: 'toggle', key: 'auto_leave', label: 'Left starting zone' },
      { kind: 'counter', key: 'auto_scored', label: 'Pieces scored' },
      { kind: 'counter', key: 'auto_missed', label: 'Pieces missed' },
    ],
  },
  {
    title: 'Teleop',
    fields: [
      { kind: 'counter', key: 'tele_scored', label: 'Pieces scored' },
      { kind: 'counter', key: 'tele_missed', label: 'Pieces missed' },
      { kind: 'counter', key: 'tele_pickups', label: 'Floor pickups' },
    ],
  },
  {
    title: 'Endgame',
    fields: [
      {
        kind: 'choice',
        key: 'endgame',
        label: 'Endgame result',
        options: [
          ['none', 'None'],
          ['park', 'Park'],
          ['low', 'Low climb'],
          ['high', 'High climb'],
          ['failed', 'Failed attempt'],
        ],
      },
    ],
  },
  {
    title: 'Performance',
    fields: [
      { kind: 'rating', key: 'driver', label: 'Driver skill', max: 5 },
      { kind: 'rating', key: 'defense', label: 'Defense played', max: 5 },
      { kind: 'counter', key: 'fouls', label: 'Fouls' },
      { kind: 'toggle', key: 'died', label: 'Robot died / disabled' },
      { kind: 'toggle', key: 'tipped', label: 'Tipped over' },
    ],
  },
]

export const PIT_SECTIONS: Section[] = [
  {
    title: 'Robot',
    fields: [
      {
        kind: 'choice',
        key: 'drivetrain',
        label: 'Drivetrain',
        options: [
          ['swerve', 'Swerve'],
          ['tank', 'Tank / West coast'],
          ['mecanum', 'Mecanum'],
          ['other', 'Other'],
        ],
      },
      { kind: 'number', key: 'weight', label: 'Weight', suffix: 'lb' },
      { kind: 'number', key: 'speed', label: 'Top speed', suffix: 'ft/s' },
      { kind: 'text', key: 'mechanisms', label: 'Scoring mechanisms', placeholder: 'Intake, shooter, elevator…' },
    ],
  },
  {
    title: 'Capabilities',
    fields: [
      { kind: 'text', key: 'auto_routines', label: 'Auto routines', placeholder: 'e.g. 3-piece from center' },
      {
        kind: 'choice',
        key: 'endgame',
        label: 'Endgame capability',
        options: [
          ['none', 'None'],
          ['park', 'Park'],
          ['low', 'Low climb'],
          ['high', 'High climb'],
        ],
      },
      { kind: 'toggle', key: 'plays_defense', label: 'Willing to play defense' },
      { kind: 'text', key: 'start_position', label: 'Preferred start position' },
    ],
  },
]

export const STATIONS = ['red1', 'red2', 'red3', 'blue1', 'blue2', 'blue3'] as const
export type Station = (typeof STATIONS)[number]

export const MATCH_TYPE_LABEL: Record<string, string> = {
  pm: 'Practice',
  qm: 'Qual',
  sf: 'Semifinal',
  f: 'Final',
}

export type ScoutEvent = {
  id: string
  created_at: string
  name: string
  event_code: string | null
  starts_on: string | null
  ends_on: string | null
  is_active: boolean
  season_id: string | null
}

export type ScoutMatch = {
  id: string
  event_id: string
  match_type: string
  match_number: number
  red: number[]
  blue: number[]
  scheduled_at: string | null
}

export type ScoutAssignment = {
  id: string
  match_id: string
  station: Station
  scout_id: string
}

export type ScoutData = Record<string, number | boolean | string | null>

export type MatchEntry = {
  id: string
  created_at: string
  updated_at: string
  event_id: string
  match_type: string
  match_number: number
  team_number: number
  alliance: 'red' | 'blue' | null
  scout_id: string
  data: ScoutData
  notes: string | null
}

export type PitEntry = {
  id: string
  created_at: string
  updated_at: string
  event_id: string
  team_number: number
  scout_id: string
  data: ScoutData
  notes: string | null
}

export const teamAtStation = (m: ScoutMatch, s: Station): number | null => {
  const arr = s.startsWith('red') ? m.red : m.blue
  return arr[Number(s.slice(-1)) - 1] ?? null
}

export const matchLabel = (type: string, n: number) => `${type === 'qm' ? 'Q' : type.toUpperCase()}${n}`

export function emptyData(sections: Section[]): ScoutData {
  const d: ScoutData = {}
  for (const s of sections)
    for (const f of s.fields) {
      if (f.kind === 'counter') d[f.key] = 0
      else if (f.kind === 'toggle') d[f.key] = false
      else if (f.kind === 'choice') d[f.key] = f.options[0][0]
      else d[f.key] = null
    }
  return d
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export type TeamStats = {
  team: number
  matches: number
  autoScored: number
  teleScored: number
  totalScored: number
  accuracy: number | null
  leaveRate: number
  climbRate: number
  driver: number | null
  defense: number | null
  diedCount: number
  fouls: number
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

/** Aggregate match entries for one team. Duplicate scouts of the same match are averaged as separate entries. */
export function teamStats(team: number, entries: MatchEntry[]): TeamStats {
  const rows = entries.filter((e) => e.team_number === team)
  const scored = rows.map((e) => num(e.data.auto_scored) + num(e.data.tele_scored))
  const missed = rows.map((e) => num(e.data.auto_missed) + num(e.data.tele_missed))
  const attempts = scored.reduce((a, b) => a + b, 0) + missed.reduce((a, b) => a + b, 0)
  const ratings = (k: string) => rows.map((e) => num(e.data[k])).filter((n) => n > 0)
  const drv = ratings('driver')
  const def = ratings('defense')
  return {
    team,
    matches: rows.length,
    autoScored: avg(rows.map((e) => num(e.data.auto_scored))),
    teleScored: avg(rows.map((e) => num(e.data.tele_scored))),
    totalScored: avg(scored),
    accuracy: attempts ? scored.reduce((a, b) => a + b, 0) / attempts : null,
    leaveRate: rows.length ? rows.filter((e) => e.data.auto_leave === true).length / rows.length : 0,
    climbRate: rows.length
      ? rows.filter((e) => e.data.endgame === 'low' || e.data.endgame === 'high').length / rows.length
      : 0,
    driver: drv.length ? avg(drv) : null,
    defense: def.length ? avg(def) : null,
    diedCount: rows.filter((e) => e.data.died === true).length,
    fouls: avg(rows.map((e) => num(e.data.fouls))),
  }
}

export const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`)
export const one = (n: number | null) => (n == null ? '—' : (Math.round(n * 10) / 10).toFixed(1))

/**
 * Parse a pasted schedule. One match per line:
 *   `<match#> <red1> <red2> <red3> <blue1> <blue2> <blue3>`
 * Commas/tabs are fine (works straight from a spreadsheet copy). Lines that
 * don't have 7 numbers are reported back as errors.
 */
export function parseSchedule(text: string): { rows: { n: number; red: number[]; blue: number[] }[]; errors: string[] } {
  const rows: { n: number; red: number[]; blue: number[] }[] = []
  const errors: string[] = []
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const nums = (line.match(/\d+/g) || []).map(Number)
      if (nums.length !== 7) {
        errors.push(`Line ${i + 1}: expected 7 numbers, got ${nums.length}`)
        return
      }
      rows.push({ n: nums[0], red: nums.slice(1, 4), blue: nums.slice(4, 7) })
    })
  return { rows, errors }
}
