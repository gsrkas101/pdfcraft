import { PDFDocument } from 'pdf-lib'
import { loadPdf, type ProgressFn } from './load'
import { PdfError } from './errors'

/** Parse "1-3, 7, 9-12" into 0-based page index groups, validated against pageCount. */
export function parsePageRanges(spec: string, pageCount: number): number[][] {
  const tokens = spec
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
  if (tokens.length === 0) throw new PdfError('Enter at least one page or range, e.g. "1-3, 7".')
  return tokens.map((tok) => {
    const m = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(tok)
    if (!m) throw new PdfError(`"${tok}" is not a valid page or range. Use forms like "7" or "2-5".`)
    const a = parseInt(m[1], 10)
    const b = m[2] ? parseInt(m[2], 10) : a
    if (a < 1 || b > pageCount) throw new PdfError(`"${tok}" is outside this document (pages 1-${pageCount}).`)
    if (b < a) throw new PdfError(`"${tok}" is backwards — ranges should go from low to high.`)
    const pages: number[] = []
    for (let p = a; p <= b; p++) pages.push(p - 1)
    return pages
  })
}

/** Chunk all pages into groups of n (last group may be smaller). */
export function chunkEveryN(pageCount: number, n: number): number[][] {
  if (!Number.isInteger(n) || n < 1) throw new PdfError('Pages per file must be a whole number of 1 or more.')
  const groups: number[][] = []
  for (let start = 0; start < pageCount; start += n) {
    const g: number[] = []
    for (let p = start; p < Math.min(start + n, pageCount); p++) g.push(p)
    groups.push(g)
  }
  return groups
}

async function copyToNewPdf(src: PDFDocument, indices: number[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, indices)
  for (const p of pages) out.addPage(p)
  return out.save({ useObjectStreams: true })
}

export async function splitPdf(bytes: Uint8Array, ranges: number[][], onProgress?: ProgressFn): Promise<Uint8Array[]> {
  const src = await loadPdf(bytes)
  const outs: Uint8Array[] = []
  for (let i = 0; i < ranges.length; i++) {
    outs.push(await copyToNewPdf(src, ranges[i]))
    onProgress?.(i + 1, ranges.length)
  }
  return outs
}

export async function extractPages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  if (indices.length === 0) throw new PdfError('Select at least one page.')
  const src = await loadPdf(bytes)
  return copyToNewPdf(src, [...indices].sort((a, b) => a - b))
}

export async function removePages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  if (indices.length === 0) throw new PdfError('Select at least one page to remove.')
  const src = await loadPdf(bytes)
  const drop = new Set(indices)
  const keep = src.getPageIndices().filter((i) => !drop.has(i))
  if (keep.length === 0) throw new PdfError('You selected every page — nothing would be left in the PDF.')
  return copyToNewPdf(src, keep)
}
