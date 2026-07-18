import { useEffect, useState } from 'react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { FileDrop } from '../components/FileDrop'
import { SelectableGrid } from '../components/SelectableGrid'
import { Field, Segmented } from '../components/controls'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard } from '../components/ResultCard'
import { usePdfDoc } from '../components/usePdfDoc'
import { rotatePages, type RotationDelta } from '../lib/pdf/rotate'
import { friendlyError } from '../lib/pdf/errors'
import { outputName } from '../lib/format'

export default function RotateTool() {
  const tool = getTool('rotate')
  const [file, setFile] = useState<File | null>(null)
  const { doc, bytes, error: loadError, loading } = usePdfDoc(file)
  const pageCount = doc?.numPages ?? 0

  const [angle, setAngle] = useState<'90' | '180' | '270'>('90')
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; data: Uint8Array } | null>(null)

  // all pages selected by default
  useEffect(() => {
    setSelected(doc ? new Set(Array.from({ length: doc.numPages }, (_, i) => i)) : new Set())
  }, [doc])

  function reset() {
    setFile(null)
    setResult(null)
    setError(null)
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function run() {
    if (!bytes || !file) return
    setError(null)
    setBusy(true)
    try {
      const targets = selected.size === pageCount ? ('all' as const) : [...selected]
      const data = await rotatePages(bytes, targets, Number(angle) as RotationDelta)
      setResult({ name: outputName(file.name, 'rotated'), data })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolShell tool={tool}>
      {result ? (
        <ResultCard files={[result]} onReset={reset} />
      ) : !file ? (
        <FileDrop kind="pdf" onFiles={(f) => setFile(f[0])} title="Select a PDF" />
      ) : loading ? (
        <p className="animate-pulse text-sm text-slate-500">Reading PDF…</p>
      ) : loadError ? (
        <div>
          <ErrorAlert message={loadError} />
          <button className="btn-secondary mt-4" onClick={reset}>
            Try another file
          </button>
        </div>
      ) : doc ? (
        <div className="space-y-5">
          <div className="card flex flex-wrap items-end gap-6">
            <Field label="Rotate by">
              <Segmented
                options={[
                  { value: '90', label: '90° right' },
                  { value: '180', label: '180°' },
                  { value: '270', label: '90° left' },
                ]}
                value={angle}
                onChange={setAngle}
              />
            </Field>
            <div className="flex items-center gap-3 pb-1">
              <button
                className="btn-secondary"
                onClick={() => setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i)))}
              >
                Select all
              </button>
              <button className="btn-secondary" onClick={() => setSelected(new Set())}>
                Clear
              </button>
              <span className="text-sm text-slate-500">
                {selected.size} of {pageCount} selected
              </span>
            </div>
          </div>
          <SelectableGrid doc={doc} pageCount={pageCount} selected={selected} onToggle={toggle} />
          <button
            className="btn-primary"
            disabled={busy || selected.size === 0}
            onClick={run}
            data-testid="action-button"
          >
            Rotate {selected.size} page{selected.size === 1 ? '' : 's'}
          </button>
          {busy && <p className="animate-pulse text-sm text-slate-500">Rotating…</p>}
          {error && <ErrorAlert message={error} />}
        </div>
      ) : null}
    </ToolShell>
  )
}
