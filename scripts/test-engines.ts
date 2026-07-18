// Headless correctness tests for src/lib/pdf engines (no DOM needed).
// Usage: tsx scripts/test-engines.ts <fixtures-dir>
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { mergePdfs } from '../src/lib/pdf/merge'
import { chunkEveryN, extractPages, parsePageRanges, removePages, splitPdf } from '../src/lib/pdf/split'
import { rotatePages } from '../src/lib/pdf/rotate'
import { reassemblePdf } from '../src/lib/pdf/organize'
import { addTextWatermark } from '../src/lib/pdf/watermark'
import { addPageNumbers } from '../src/lib/pdf/pageNumbers'
import { imagesToPdf } from '../src/lib/pdf/imagesToPdf'
import { compressLossless } from '../src/lib/pdf/compressLossless'

const dir = process.argv[2]
if (!dir) throw new Error('usage: tsx scripts/test-engines.ts <fixtures-dir>')

const A = new Uint8Array(readFileSync(join(dir, 'sample-a.pdf'))) // 5 pages
const B = new Uint8Array(readFileSync(join(dir, 'sample-b.pdf'))) // 3 pages
const JPG = new Uint8Array(readFileSync(join(dir, 'tiny.jpg')))
const PNG = new Uint8Array(readFileSync(join(dir, 'tiny.png')))

let pass = 0
const failures: string[] = []

function eq(actual: unknown, expected: unknown, what: string) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`)
}

async function pages(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount()
}

async function rotations(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes)
  return doc.getPages().map((p) => p.getRotation().angle)
}

async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn()
    pass++
    console.log(`  ok  ${name}`)
  } catch (e) {
    failures.push(`${name}: ${(e as Error).message}`)
    console.error(`FAIL  ${name}: ${(e as Error).message}`)
  }
}

await check('merge 5+3 pages = 8', async () => {
  eq(await pages(await mergePdfs([A, B])), 8, 'merged page count')
})

await check('parsePageRanges "1-3, 7" on 10 pages', () => {
  eq(parsePageRanges('1-3, 7', 10), [[0, 1, 2], [6]], 'ranges')
})

await check('parsePageRanges rejects invalid specs', () => {
  for (const bad of ['', '0', '4-2', 'x', '11', '1-99']) {
    let threw = false
    try {
      parsePageRanges(bad, 10)
    } catch {
      threw = true
    }
    if (!threw) throw new Error(`accepted invalid spec "${bad}"`)
  }
})

await check('splitPdf "1-2, 3-5" → files of 2 and 3 pages', async () => {
  const outs = await splitPdf(A, parsePageRanges('1-2, 3-5', 5))
  eq(outs.length, 2, 'file count')
  eq(await pages(outs[0]), 2, 'part 1 pages')
  eq(await pages(outs[1]), 3, 'part 2 pages')
})

await check('chunkEveryN(5, 2) → [2,2,1]', () => {
  eq(chunkEveryN(5, 2).map((g) => g.length), [2, 2, 1], 'chunks')
})

await check('extractPages [2,4] → 2 pages', async () => {
  eq(await pages(await extractPages(A, [1, 3])), 2, 'extracted pages')
})

await check('removePages [1,5] from 5 → 3 pages', async () => {
  eq(await pages(await removePages(A, [0, 4])), 3, 'remaining pages')
})

await check('removePages of everything throws', async () => {
  let threw = false
  try {
    await removePages(B, [0, 1, 2])
  } catch {
    threw = true
  }
  if (!threw) throw new Error('accepted removing every page')
})

await check('rotate all pages by 90', async () => {
  eq(await rotations(await rotatePages(A, 'all', 90)), [90, 90, 90, 90, 90], 'rotations')
})

await check('rotate page 1 by 270 twice wraps to 180', async () => {
  const once = await rotatePages(A, [0], 270)
  const twice = await rotatePages(once, [0], 270)
  eq((await rotations(twice))[0], 180, 'first page rotation')
})

await check('reassemble: reorder + rotate + drop pages', async () => {
  const out = await reassemblePdf(A, [
    { srcIndex: 4, rotationDelta: 90 },
    { srcIndex: 0, rotationDelta: 0 },
  ])
  eq(await pages(out), 2, 'page count')
  eq((await rotations(out))[0], 90, 'first page rotation')
})

await check('text watermark keeps page count', async () => {
  const out = await addTextWatermark(A, {
    text: 'DRAFT',
    fontSize: 48,
    color: { r: 0.5, g: 0.5, b: 0.5 },
    opacity: 0.3,
    rotation: 45,
    position: 'center',
  })
  eq(await pages(out), 5, 'page count')
})

await check('tiled watermark keeps page count', async () => {
  const out = await addTextWatermark(B, {
    text: 'PDFCraft',
    fontSize: 36,
    color: { r: 0.86, g: 0.15, b: 0.15 },
    opacity: 0.2,
    rotation: 0,
    position: 'tiled',
  })
  eq(await pages(out), 3, 'page count')
})

await check('watermark rejects non-Latin text with friendly error', async () => {
  let msg = ''
  try {
    await addTextWatermark(B, {
      text: 'नमस्ते',
      fontSize: 48,
      color: { r: 0.5, g: 0.5, b: 0.5 },
      opacity: 0.3,
      rotation: 0,
      position: 'center',
    })
  } catch (e) {
    msg = (e as Error).message
  }
  if (!msg.includes('English/Latin')) throw new Error(`unexpected message: "${msg}"`)
})

await check('page numbers on range 2-4 keep page count', async () => {
  const out = await addPageNumbers(A, {
    position: 'bottom-center',
    format: 'page-n-of-total',
    startAt: 1,
    fontSize: 12,
    gray: 0.4,
    pageIndices: [1, 2, 3],
  })
  eq(await pages(out), 5, 'page count')
})

await check('imagesToPdf jpg+png → 2 A4 pages', async () => {
  const out = await imagesToPdf(
    [
      { bytes: JPG, kind: 'jpg' },
      { bytes: PNG, kind: 'png' },
    ],
    { pageSize: 'a4', orientation: 'portrait', margin: 24 },
  )
  eq(await pages(out), 2, 'page count')
  const doc = await PDFDocument.load(out)
  const { width, height } = doc.getPage(0).getSize()
  eq([Math.round(width), Math.round(height)], [595, 842], 'A4 size in points')
})

await check('lossless compress keeps pages and stays valid', async () => {
  const out = await compressLossless(A)
  eq(await pages(out), 5, 'page count')
})

console.log(`\n${pass} passed, ${failures.length} failed`)
if (failures.length > 0) process.exit(1)
