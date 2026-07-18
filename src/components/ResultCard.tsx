import { CheckCircle2, Download, RotateCcw } from 'lucide-react'
import { formatBytes } from '../lib/format'
import { downloadBytes } from '../lib/browser/download'
import { zipFiles } from '../lib/browser/zip'

export interface ResultFile {
  name: string
  data: Uint8Array
  mime?: string
}

export function ResultCard({
  files,
  note,
  before,
  onReset,
  zipName,
}: {
  files: ResultFile[]
  /** amber informational note, e.g. honest compression caveats */
  note?: string
  /** original size in bytes — renders a before → after line */
  before?: number
  onReset: () => void
  zipName?: string
}) {
  const total = files.reduce((s, f) => s + f.data.length, 0)
  const saved = before && before > 0 ? Math.round((1 - total / before) * 100) : null

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center" data-testid="result-card">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
      <h2 className="mt-3 text-xl font-bold text-slate-900">Done!</h2>
      {before !== undefined && (
        <p className="mt-1 text-sm text-slate-600">
          {formatBytes(before)} → <span className="font-semibold">{formatBytes(total)}</span>
          {saved !== null && saved > 0 && (
            <span className="ml-2 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
              −{saved}%
            </span>
          )}
        </p>
      )}
      {note && <p className="mx-auto mt-2 max-w-md text-sm text-amber-700">{note}</p>}

      <div className="mt-6 flex flex-col items-center gap-2">
        {files.length === 1 ? (
          <button
            className="btn-primary"
            onClick={() => downloadBytes(files[0].data, files[0].name, files[0].mime)}
          >
            <Download className="h-4 w-4" /> Download {files[0].name}
            <span className="text-xs opacity-70">({formatBytes(files[0].data.length)})</span>
          </button>
        ) : (
          <>
            <button
              className="btn-primary"
              onClick={() => downloadBytes(zipFiles(files), zipName ?? 'pdfcraft.zip', 'application/zip')}
            >
              <Download className="h-4 w-4" /> Download all ({files.length} files, zip)
            </button>
            <div className="mt-2 max-h-44 w-full max-w-md overflow-auto rounded-lg border border-emerald-200 bg-white text-left">
              {files.map((f) => (
                <button
                  key={f.name}
                  onClick={() => downloadBytes(f.data, f.name, f.mime)}
                  className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <span className="truncate">{f.name}</span>
                  <span className="ml-3 shrink-0 text-xs text-slate-400">{formatBytes(f.data.length)}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <button
          onClick={onReset}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Start over
        </button>
      </div>
    </div>
  )
}
