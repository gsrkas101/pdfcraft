import type { PDFDocumentProxy } from 'pdfjs-dist'

type PdfJsModule = typeof import('pdfjs-dist')

let modPromise: Promise<PdfJsModule> | null = null

/** Lazy-load pdf.js (and its worker) only when a tool actually needs rendering. */
function pdfjs(): Promise<PdfJsModule> {
  modPromise ??= (async () => {
    const [m, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    m.GlobalWorkerOptions.workerSrc = worker.default
    return m
  })()
  return modPromise
}

export async function openPdfJs(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const m = await pdfjs()
  // pdf.js transfers the buffer to its worker (detaching it) — hand it a copy
  return m.getDocument({ data: bytes.slice() }).promise
}
