import { useEffect, useRef, useState } from 'react'
import { Maximize, ScanSearch } from 'lucide-react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { FileDrop } from '../components/FileDrop'
import { PageNav, PagePreview, type PageSize } from '../components/PagePreview'
import { DraggableBox } from '../components/DraggableBox'
import { Field, Segmented } from '../components/controls'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard } from '../components/ResultCard'
import { usePdfDoc } from '../components/usePdfDoc'
import { cropPdf } from '../lib/pdf/crop'
import type { DisplayRect } from '../lib/pdf/geometry'
import { friendlyError } from '../lib/pdf/errors'
import { outputName } from '../lib/format'

const DEFAULT_RECT: DisplayRect = { left: 0.1, top: 0.1, width: 0.8, height: 0.8 }
const FULL_RECT: DisplayRect = { left: 0, top: 0, width: 1, height: 1 }

/** Bounding box of non-white pixels, as page fractions — null for a blank page. */
function contentBounds(canvas: HTMLCanvasElement): DisplayRect | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const { width: w, height: h } = canvas
  const px = ctx.getImageData(0, 0, w, h).data
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (px[i + 3] > 16 && (px[i] < 235 || px[i + 1] < 235 || px[i + 2] < 235)) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const pad = 0.015
  const left = Math.max(0, minX / w - pad)
  const top = Math.max(0, minY / h - pad)
  const right = Math.min(1, (maxX + 1) / w + pad)
  const bottom = Math.min(1, (maxY + 1) / h + pad)
  return { left, top, width: right - left, height: bottom - top }
}

const mm = (pt: number) => Math.round((pt * 25.4) / 72)

export default function CropTool() {
  const tool = getTool('crop')
  const [file, setFile] = useState<File | null>(null)
  const { doc, bytes, error: loadError, loading } = usePdfDoc(file)
  const pageCount = doc?.numPages ?? 0

  const [pageIndex, setPageIndex] = useState(0)
  const [rect, setRect] = useState<DisplayRect>(DEFAULT_RECT)
  const [scope, setScope] = useState<'all' | 'current'>('all')
  const [size, setSize] = useState<PageSize | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; data: Uint8Array } | null>(null)

  useEffect(() => {
    setPageIndex(0)
    setRect(DEFAULT_RECT)
    setSize(null)
  }, [doc])

  function reset() {
    setFile(null)
    setResult(null)
    setError(null)
  }

  function autoDetect() {
    setError(null)
    if (!canvasRef.current) {
      setError('The page is still loading — try again in a moment.')
      return
    }
    const found = contentBounds(canvasRef.current)
    if (found) setRect(found)
    else setError('This page looks blank — nothing to detect.')
  }

  async function run() {
    if (!bytes || !file) return
    setError(null)
    setBusy(true)
    try {
      const data = await cropPdf(bytes, { rect, pageIndices: scope === 'current' ? [pageIndex] : undefined })
      setResult({ name: outputName(file.name, 'cropped'), data })
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
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PageNav index={pageIndex} count={pageCount} onChange={setPageIndex} />
              <p className="text-sm text-slate-500">Drag the box or its handles to choose what to keep.</p>
            </div>
            <PagePreview
              doc={doc}
              pageIndex={pageIndex}
              onSize={(s) => {
                canvasRef.current = null
                setSize(s)
              }}
              onRendered={(canvas) => {
                canvasRef.current = canvas
              }}
            >
              <DraggableBox
                rect={rect}
                onChange={setRect}
                testId="crop-box"
                className="border-2 border-emerald-500"
                style={{ boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45)' }}
              />
            </PagePreview>
          </div>

          <div className="card h-fit space-y-5">
            <Field label="Apply to">
              <Segmented
                options={[
                  { value: 'all', label: 'All pages' },
                  { value: 'current', label: `Page ${pageIndex + 1} only` },
                ]}
                value={scope}
                onChange={setScope}
              />
            </Field>
            {size && (
              <p className="text-sm text-slate-600">
                Keeping{' '}
                <span className="font-semibold text-slate-900">
                  {mm(rect.width * size.widthPt)} × {mm(rect.height * size.heightPt)} mm
                </span>{' '}
                of {mm(size.widthPt)} × {mm(size.heightPt)} mm
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={autoDetect} data-testid="auto-detect">
                <ScanSearch className="h-4 w-4" /> Trim white margins
              </button>
              <button type="button" className="btn-secondary" onClick={() => setRect(FULL_RECT)}>
                <Maximize className="h-4 w-4" /> Whole page
              </button>
            </div>
            {scope === 'all' && pageCount > 1 && (
              <p className="text-xs text-slate-500">
                The same area (relative to page size) is cropped on every page.
              </p>
            )}
            <button className="btn-primary w-full" disabled={busy} onClick={run} data-testid="action-button">
              Crop PDF
            </button>
            {busy && <p className="animate-pulse text-sm text-slate-500">Cropping…</p>}
            {error && <ErrorAlert message={error} />}
          </div>
        </div>
      ) : null}
    </ToolShell>
  )
}
