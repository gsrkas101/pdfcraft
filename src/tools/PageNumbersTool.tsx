import { useState } from 'react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { FileDrop } from '../components/FileDrop'
import { Field, PositionGrid, Segmented } from '../components/controls'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard } from '../components/ResultCard'
import { usePdfDoc } from '../components/usePdfDoc'
import { addPageNumbers, type NumberFormat, type NumberPosition } from '../lib/pdf/pageNumbers'
import { parsePageRanges } from '../lib/pdf/split'
import { friendlyError } from '../lib/pdf/errors'
import { outputName } from '../lib/format'

const POSITIONS: NumberPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

const INPUT = 'rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none'

export default function PageNumbersTool() {
  const tool = getTool('page-numbers')
  const [file, setFile] = useState<File | null>(null)
  const { doc, bytes, error: loadError, loading } = usePdfDoc(file)
  const pageCount = doc?.numPages ?? 0

  const [position, setPosition] = useState<NumberPosition>('bottom-center')
  const [format, setFormat] = useState<NumberFormat>('page-n-of-total')
  const [startAt, setStartAt] = useState('1')
  const [size, setSize] = useState<'10' | '12' | '16'>('12')
  const [colorKey, setColorKey] = useState<'gray' | 'black'>('gray')
  const [rangeSpec, setRangeSpec] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; data: Uint8Array } | null>(null)

  function reset() {
    setFile(null)
    setResult(null)
    setError(null)
  }

  async function run() {
    if (!bytes || !file) return
    setError(null)
    setBusy(true)
    try {
      const pageIndices = rangeSpec.trim() ? parsePageRanges(rangeSpec, pageCount).flat() : undefined
      const data = await addPageNumbers(bytes, {
        position,
        format,
        startAt: Number(startAt) || 1,
        fontSize: Number(size),
        gray: colorKey === 'black' ? 0.1 : 0.45,
        pageIndices,
      })
      setResult({ name: outputName(file.name, 'numbered'), data })
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
          <div className="card grid gap-6 sm:grid-cols-2">
            <Field label="Position (top / bottom row)">
              <PositionGrid positions={POSITIONS} value={position} onChange={setPosition} />
            </Field>
            <Field label="Format">
              <select value={format} onChange={(e) => setFormat(e.target.value as NumberFormat)} className={`${INPUT} w-full max-w-xs bg-white`}>
                <option value="n">1, 2, 3 …</option>
                <option value="page-n">Page 1</option>
                <option value="n-of-total">1 of {pageCount || 'N'}</option>
                <option value="page-n-of-total">Page 1 of {pageCount || 'N'}</option>
              </select>
            </Field>
            <Field label="Start counting from">
              <input
                type="number"
                min={1}
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className={`${INPUT} w-24`}
              />
            </Field>
            <Field label="Text size">
              <Segmented
                options={[
                  { value: '10', label: 'Small' },
                  { value: '12', label: 'Medium' },
                  { value: '16', label: 'Large' },
                ]}
                value={size}
                onChange={setSize}
              />
            </Field>
            <Field label="Color">
              <Segmented
                options={[
                  { value: 'gray', label: 'Gray' },
                  { value: 'black', label: 'Black' },
                ]}
                value={colorKey}
                onChange={setColorKey}
              />
            </Field>
            <Field label={`Pages (optional — this PDF has ${pageCount})`}>
              <input
                value={rangeSpec}
                onChange={(e) => setRangeSpec(e.target.value)}
                placeholder="all pages — or e.g. 2-10"
                className={`${INPUT} w-full max-w-xs`}
              />
            </Field>
          </div>
          <button className="btn-primary" disabled={busy} onClick={run} data-testid="action-button">
            Add page numbers
          </button>
          {busy && <p className="animate-pulse text-sm text-slate-500">Numbering pages…</p>}
          {error && <ErrorAlert message={error} />}
        </div>
      ) : null}
    </ToolShell>
  )
}
