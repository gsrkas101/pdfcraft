import { StandardFonts, rgb } from 'pdf-lib'
import { loadPdf } from './load'

export type NumberPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type NumberFormat = 'n' | 'page-n' | 'n-of-total' | 'page-n-of-total'

export interface PageNumberOptions {
  position: NumberPosition
  format: NumberFormat
  /** number printed on the first numbered page */
  startAt: number
  fontSize: number
  /** 0 = black … 1 = white */
  gray: number
  /** 0-based page indices; omit for all pages */
  pageIndices?: number[]
}

function label(format: NumberFormat, n: number, total: number): string {
  switch (format) {
    case 'n':
      return String(n)
    case 'page-n':
      return `Page ${n}`
    case 'n-of-total':
      return `${n} of ${total}`
    case 'page-n-of-total':
      return `Page ${n} of ${total}`
  }
}

const MARGIN = 28

export async function addPageNumbers(bytes: Uint8Array, opts: PageNumberOptions): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const color = rgb(opts.gray, opts.gray, opts.gray)
  const pages = doc.getPages()
  const targets = (opts.pageIndices ?? pages.map((_, i) => i)).slice().sort((a, b) => a - b)
  const total = doc.getPageCount()

  targets.forEach((pageIndex, k) => {
    const page = pages[pageIndex]
    if (!page) return
    const text = label(opts.format, opts.startAt + k, total)
    const textWidth = font.widthOfTextAtSize(text, opts.fontSize)
    const { width, height } = page.getSize()
    const [v, h] = opts.position.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right']
    const x = h === 'left' ? MARGIN : h === 'center' ? (width - textWidth) / 2 : width - MARGIN - textWidth
    const y = v === 'bottom' ? MARGIN : height - MARGIN - opts.fontSize
    page.drawText(text, { x, y, size: opts.fontSize, font, color })
  })
  return doc.save({ useObjectStreams: true })
}
