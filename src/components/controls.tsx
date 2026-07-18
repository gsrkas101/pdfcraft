import type { ReactNode } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </div>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; hint?: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.hint}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PositionGrid<T extends string>({
  positions,
  value,
  onChange,
  cols = 3,
}: {
  positions: T[]
  value: T
  onChange: (v: T) => void
  cols?: number
}) {
  return (
    <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 2.25rem)` }}>
      {positions.map((p) => (
        <button
          key={p}
          type="button"
          aria-label={p}
          title={p.replace('-', ' ')}
          onClick={() => onChange(p)}
          className={`h-8 rounded border transition ${
            value === p ? 'border-emerald-600 bg-emerald-100' : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        />
      ))}
    </div>
  )
}
