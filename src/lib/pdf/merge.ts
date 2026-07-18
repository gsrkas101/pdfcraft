import { PDFDocument } from 'pdf-lib'
import { loadPdf, type ProgressFn } from './load'

export async function mergePdfs(files: Uint8Array[], onProgress?: ProgressFn): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  let done = 0
  for (const bytes of files) {
    const src = await loadPdf(bytes)
    const pages = await out.copyPages(src, src.getPageIndices())
    for (const p of pages) out.addPage(p)
    onProgress?.(++done, files.length)
  }
  return out.save({ useObjectStreams: true })
}
