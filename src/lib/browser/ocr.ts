import { createWorker, OEM, type Worker } from 'tesseract.js'
import { openPdfJs } from './pdfjs'
import { renderPageToCanvas } from './render'
import { loadPdf } from '../pdf/load'
import { PdfError } from '../pdf/errors'
import { uprightPlacement } from '../pdf/geometry'

export type OcrLang = 'eng' | 'hin' | 'eng+hin'

export interface OcrProgress {
  /** 1-based page being worked on */
  page: number
  total: number
  /** 0..1 within the current step */
  progress: number
  status: string
}

export interface OcrResult {
  pdf: Uint8Array
  text: string
  ocrPages: number
  skippedPages: number
}

/** Pages are rendered at this resolution for recognition (capped for very large pages). */
const DPI = 300
const MAX_SIDE = 4200

const STATUS: Record<string, string> = {
  'loading tesseract core': 'Loading OCR engine',
  'initializing tesseract': 'Starting OCR engine',
  'loading language traineddata': 'Loading language data',
  'loading language traineddata (from cache)': 'Loading language data',
  'initializing api': 'Starting OCR engine',
  'recognizing text': 'Reading text',
}

// Everything comes from this site (see scripts/copy-ocr-assets.mjs) — no third-party CDN.
const asset = (path: string) => new URL(`${import.meta.env.BASE_URL}ocr/${path}`, window.location.href).href

async function startWorker(lang: OcrLang, onStatus: (status: string, progress: number) => void): Promise<Worker> {
  try {
    return await createWorker(lang.split('+'), OEM.LSTM_ONLY, {
      workerPath: asset('worker.min.js'),
      corePath: asset('core'),
      langPath: asset('lang'),
      logger: (m) => onStatus(STATUS[m.status] ?? 'Working', m.progress),
    })
  } catch {
    throw new PdfError('Could not start the OCR engine. Check your connection for the first use, then try again.')
  }
}

/**
 * Make a PDF searchable: render each page, recognise it with Tesseract, and lay an invisible
 * text layer over the original page. The page itself is left untouched.
 */
export async function ocrPdf(
  bytes: Uint8Array,
  opts: { lang: OcrLang; skipTextPages: boolean; onProgress?: (p: OcrProgress) => void },
): Promise<OcrResult> {
  const src = await openPdfJs(bytes)
  const out = await loadPdf(bytes)
  const total = src.numPages
  let current = 1
  const report = (status: string, progress: number) =>
    opts.onProgress?.({ page: current, total, progress, status })

  report('Loading OCR engine', 0)
  const worker = await startWorker(opts.lang, report)
  let text = ''
  let ocrPages = 0
  let skippedPages = 0
  try {
    for (let i = 1; i <= total; i++) {
      current = i
      const page = await src.getPage(i)
      if (opts.skipTextPages) {
        const content = await page.getTextContent()
        const chars = content.items.reduce((n, it) => n + ('str' in it ? it.str.trim().length : 0), 0)
        if (chars > 20) {
          skippedPages++
          report('Already has text — skipped', 1)
          continue
        }
      }
      report('Rendering page', 0)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(DPI / 72, MAX_SIDE / Math.max(base.width, base.height))
      const canvas = await renderPageToCanvas(page, scale)
      await worker.setParameters({ user_defined_dpi: String(Math.round(scale * 72)) })
      const { data } = await worker.recognize(canvas, { pdfTitle: 'OCR', pdfTextOnly: true }, { text: true, pdf: true })
      canvas.width = canvas.height = 0 // free the bitmap now, not at GC time
      if (!data.pdf) throw new PdfError('OCR produced no output for this page.')

      // Tesseract's text-only page has the rendered (upright) orientation; stretch it over the
      // visible page and turn it with the page's own rotation, like a signature stamp.
      const [layer] = await out.embedPdf(new Uint8Array(data.pdf), [0])
      const target = out.getPage(i - 1)
      target.drawPage(layer, uprightPlacement(target, { left: 0, top: 0, width: 1, height: 1 }))
      text += `${total > 1 ? `--- Page ${i} ---\n` : ''}${data.text.trim()}\n\n`
      ocrPages++
      report('Done', 1)
    }
  } finally {
    await worker.terminate()
    void src.destroy()
  }
  if (ocrPages === 0) {
    throw new PdfError('Every page already has selectable text — there is nothing to OCR. Untick “Skip pages that already have text” to OCR anyway.')
  }
  return { pdf: await out.save({ useObjectStreams: true }), text: text.trim() + '\n', ocrPages, skippedPages }
}
