import { isPath, type Field, type ScoutData, type Section } from '~/lib/scouting'
import { AutoPathField } from './AutoPathField'
import { card, cardHead, cardTitle, input, label } from '~/lib/ui'

type Props = {
  sections: Section[]
  data: ScoutData
  onChange: (next: ScoutData) => void
  /** Highlights the robot's side on drawn-path fields. */
  alliance?: 'red' | 'blue' | ''
}

/** Renders a scouting form from a section config. Controls are sized for thumbs in the stands. */
export function ScoutFields({ sections, data, onChange, alliance = '' }: Props) {
  const set = (key: string, v: ScoutData[string]) => onChange({ ...data, [key]: v })

  return (
    <>
      {sections.map((s) => (
        <section key={s.title} className={card}>
          <div className={cardHead}>
            <span className={cardTitle}>{s.title}</span>
          </div>
          <div className="p-4 sm:p-5 grid sm:grid-cols-2 gap-4">
            {s.fields.map((f) => (
              <FieldControl key={f.key} section={s.title} alliance={alliance} field={f} value={data[f.key]} set={(v) => set(f.key, v)} />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function FieldControl({
  section,
  alliance,
  field: f,
  value,
  set,
}: {
  section: string
  alliance: 'red' | 'blue' | ''
  field: Field
  value: ScoutData[string]
  set: (v: ScoutData[string]) => void
}) {
  if (f.kind === 'path') {
    return (
      <div className="sm:col-span-2">
        <span className={label}>{f.label}</span>
        {f.hint && <p className="text-xs text-ink-soft -mt-1 mb-2">{f.hint}</p>}
        <AutoPathField value={isPath(value) ? value : null} onChange={set} alliance={alliance} />
      </div>
    )
  }

  if (f.kind === 'counter') {
    const n = typeof value === 'number' ? value : 0
    return (
      <div>
        <span className={label}>{f.label}</span>
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            aria-label={`Decrease ${section} ${f.label.toLowerCase()}`}
            onClick={() => set(Math.max(0, n - 1))}
            className="h-14 w-14 shrink-0 rounded-xl border border-white/10 bg-white/5 text-2xl font-semibold hover:bg-white/10 active:scale-95 transition-all"
          >
            −
          </button>
          <output
            aria-live="polite"
            aria-label={`${section} ${f.label.toLowerCase()}`}
            className="flex-1 h-14 grid place-items-center rounded-xl border border-white/8 bg-white/[0.03] text-2xl font-mono tabular-nums"
          >
            {n}
          </output>
          <button
            type="button"
            aria-label={`Increase ${section} ${f.label.toLowerCase()}`}
            onClick={() => set(n + 1)}
            className="h-14 w-20 shrink-0 rounded-xl bg-accent text-[#06080b] text-2xl font-semibold hover:brightness-110 active:scale-95 transition-all"
          >
            +
          </button>
        </div>
      </div>
    )
  }

  if (f.kind === 'toggle') {
    const on = value === true
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => set(!on)}
        className={`h-14 px-4 rounded-xl border text-left text-sm font-medium flex items-center justify-between gap-3 transition-all active:scale-[0.98] sm:self-end ${
          on ? 'bg-accent/15 border-accent/40 text-accent' : 'bg-white/5 border-white/10 text-ink-soft hover:bg-white/10'
        }`}
      >
        {f.label}
        <span
          className={`w-10 h-6 rounded-full relative transition-colors ${on ? 'bg-accent' : 'bg-white/15'}`}
          aria-hidden
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-[#06080b] transition-all ${on ? 'left-[18px]' : 'left-0.5'}`}
          />
        </span>
      </button>
    )
  }

  if (f.kind === 'choice') {
    return (
      <fieldset className="sm:col-span-2">
        <legend className={label}>{f.label}</legend>
        <div className="flex flex-wrap gap-2">
          {f.options.map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={value === v}
              onClick={() => set(v)}
              className={`h-11 px-4 rounded-lg border text-sm transition-all active:scale-[0.98] ${
                value === v
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-white/5 border-white/10 text-ink-soft hover:bg-white/10'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>
    )
  }

  if (f.kind === 'rating') {
    const n = typeof value === 'number' ? value : 0
    return (
      <fieldset>
        <legend className={label}>{f.label}</legend>
        <div className="flex gap-1.5">
          {Array.from({ length: f.max }, (_, i) => i + 1).map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`${f.label} ${i} of ${f.max}`}
              aria-pressed={n === i}
              onClick={() => set(n === i ? 0 : i)}
              className={`h-11 flex-1 rounded-lg border font-mono text-sm transition-all active:scale-95 ${
                i <= n ? 'bg-accent/15 border-accent/40 text-accent' : 'bg-white/5 border-white/10 text-ink-soft hover:bg-white/10'
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </fieldset>
    )
  }

  if (f.kind === 'number') {
    return (
      <label className="block">
        <span className={label}>
          {f.label}
          {f.suffix ? ` (${f.suffix})` : ''}
        </span>
        <input
          type="number"
          inputMode="decimal"
          className={input}
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))}
        />
      </label>
    )
  }

  return (
    <label className="block sm:col-span-2">
      <span className={label}>{f.label}</span>
      <input
        className={input}
        placeholder={f.placeholder}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => set(e.target.value || null)}
      />
    </label>
  )
}
