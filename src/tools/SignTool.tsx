import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Copy, PenLine, Plus, Trash2, Type } from 'lucide-react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { FileDrop } from '../components/FileDrop'
import { PageNav, PagePreview, type PageSize } from '../components/PagePreview'
import { DraggableBox } from '../components/DraggableBox'
import { SignatureMaker } from '../components/SignatureMaker'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard } from '../components/ResultCard'
import { usePdfDoc } from '../components/usePdfDoc'
import { stampImages } from '../lib/pdf/stamp'
import type { DisplayRect } from '../lib/pdf/geometry'
import { textToInk, type InkImage } from '../lib/browser/signature'
import { friendlyError } from '../lib/pdf/errors'
import { outputName } from '../lib/format'

interface Placed {
  id: string
  pageIndex: number
  rect: DisplayRect
  ink: InkImage
}

const TEXT_FONT = 'Helvetica, Arial, sans-serif'

export default function SignTool() {
  const tool = getTool('sign')
  const [file, setFile] = useState<File | null>(null)
  const { doc, bytes, error: loadError, loading } = usePdfDoc(file)
  const pageCount = doc?.numPages ?? 0

  const [pageIndex, setPageIndex] = useState(0)
  const [size, setSize] = useState<PageSize | null>(null)
  const [signatures, setSignatures] = useState<InkImage[]>([])
  const [placed, setPlaced] = useState<Placed[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [making, setMaking] = useState(false)
  const [text, setText] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; data: Uint8Array } | null>(null)

  // every ink image (signatures and text stamps) owns an object URL — free them on unmount
  const inks = useRef(new Set<InkImage>())
  useEffect(() => {
    const owned = inks.current
    return () => {
      owned.forEach((i) => URL.revokeObjectURL(i.url))
    }
  }, [])

  useEffect(() => {
    setPageIndex(0)
    setPlaced([])
    setSelected(null)
    setSize(null)
  }, [doc])

  function reset() {
    setFile(null)
    setResult(null)
    setError(null)
  }

  /** Drop an ink image on the current page, `widthPt` wide, staggered so repeats don't stack exactly. */
  function place(ink: InkImage, widthPt: number) {
    if (!size) return
    inks.current.add(ink)
    const width = Math.min(0.6, widthPt / size.widthPt)
    const height = width * ink.aspect * (size.widthPt / size.heightPt)
    const n = placed.filter((p) => p.pageIndex === pageIndex).length % 6
    const rect = {
      left: Math.max(0, 0.92 - width - n * 0.03),
      top: Math.max(0, Math.min(1 - height, 0.78 - n * 0.04)),
      width,
      height: Math.min(1, height),
    }
    const id = crypto.randomUUID()
    setPlaced((prev) => [...prev, { id, pageIndex, rect, ink }])
    setSelected(id)
  }

  async function placeText(value: string) {
    if (!size || !value.trim()) return
    const ink = await textToInk(value.trim(), TEXT_FONT, '#111827')
    if (!ink) return
    // ~12pt tall, whatever the string length
    place(ink, 12 / ink.aspect)
  }

  function updateRect(id: string, rect: DisplayRect) {
    setPlaced((prev) => prev.map((p) => (p.id === id ? { ...p, rect } : p)))
  }

  function remove(id: string) {
    setPlaced((prev) => prev.filter((p) => p.id !== id))
    if (selected === id) setSelected(null)
  }

  function copyToAllPages(id: string) {
    const src = placed.find((p) => p.id === id)
    if (!src) return
    const copies: Placed[] = []
    for (let i = 0; i < pageCount; i++) {
      const already = placed.some((p) => p.pageIndex === i && p.ink === src.ink)
      if (!already) copies.push({ ...src, id: crypto.randomUUID(), pageIndex: i })
    }
    setPlaced((prev) => [...prev, ...copies])
  }

  async function run() {
    if (!bytes || !file) return
    setError(null)
    setBusy(true)
    try {
      const data = await stampImages(
        bytes,
        placed.map((p) => ({ pageIndex: p.pageIndex, rect: p.rect, png: p.ink.png })),
      )
      setResult({ name: outputName(file.name, 'signed'), data })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const onPage = placed.filter((p) => p.pageIndex === pageIndex)
  const sel = placed.find((p) => p.id === selected)
  const pagesUsed = new Set(placed.map((p) => p.pageIndex)).size

  return (
    <ToolShell tool={tool}>
      {result ? (
        <ResultCard files={[result]} onReset={reset} />
      ) : !file ? (
        <FileDrop kind="pdf" onFiles={(f) => setFile(f[0])} title="Select a PDF to sign" />
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
        <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PageNav
                index={pageIndex}
                count={pageCount}
                onChange={(i) => {
                  setPageIndex(i)
                  setSelected(null)
                }}
              />
              <p className="text-sm text-slate-500">Drag to move · corners to resize</p>
            </div>
            <PagePreview doc={doc} pageIndex={pageIndex} onSize={setSize}>
              <div className="absolute inset-0" onPointerDown={() => setSelected(null)} />
              {onPage.map((p) => (
                <DraggableBox
                  key={p.id}
                  rect={p.rect}
                  keepAspect
                  minSize={0.02}
                  handles={p.id === selected ? 'corners' : 'none'}
                  onChange={(r) => updateRect(p.id, r)}
                  onActivate={() => setSelected(p.id)}
                  className={p.id === selected ? 'outline-2 outline-emerald-500 outline-dashed' : 'hover:outline-1 hover:outline-slate-400 hover:outline-dashed'}
                  testId="placed-item"
                >
                  <img src={p.ink.url} alt="" draggable={false} className="pointer-events-none h-full w-full" />
                  {p.id === selected && (
                    <button
                      type="button"
                      aria-label="Remove"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => remove(p.id)}
                      className="absolute left-1/2 top-0 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-red-600 text-white shadow"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </DraggableBox>
              ))}
            </PagePreview>
          </div>

          <div className="space-y-4">
            <div className="card space-y-3 p-5">
              <h2 className="text-sm font-semibold text-slate-900">Your signatures</h2>
              {signatures.map((s, i) => (
                <div key={s.url} className="flex items-center gap-3 rounded-xl border border-slate-200 p-2">
                  <img src={s.url} alt={`Signature ${i + 1}`} className="h-10 min-w-0 flex-1 object-contain object-left" />
                  <button
                    type="button"
                    className="btn-secondary shrink-0 px-3"
                    onClick={() => place(s, 160)}
                    data-testid="place-signature"
                  >
                    <Plus className="h-4 w-4" /> Place
                  </button>
                </div>
              ))}
              <button type="button" className="btn-secondary w-full" onClick={() => setMaking(true)} data-testid="new-signature">
                <PenLine className="h-4 w-4" /> {signatures.length ? 'Create another (e.g. initials)' : 'Create signature'}
              </button>
            </div>

            <div className="card space-y-3 p-5">
              <h2 className="text-sm font-semibold text-slate-900">Add text</h2>
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void placeText(text)
                      setText('')
                    }
                  }}
                  placeholder="Name, place, note…"
                  maxLength={120}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
                <button
                  type="button"
                  className="btn-secondary px-3"
                  disabled={!text.trim()}
                  onClick={() => {
                    void placeText(text)
                    setText('')
                  }}
                  aria-label="Add text"
                >
                  <Type className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => void placeText(new Date().toLocaleDateString())}
              >
                <CalendarDays className="h-4 w-4" /> Add today’s date
              </button>
            </div>

            {sel && (
              <div className="card space-y-2 p-5">
                <h2 className="text-sm font-semibold text-slate-900">Selected item</h2>
                {pageCount > 1 && (
                  <button type="button" className="btn-secondary w-full" onClick={() => copyToAllPages(sel.id)}>
                    <Copy className="h-4 w-4" /> Put on every page
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary w-full text-red-600 hover:bg-red-50"
                  onClick={() => remove(sel.id)}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              </div>
            )}

            <button
              className="btn-primary w-full"
              disabled={busy || placed.length === 0}
              onClick={run}
              data-testid="action-button"
            >
              Sign &amp; download
            </button>
            <p className="text-center text-xs text-slate-500">
              {placed.length
                ? `${placed.length} item${placed.length === 1 ? '' : 's'} on ${pagesUsed} page${pagesUsed === 1 ? '' : 's'}`
                : 'Create a signature, then place it on the page.'}
            </p>
            {busy && <p className="animate-pulse text-sm text-slate-500">Signing…</p>}
            {error && <ErrorAlert message={error} />}
          </div>

          {making && (
            <SignatureMaker
              onClose={() => setMaking(false)}
              onDone={(ink) => {
                inks.current.add(ink)
                setSignatures((prev) => [...prev, ink])
                setMaking(false)
                place(ink, 160)
              }}
            />
          )}
        </div>
      ) : null}
    </ToolShell>
  )
}
