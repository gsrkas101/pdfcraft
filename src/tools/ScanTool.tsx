import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Camera, ImagePlus, Loader2, SlidersHorizontal, X } from 'lucide-react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { AddFilesButton } from '../components/FileDrop'
import { Field, Segmented } from '../components/controls'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard, type ResultFile } from '../components/ResultCard'
import { CameraCapture } from '../components/CameraCapture'
import { FILTERS, ScanEditor } from '../components/ScanEditor'
import { OCR_LANGS, OcrProgressBar } from '../components/OcrOptions'
import { decodeImage, FULL_QUAD, processScan, type ScanEdit, type ScanFilter } from '../lib/browser/scan'
import { ocrPdf, type OcrLang, type OcrProgress } from '../lib/browser/ocr'
import { imagesToPdf } from '../lib/pdf/imagesToPdf'
import { friendlyError } from '../lib/pdf/errors'

interface ScanPage {
  id: string
  name: string
  bitmap: ImageBitmap
  /** the untouched photo, for the corner editor */
  srcUrl: string
  edit: ScanEdit
  out: { jpg: Uint8Array; url: string } | null
}

const canUseCamera = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

const nextFrame = () => new Promise((r) => setTimeout(r, 16))

export default function ScanTool() {
  const tool = getTool('scan')
  const [pages, setPages] = useState<ScanPage[]>([])
  const pagesRef = useRef(pages)
  pagesRef.current = pages
  useEffect(
    () => () => {
      for (const p of pagesRef.current) {
        URL.revokeObjectURL(p.srcUrl)
        if (p.out) URL.revokeObjectURL(p.out.url)
        p.bitmap.close()
      }
    },
    [],
  )

  const [filter, setFilter] = useState<ScanFilter>('enhance')
  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'fit'>('a4')
  const [ocr, setOcr] = useState(false)
  const [lang, setLang] = useState<OcrLang>('eng')
  const [camera, setCamera] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [working, setWorking] = useState(0)

  const [creating, setCreating] = useState<OcrProgress | 'building' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResultFile[] | null>(null)

  // process one page at a time; heavy pixel loops would otherwise freeze the UI in a burst
  const queue = useRef(Promise.resolve())

  function render(id: string, edit: ScanEdit) {
    // record the settings now, so reopening the editor mid-processing shows them
    pagesRef.current = pagesRef.current.map((p) => (p.id === id ? { ...p, edit } : p))
    setPages(pagesRef.current)
    setWorking((n) => n + 1)
    queue.current = queue.current.then(async () => {
      await nextFrame()
      const page = pagesRef.current.find((p) => p.id === id)
      try {
        if (!page || page.edit !== edit) return // removed, or superseded by a newer edit
        const out = await processScan(page.bitmap, edit)
        setPages((prev) =>
          prev.map((p) => {
            if (p.id !== id) return p
            if (p.out) URL.revokeObjectURL(p.out.url)
            return { ...p, out }
          }),
        )
      } catch (e) {
        setError(friendlyError(e))
      } finally {
        setWorking((n) => n - 1)
      }
    })
  }

  async function addFiles(files: File[]) {
    setError(null)
    for (const file of files) {
      try {
        const bitmap = await decodeImage(file)
        const page: ScanPage = {
          id: crypto.randomUUID(),
          name: file.name,
          bitmap,
          srcUrl: URL.createObjectURL(file),
          edit: { quad: FULL_QUAD, turns: 0, filter },
          out: null,
        }
        pagesRef.current = [...pagesRef.current, page]
        setPages(pagesRef.current)
        render(page.id, page.edit)
      } catch (e) {
        setError(friendlyError(e))
      }
    }
  }

  function remove(id: string) {
    setPages((prev) => {
      const gone = prev.find((p) => p.id === id)
      if (gone) {
        URL.revokeObjectURL(gone.srcUrl)
        if (gone.out) URL.revokeObjectURL(gone.out.url)
        gone.bitmap.close()
      }
      return prev.filter((p) => p.id !== id)
    })
  }

  function move(id: string, dir: -1 | 1) {
    setPages((prev) => {
      const i = prev.findIndex((p) => p.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  function applyFilterToAll(f: ScanFilter) {
    setFilter(f)
    for (const p of pagesRef.current) if (p.edit.filter !== f) render(p.id, { ...p.edit, filter: f })
  }

  function reset() {
    for (const p of pages) {
      URL.revokeObjectURL(p.srcUrl)
      if (p.out) URL.revokeObjectURL(p.out.url)
      p.bitmap.close()
    }
    setPages([])
    setResult(null)
    setError(null)
  }

  async function create() {
    setError(null)
    setCreating('building')
    try {
      await queue.current
      const ready = pagesRef.current.filter((p) => p.out)
      let pdf = await imagesToPdf(
        ready.map((p) => ({ bytes: p.out!.jpg, kind: 'jpg' as const })),
        { pageSize, orientation: 'auto', margin: 0 },
      )
      const files: ResultFile[] = []
      if (ocr) {
        const r = await ocrPdf(pdf, { lang, skipTextPages: false, onProgress: setCreating })
        pdf = r.pdf
        files.push({ name: 'scan.txt', data: new TextEncoder().encode(r.text), mime: 'text/plain' })
      }
      files.unshift({ name: 'scan.pdf', data: pdf })
      setResult(files)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setCreating(null)
    }
  }

  const editPage = pages.find((p) => p.id === editing)

  const pickers = (
    <>
      {canUseCamera && (
        <button type="button" className="btn-primary" onClick={() => setCamera(true)} data-testid="use-camera">
          <Camera className="h-4 w-4" /> Use camera
        </button>
      )}
      <AddFilesButton kind="image" onFiles={addFiles} label={pages.length ? 'Add photos' : 'Choose photos'} />
    </>
  )

  return (
    <ToolShell tool={tool}>
      {result ? (
        <ResultCard files={result} onReset={reset} zipName="scan.zip" />
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center gap-5 rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-white">
            <ImagePlus className="h-7 w-7" />
          </div>
          <div className="flex flex-wrap justify-center gap-3">{pickers}</div>
          <p className="max-w-sm px-4 text-sm text-slate-500">
            Photograph each page on a flat, contrasting surface. You can straighten and clean up every page next.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {pages.map((p, idx) => (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm" data-testid="scan-page">
                <button
                  type="button"
                  className="relative block h-40 w-full overflow-hidden rounded-lg bg-slate-100"
                  onClick={() => setEditing(p.id)}
                  title="Adjust corners, rotation and filter"
                >
                  {p.out ? (
                    <img src={p.out.url} alt={`Page ${idx + 1}`} className="h-full w-full object-contain" />
                  ) : (
                    <Loader2 className="absolute inset-0 m-auto h-6 w-6 animate-spin text-slate-400" />
                  )}
                </button>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Page {idx + 1}</span>
                  <div className="flex items-center gap-0.5">
                    <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setEditing(p.id)} title="Adjust">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" disabled={idx === 0} onClick={() => move(p.id, -1)} title="Move earlier">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30" disabled={idx === pages.length - 1} onClick={() => move(p.id, 1)} title="Move later">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(p.id)} title="Remove">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card grid gap-5 sm:grid-cols-2">
            <Field label="Look (all pages)">
              <Segmented options={FILTERS} value={filter} onChange={applyFilterToAll} />
            </Field>
            <Field label="Page size">
              <Segmented
                options={[
                  { value: 'a4', label: 'A4' },
                  { value: 'letter', label: 'Letter' },
                  { value: 'fit', label: 'Same as photo' },
                ]}
                value={pageSize}
                onChange={setPageSize}
              />
            </Field>
            <div className="space-y-3 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={ocr} onChange={(e) => setOcr(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
                Make text searchable (OCR)
              </label>
              {ocr && <Segmented options={OCR_LANGS} value={lang} onChange={setLang} />}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {pickers}
            <button
              className="btn-primary"
              disabled={!!creating || working > 0}
              onClick={create}
              data-testid="action-button"
            >
              Create PDF ({pages.length} page{pages.length === 1 ? '' : 's'})
            </button>
            {working > 0 && <span className="text-sm text-slate-500">Processing photos…</span>}
          </div>
          {creating === 'building' && <p className="animate-pulse text-sm text-slate-500">Building PDF…</p>}
          {creating && creating !== 'building' && <OcrProgressBar p={creating} />}
          {error && <ErrorAlert message={error} />}
        </div>
      )}

      {camera && <CameraCapture onShot={(f) => void addFiles([f])} onClose={() => setCamera(false)} />}
      {editPage && (
        <ScanEditor
          src={editPage.srcUrl}
          initial={editPage.edit}
          onClose={() => setEditing(null)}
          onApply={(edit) => {
            setEditing(null)
            render(editPage.id, edit)
          }}
        />
      )}
    </ToolShell>
  )
}
