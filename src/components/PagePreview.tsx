import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CancellableRender {
  cancel: () => void
  promise: Promise<unknown>
}

export interface PageSize {
  /** displayed size in points (rotation applied) */
  widthPt: number
  heightPt: number
}

/**
 * One page rendered large, with `children` overlaid in a box of exactly the page's size —
 * overlays position themselves with percentages, so they line up at any zoom.
 */
export function PagePreview({
  doc,
  pageIndex,
  maxWidth = 640,
  children,
  onSize,
  onRendered,
}: {
  doc: PDFDocumentProxy
  pageIndex: number
  maxWidth?: number
  children?: ReactNode
  /** as soon as the page's size is known (before it has painted) */
  onSize?: (size: PageSize) => void
  /** once the page has painted onto the canvas */
  onRendered?: (canvas: HTMLCanvasElement) => void
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [avail, setAvail] = useState(0)
  const [css, setCss] = useState<{ w: number; h: number } | null>(null)
  const onSizeRef = useRef(onSize)
  onSizeRef.current = onSize
  const onRenderedRef = useRef(onRendered)
  onRenderedRef.current = onRendered

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const measure = (w: number) => setAvail(Math.floor(w / 8) * 8)
    measure(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width))
    ro.observe(el)
    return () => {
      ro.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!avail) return
    let cancelled = false
    let task: CancellableRender | null = null
    void (async () => {
      try {
        const page = await doc.getPage(pageIndex + 1)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const maxH = Math.max(320, window.innerHeight * 0.72)
        const scale = Math.min(Math.min(avail, maxWidth) / base.width, maxH / base.height)
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: scale * dpr })
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        setCss({ w: Math.round(base.width * scale), h: Math.round(base.height * scale) })
        onSizeRef.current?.({ widthPt: base.width, heightPt: base.height })
        task = page.render({ canvas, viewport })
        await task.promise
        if (!cancelled) onRenderedRef.current?.(canvas)
      } catch {
        // cancelled by a page switch/resize, or the page failed to render
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageIndex, avail, maxWidth])

  return (
    <div ref={outerRef} className="flex w-full justify-center">
      <div
        className="relative touch-none select-none overflow-hidden rounded border border-slate-200 bg-white shadow-sm"
        style={css ? { width: css.w, height: css.h } : { width: '100%', minHeight: 320 }}
        data-testid="page-preview"
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
        {css && children}
      </div>
    </div>
  )
}

export function PageNav({ index, count, onChange }: { index: number; count: number; onChange: (i: number) => void }) {
  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn-secondary px-2.5"
        disabled={index <= 0}
        onClick={() => onChange(index - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-24 text-center text-sm text-slate-600">
        Page {index + 1} of {count}
      </span>
      <button
        type="button"
        className="btn-secondary px-2.5"
        disabled={index >= count - 1}
        onClick={() => onChange(index + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
