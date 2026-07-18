import { useEffect, useRef } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

interface CancellableRender {
  cancel: () => void
  promise: Promise<unknown>
}

/** Renders one PDF page as a thumbnail canvas. */
export function ThumbCanvas({
  doc,
  pageIndex,
  width = 150,
}: {
  doc: PDFDocumentProxy
  pageIndex: number
  width?: number
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    let task: CancellableRender | null = null
    void (async () => {
      try {
        const page = await doc.getPage(pageIndex + 1)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const scale = (width * 1.5) / base.width // 1.5× for crisp thumbnails
        const viewport = page.getViewport({ scale })
        const canvas = ref.current
        if (!canvas) return
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        task = page.render({ canvas, viewport })
        await task.promise
      } catch {
        // render cancelled (page switch/unmount) or failed — leave the canvas blank
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageIndex, width])

  return <canvas ref={ref} className="h-auto w-full rounded border border-slate-200 bg-white shadow-sm" />
}
