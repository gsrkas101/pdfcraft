import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { AddFilesButton, FileDrop } from '../components/FileDrop'
import { Field, Segmented } from '../components/controls'
import { Progress } from '../components/Progress'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard } from '../components/ResultCard'
import { fileToEmbeddable } from '../lib/browser/canvas'
import { imagesToPdf, type ImageInput } from '../lib/pdf/imagesToPdf'
import { friendlyError } from '../lib/pdf/errors'
import { baseName } from '../lib/format'

interface Item {
  uid: string
  file: File
  url: string
}

export default function JpgToPdfTool() {
  const tool = getTool('jpg-to-pdf')
  const [items, setItems] = useState<Item[]>([])
  const itemsRef = useRef(items)
  itemsRef.current = items
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), [])

  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'fit'>('a4')
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto')
  const [margin, setMargin] = useState<'0' | '24' | '48'>('24')
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; data: Uint8Array } | null>(null)

  const addFiles = (files: File[]) =>
    setItems((prev) => [
      ...prev,
      ...files.map((f) => ({ uid: crypto.randomUUID(), file: f, url: URL.createObjectURL(f) })),
    ])

  function remove(uid: string) {
    setItems((prev) => {
      const gone = prev.find((i) => i.uid === uid)
      if (gone) URL.revokeObjectURL(gone.url)
      return prev.filter((i) => i.uid !== uid)
    })
  }

  function move(uid: string, dir: -1 | 1) {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.uid === uid)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function reset() {
    items.forEach((i) => URL.revokeObjectURL(i.url))
    setItems([])
    setResult(null)
    setError(null)
  }

  async function run() {
    setError(null)
    setBusy({ done: 0, total: items.length })
    try {
      const imgs: ImageInput[] = []
      for (let i = 0; i < items.length; i++) {
        imgs.push(await fileToEmbeddable(items[i].file))
        setBusy({ done: i + 1, total: items.length })
      }
      const data = await imagesToPdf(imgs, { pageSize, orientation, margin: Number(margin) })
      const name = items.length === 1 ? `${baseName(items[0].file.name)}.pdf` : 'images.pdf'
      setResult({ name, data })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <ToolShell tool={tool}>
      {result ? (
        <ResultCard files={[result]} onReset={reset} />
      ) : items.length === 0 ? (
        <FileDrop kind="image" multiple onFiles={addFiles} title="Select images" subtitle="JPG, PNG or WebP — or drop them here" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item, idx) => (
              <div key={item.uid} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                <img src={item.url} alt={item.file.name} className="h-32 w-full rounded-lg bg-slate-100 object-contain" />
                <p className="mt-1.5 truncate text-xs text-slate-500">{item.file.name}</p>
                <div className="mt-1 flex items-center justify-end gap-1">
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    disabled={idx === 0}
                    onClick={() => move(item.uid, -1)}
                    title="Move earlier"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    disabled={idx === items.length - 1}
                    onClick={() => move(item.uid, 1)}
                    title="Move later"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => remove(item.uid)}
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="card flex flex-wrap gap-6">
            <Field label="Page size">
              <Segmented
                options={[
                  { value: 'a4', label: 'A4' },
                  { value: 'letter', label: 'Letter' },
                  { value: 'fit', label: 'Fit image' },
                ]}
                value={pageSize}
                onChange={setPageSize}
              />
            </Field>
            {pageSize !== 'fit' && (
              <Field label="Orientation">
                <Segmented
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'portrait', label: 'Portrait' },
                    { value: 'landscape', label: 'Landscape' },
                  ]}
                  value={orientation}
                  onChange={setOrientation}
                />
              </Field>
            )}
            <Field label="Margin">
              <Segmented
                options={[
                  { value: '0', label: 'None' },
                  { value: '24', label: 'Small' },
                  { value: '48', label: 'Big' },
                ]}
                value={margin}
                onChange={setMargin}
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <AddFilesButton kind="image" onFiles={addFiles} />
            <button className="btn-primary" disabled={!!busy || items.length === 0} onClick={run} data-testid="action-button">
              Create PDF ({items.length} image{items.length === 1 ? '' : 's'})
            </button>
          </div>
          {busy && <Progress label="Converting images" done={busy.done} total={busy.total} />}
          {error && <ErrorAlert message={error} />}
        </div>
      )}
    </ToolShell>
  )
}
