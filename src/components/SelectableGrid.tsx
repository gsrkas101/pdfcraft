import type { PDFDocumentProxy } from 'pdfjs-dist'
import { Check } from 'lucide-react'
import { ThumbCanvas } from './ThumbCanvas'

/** Thumbnail grid with toggleable page selection. */
export function SelectableGrid({
  doc,
  pageCount,
  selected,
  onToggle,
}: {
  doc: PDFDocumentProxy
  pageCount: number
  selected: ReadonlySet<number>
  onToggle: (i: number) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {Array.from({ length: pageCount }, (_, i) => {
        const on = selected.has(i)
        return (
          <button
            type="button"
            key={i}
            onClick={() => onToggle(i)}
            className={`relative rounded-lg p-1.5 text-left transition ${
              on ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'bg-slate-100 hover:bg-slate-200'
            }`}
            data-testid={`page-${i + 1}`}
          >
            <ThumbCanvas doc={doc} pageIndex={i} />
            <span className="mt-1 block text-center text-xs text-slate-500">{i + 1}</span>
            {on && (
              <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-3 w-3" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
