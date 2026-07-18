import { useState } from 'react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { FileDrop } from '../components/FileDrop'
import { SelectableGrid } from '../components/SelectableGrid'
import { Field, Segmented } from '../components/controls'
import { Progress } from '../components/Progress'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard, type ResultFile } from '../components/ResultCard'
import { usePdfDoc } from '../components/usePdfDoc'
import { chunkEveryN, extractPages, parsePageRanges, removePages, splitPdf } from '../lib/pdf/split'
import { friendlyError } from '../lib/pdf/errors'
import { outputName } from '../lib/format'

const INPUT = 'rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none'

export default function SplitTool({ mode }: { mode: 'split' | 'extract' | 'remove' }) {
  const tool = getTool(mode)
  const [file, setFile] = useState<File | null>(null)
  const { doc, bytes, error: loadError, loading } = usePdfDoc(file)
  const pageCount = doc?.numPages ?? 0

  const [splitBy, setSplitBy] = useState<'ranges' | 'every'>('ranges')
  const [rangeSpec, setRangeSpec] = useState('')
  const [everyN, setEveryN] = useState('1')
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResultFile[] | null>(null)

  function reset() {
    setFile(null)
    setSelected(new Set())
    setResult(null)
    setError(null)
    setRangeSpec('')
    setEveryN('1')
  }

  function pick(files: File[]) {
    setFile(files[0])
    setSelected(new Set())
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
    try {
      if (mode === 'split') {
        const ranges =
          splitBy === 'ranges' ? parsePageRanges(rangeSpec, pageCount) : chunkEveryN(pageCount, Number(everyN))
        setBusy({ done: 0, total: ranges.length })
        const outs = await splitPdf(bytes, ranges, (done, total) => setBusy({ done, total }))
        setResult(outs.map((data, i) => ({ name: outputName(file.name, `part-${i + 1}`), data })))
      } else if (mode === 'extract') {
        setBusy({ done: 0, total: 1 })
        const data = await extractPages(bytes, [...selected])
        setResult([{ name: outputName(file.name, 'extracted'), data }])
      } else {
        setBusy({ done: 0, total: 1 })
        const data = await removePages(bytes, [...selected])
        setResult([{ name: outputName(file.name, 'removed'), data }])
      }
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  const actionLabel =
    mode === 'split'
      ? 'Split PDF'
      : mode === 'extract'
        ? `Extract ${selected.size} page${selected.size === 1 ? '' : 's'}`
        : `Remove ${selected.size} page${selected.size === 1 ? '' : 's'}`

  return (
    <ToolShell tool={tool}>
      {result ? (
        <ResultCard
          files={result}
          onReset={reset}
          zipName={file ? outputName(file.name, 'split', 'zip') : undefined}
        />
      ) : !file ? (
        <FileDrop kind="pdf" onFiles={pick} title="Select a PDF" />
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
          {mode === 'split' ? (
            <div className="card space-y-4">
              <Field label="Split by">
                <Segmented
                  options={[
                    { value: 'ranges', label: 'Custom ranges' },
                    { value: 'every', label: 'Every N pages' },
                  ]}
                  value={splitBy}
                  onChange={setSplitBy}
                />
              </Field>
              {splitBy === 'ranges' ? (
                <Field label={`Page ranges — this PDF has ${pageCount} pages`}>
                  <input
                    value={rangeSpec}
                    onChange={(e) => setRangeSpec(e.target.value)}
                    placeholder={`e.g. 1-3, 7, 9-${pageCount}`}
                    className={`${INPUT} w-full max-w-sm`}
                    data-testid="range-input"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">Each range becomes its own PDF file.</p>
                </Field>
              ) : (
                <Field label="Pages per file">
                  <input
                    type="number"
                    min={1}
                    value={everyN}
                    onChange={(e) => setEveryN(e.target.value)}
                    className={`${INPUT} w-24`}
                  />
                </Field>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
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
                  {selected.size} of {pageCount} pages selected
                </span>
              </div>
              <SelectableGrid doc={doc} pageCount={pageCount} selected={selected} onToggle={toggle} />
            </>
          )}
          <button
            className="btn-primary"
            disabled={
              !!busy || (mode === 'split' ? splitBy === 'ranges' && !rangeSpec.trim() : selected.size === 0)
            }
            onClick={run}
            data-testid="action-button"
          >
            {actionLabel}
          </button>
          {busy && <Progress label={mode === 'split' ? 'Splitting' : 'Working'} done={busy.done} total={busy.total} />}
          {error && <ErrorAlert message={error} />}
        </div>
      ) : null}
    </ToolShell>
  )
}
