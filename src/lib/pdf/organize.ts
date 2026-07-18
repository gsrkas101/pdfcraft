import { PDFDocument, degrees } from 'pdf-lib'
import { loadPdf } from './load'
import { PdfError } from './errors'

export interface PageOp {
  /** 0-based index of the page in the source document */
  srcIndex: number
  /** extra rotation to apply on top of the page's existing rotation: 0 | 90 | 180 | 270 */
  rotationDelta: number
}

/** Rebuild the PDF with the given page order/rotations. Pages not listed are dropped. */
export async function reassemblePdf(bytes: Uint8Array, ops: PageOp[]): Promise<Uint8Array> {
  if (ops.length === 0) throw new PdfError('You removed every page — nothing would be left in the PDF.')
  const src = await loadPdf(bytes)
  const out = await PDFDocument.create()
  const copied = await out.copyPages(
    src,
    ops.map((o) => o.srcIndex),
  )
  copied.forEach((page, i) => {
    const delta = ops[i].rotationDelta
    if (delta) {
      const next = (((page.getRotation().angle + delta) % 360) + 360) % 360
      page.setRotation(degrees(next))
    }
    out.addPage(page)
  })
  return out.save({ useObjectStreams: true })
}
