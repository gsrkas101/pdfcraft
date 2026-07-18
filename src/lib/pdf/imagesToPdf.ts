import { PDFDocument, PageSizes } from 'pdf-lib'
import type { ProgressFn } from './load'
import { PdfError } from './errors'

export interface ImageInput {
  bytes: Uint8Array
  kind: 'jpg' | 'png'
}

export interface ImagesToPdfOptions {
  pageSize: 'a4' | 'letter' | 'fit'
  orientation: 'auto' | 'portrait' | 'landscape'
  /** page margin in points */
  margin: number
}

export async function imagesToPdf(
  images: ImageInput[],
  opts: ImagesToPdfOptions,
  onProgress?: ProgressFn,
): Promise<Uint8Array> {
  if (images.length === 0) throw new PdfError('Add at least one image.')
  const doc = await PDFDocument.create()
  let done = 0
  for (const im of images) {
    const img = im.kind === 'jpg' ? await doc.embedJpg(im.bytes) : await doc.embedPng(im.bytes)
    if (opts.pageSize === 'fit') {
      // Treat image pixels as 96 dpi → points (×0.75)
      const w = img.width * 0.75
      const h = img.height * 0.75
      const page = doc.addPage([w + opts.margin * 2, h + opts.margin * 2])
      page.drawImage(img, { x: opts.margin, y: opts.margin, width: w, height: h })
    } else {
      let [pw, ph] = opts.pageSize === 'a4' ? PageSizes.A4 : PageSizes.Letter
      const landscape =
        opts.orientation === 'landscape' || (opts.orientation === 'auto' && img.width > img.height)
      if (landscape) [pw, ph] = [ph, pw]
      const page = doc.addPage([pw, ph])
      const availW = pw - opts.margin * 2
      const availH = ph - opts.margin * 2
      const scale = Math.min(availW / img.width, availH / img.height)
      const w = img.width * scale
      const h = img.height * scale
      page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
    }
    onProgress?.(++done, images.length)
  }
  return doc.save({ useObjectStreams: true })
}
