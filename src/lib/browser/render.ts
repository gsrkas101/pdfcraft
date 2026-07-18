import { PDFDocument } from 'pdf-lib'
import type { PDFPageProxy } from 'pdfjs-dist'
import { openPdfJs } from './pdfjs'
import type { ProgressFn } from '../pdf/load'

async function renderPageToBlob(
  page: PDFPageProxy,
  scale: number,
  type: 'image/jpeg' | 'image/png',
  quality?: number,
): Promise<{ blob: Blob; widthPt: number; heightPt: number }> {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a canvas — try a different browser.')
  // white background so transparent regions don't turn black in JPEG
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvas, canvasContext: ctx, viewport }).promise
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the page image.'))), type, quality),
  )
  const base = page.getViewport({ scale: 1 })
  return { blob, widthPt: base.width, heightPt: base.height }
}

export interface RenderedPage {
  name: string
  data: Uint8Array
}

export async function pdfToImages(
  bytes: Uint8Array,
  opts: { format: 'jpg' | 'png'; dpi: number; baseName: string; onProgress?: ProgressFn },
): Promise<RenderedPage[]> {
  const doc = await openPdfJs(bytes)
  try {
    const type = opts.format === 'jpg' ? 'image/jpeg' : 'image/png'
    const out: RenderedPage[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const { blob } = await renderPageToBlob(page, opts.dpi / 72, type, 0.92)
      out.push({ name: `${opts.baseName}-page-${i}.${opts.format}`, data: new Uint8Array(await blob.arrayBuffer()) })
      opts.onProgress?.(i, doc.numPages)
    }
    return out
  } finally {
    void doc.destroy()
  }
}

/**
 * Strong compression: re-render every page as a JPEG at the given dpi/quality
 * and rebuild the PDF. Big savings on scanned/image PDFs; text becomes an image.
 */
export async function rasterCompress(
  bytes: Uint8Array,
  opts: { dpi: number; quality: number; onProgress?: ProgressFn },
): Promise<Uint8Array> {
  const src = await openPdfJs(bytes)
  try {
    const out = await PDFDocument.create()
    for (let i = 1; i <= src.numPages; i++) {
      const page = await src.getPage(i)
      const { blob, widthPt, heightPt } = await renderPageToBlob(page, opts.dpi / 72, 'image/jpeg', opts.quality)
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
      const p = out.addPage([widthPt, heightPt])
      p.drawImage(img, { x: 0, y: 0, width: widthPt, height: heightPt })
      opts.onProgress?.(i, src.numPages)
    }
    out.setProducer('PDFCraft')
    out.setCreator('PDFCraft')
    return await out.save({ useObjectStreams: true })
  } finally {
    void src.destroy()
  }
}
