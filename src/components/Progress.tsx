export function Progress({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="mt-6" role="status" aria-live="polite">
      <div className="mb-1 flex justify-between text-sm text-slate-600">
        <span>{label}…</span>
        <span>
          {done}/{total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
