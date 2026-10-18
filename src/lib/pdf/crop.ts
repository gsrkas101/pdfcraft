import { loadPdf } from './load'
import { PdfError } from './errors'
import { displayRectToPdfBox, visibleBox, type DisplayRect } from './geometry'

export interface CropOptions {
  /** area to keep, as fractions of each page as displayed */
  rect: DisplayRect
  /** 0-based page indices; omit for all pages */
  pageIndices?: number[]
}

/**
 * Crop pages to a rectangle. The rect is relative, so one selection works across
 * pages of different sizes and rotations. Content outside is hidden, not deleted.
 */
export async function cropPdf(bytes: Uint8Array, opts: CropOptions): Promise<Uint8Array> {
  const { rect } = opts
  if (rect.width < 0.02 || rect.height < 0.02) throw new PdfError('The crop area is too small.')
  const doc = await loadPdf(bytes)
  const pages = doc.getPages()
  const targets = opts.pageIndices ?? pages.map((_, i) => i)

  for (const i of targets) {
    const page = pages[i]
    if (!page) continue
    const b = displayRectToPdfBox(visibleBox(page), page.getRotation().angle, rect)
    // MediaBox too, so printers and older viewers that ignore CropBox agree
    page.setMediaBox(b.x, b.y, b.width, b.height)
    page.setCropBox(b.x, b.y, b.width, b.height)
    page.setBleedBox(b.x, b.y, b.width, b.height)
    page.setTrimBox(b.x, b.y, b.width, b.height)
    page.setArtBox(b.x, b.y, b.width, b.height)
  }
  return doc.save({ useObjectStreams: true })
}
