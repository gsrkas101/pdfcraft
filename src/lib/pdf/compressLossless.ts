import { PDFDocument } from 'pdf-lib'
import { loadPdf } from './load'

/**
 * Rebuild the document from scratch (drops unused objects and old metadata)
 * and save with object streams. Text stays selectable; savings are modest.
 */
export async function compressLossless(bytes: Uint8Array): Promise<Uint8Array> {
  const src = await loadPdf(bytes)
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, src.getPageIndices())
  for (const p of pages) out.addPage(p)
  out.setProducer('PDFCraft')
  out.setCreator('PDFCraft')
  return out.save({ useObjectStreams: true })
}
