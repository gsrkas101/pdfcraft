import type { PDFImage } from 'pdf-lib'
import { loadPdf } from './load'
import { PdfError } from './errors'
import { uprightPlacement, type DisplayRect } from './geometry'

export interface Stamp {
  /** 0-based page index */
  pageIndex: number
  /** where it goes, as fractions of the page as displayed */
  rect: DisplayRect
  /** PNG bytes; reuse the same array for repeated stamps and it is embedded once */
  png: Uint8Array
}

/** Draw PNG stamps (signatures, initials, text) onto pages, upright however the page is rotated. */
export async function stampImages(bytes: Uint8Array, stamps: Stamp[]): Promise<Uint8Array> {
  if (stamps.length === 0) throw new PdfError('Place at least one signature or text on the document.')
  const doc = await loadPdf(bytes)
  const pages = doc.getPages()
  const embedded = new Map<Uint8Array, PDFImage>()
  for (const s of stamps) {
    const page = pages[s.pageIndex]
    if (!page) continue
    let img = embedded.get(s.png)
    if (!img) {
      img = await doc.embedPng(s.png)
      embedded.set(s.png, img)
    }
    page.drawImage(img, uprightPlacement(page, s.rect))
  }
  return doc.save({ useObjectStreams: true })
}
