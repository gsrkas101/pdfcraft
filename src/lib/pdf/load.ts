import { PDFDocument } from 'pdf-lib'
import { EncryptedPdfError, InvalidPdfError } from './errors'

export async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/encrypted/i.test(msg)) throw new EncryptedPdfError()
    throw new InvalidPdfError()
  }
}

export type ProgressFn = (done: number, total: number) => void
