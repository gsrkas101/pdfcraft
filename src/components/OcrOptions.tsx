import type { OcrLang, OcrProgress } from '../lib/browser/ocr'

export const OCR_LANGS: { value: OcrLang; label: string }[] = [
  { value: 'eng', label: 'English' },
  { value: 'hin', label: 'हिन्दी Hindi' },
  { value: 'eng+hin', label: 'English + Hindi' },
]

export function OcrProgressBar({ p }: { p: OcrProgress }) {
  const pct = Math.round(((p.page - 1 + p.progress) / p.total) * 100)
  return (
    <div className="mt-2" role="status" aria-live="polite">
      <div className="mb-1 flex justify-between text-sm text-slate-600">
        <span>
          {p.status}… {p.total > 1 && <span className="text-slate-400">(page {p.page} of {p.total})</span>}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
