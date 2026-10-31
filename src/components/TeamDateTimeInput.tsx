import { useId } from 'react'
import { teamDateTime } from '~/lib/time'
import { input, label as labelClass } from '~/lib/ui'

export type TimeDisambiguation = 'reject' | 'earlier' | 'later'

export function TeamDateTimeInput({ label, value, disambiguation, onChange, onDisambiguationChange }: {
  label: string
  value: string
  disambiguation: TimeDisambiguation
  onChange: (value: string) => void
  onDisambiguationChange: (value: TimeDisambiguation) => void
}) {
  const id = useId()
  let repeated = false
  let invalid = false
  if (value) {
    try {
      teamDateTime(value)
    } catch {
      try {
        repeated = teamDateTime(value, 'earlier') !== teamDateTime(value, 'later')
        invalid = !repeated
      } catch {
        invalid = true
      }
    }
  }

  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label} (Los Angeles)</label>
      <input
        id={id}
        type="datetime-local"
        className={input}
        value={value}
        aria-invalid={invalid || (repeated && disambiguation === 'reject')}
        aria-describedby={invalid || repeated ? `${id}-help` : undefined}
        onChange={(event) => {
          onChange(event.target.value)
          onDisambiguationChange('reject')
        }}
      />
      {invalid && <p id={`${id}-help`} className="mt-2 text-sm text-danger" role="alert">Enter a valid Los Angeles time. Times skipped during spring daylight saving do not exist.</p>}
      {repeated && (
        <div className="mt-2 space-y-2">
          <p id={`${id}-help`} className="text-sm text-ink-soft">This time occurs twice when daylight saving ends. Choose which occurrence before saving.</p>
          <label htmlFor={`${id}-occurrence`} className={labelClass}>{label}: repeated-time occurrence</label>
          <select id={`${id}-occurrence`} className={input} value={disambiguation} onChange={(event) => onDisambiguationChange(event.target.value as TimeDisambiguation)}>
            <option value="reject">Choose an occurrence</option>
            <option value="earlier">Earlier occurrence (daylight time)</option>
            <option value="later">Later occurrence (standard time)</option>
          </select>
        </div>
      )}
    </div>
  )
}
