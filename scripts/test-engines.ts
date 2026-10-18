// Headless correctness tests for src/lib/pdf engines (no DOM needed).
// Usage: tsx scripts/test-engines.ts <fixtures-dir>
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument, degrees } from 'pdf-lib'
import { mergePdfs } from '../src/lib/pdf/merge'
import { chunkEveryN, extractPages, parsePageRanges, removePages, splitPdf } from '../src/lib/pdf/split'
import { rotatePages } from '../src/lib/pdf/rotate'
import { reassemblePdf } from '../src/lib/pdf/organize'
import { addTextWatermark } from '../src/lib/pdf/watermark'
import { addPageNumbers } from '../src/lib/pdf/pageNumbers'
import { imagesToPdf } from '../src/lib/pdf/imagesToPdf'
import { compressLossless } from '../src/lib/pdf/compressLossless'
import { displayRectToPdfBox, displayToPdf, uprightPlacement, visibleBox } from '../src/lib/pdf/geometry'
import { cropPdf } from '../src/lib/pdf/crop'
import { stampImages } from '../src/lib/pdf/stamp'
import { inspectLock, protectPdf, unlockPdf } from '../src/lib/pdf/security'
import { findPageQuad, type Pixels } from '../src/lib/browser/scanDetect'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createRequire } from 'node:module'

// qpdf (WASM) is a dev-only reference implementation for encryption interop checks
interface Qpdf {
  callMain(args: string[]): number
  FS: { writeFile(path: string, data: Uint8Array): void; readFile(path: string): Uint8Array }
}
const require = createRequire(import.meta.url)
const createQpdf = require('@neslinesli93/qpdf-wasm') as (o: { locateFile: () => string }) => Promise<Qpdf>
const QPDF_WASM = require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm')
const loadQpdf = () => createQpdf({ locateFile: () => QPDF_WASM })

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

async function throwsWith(fn: () => Promise<unknown>, needle: string) {
  let msg = ''
  try {
    await fn()
  } catch (e) {
    msg = (e as Error).message
  }
  if (!msg.includes(needle)) throw new Error(`expected an error containing "${needle}", got "${msg}"`)
}

const round = (b: { x: number; y: number; width: number; height: number }) =>
  [b.x, b.y, b.width, b.height].map((n) => Math.round(n))

await check('displayToPdf: display top-left per rotation', () => {
  const box = { x: 0, y: 0, width: 600, height: 800 }
  eq(displayToPdf(box, 0, 0, 0), { x: 0, y: 800 }, 'rot 0')
  eq(displayToPdf(box, 90, 0, 0), { x: 0, y: 0 }, 'rot 90')
  eq(displayToPdf(box, 180, 0, 0), { x: 600, y: 0 }, 'rot 180')
  eq(displayToPdf(box, 270, 0, 0), { x: 600, y: 800 }, 'rot 270')
  eq(displayToPdf(box, -90, 0, 0), { x: 600, y: 800 }, 'rot -90 == 270')
})

await check('displayRectToPdfBox: left half of a 90°-rotated page is the PDF bottom half', () => {
  const box = { x: 10, y: 20, width: 600, height: 800 }
  eq(round(displayRectToPdfBox(box, 90, { left: 0, top: 0, width: 0.5, height: 1 })), [10, 20, 600, 400], 'box')
})

await check('displayToPdf agrees with pdf.js for every rotation and an offset crop box', async () => {
  for (const angle of [0, 90, 180, 270] as const) {
    const doc = await PDFDocument.load(await rotatePages(B, [0], angle === 0 ? 90 : angle))
    const page = doc.getPage(0)
    if (angle === 0) page.setRotation(degrees(0))
    page.setCropBox(50, 80, 400, 600)
    const bytes = await doc.save()
    const js = await pdfjs.getDocument({ data: bytes.slice(), verbosity: 0 }).promise
    try {
      const vp = (await js.getPage(1)).getViewport({ scale: 1 })
      for (const [u, v] of [[0, 0], [1, 0], [0.25, 0.75], [1, 1]]) {
        const [x, y] = vp.convertToPdfPoint(u * vp.width, v * vp.height)
        const ours = displayToPdf(visibleBox(page), page.getRotation().angle, u, v)
        eq([Math.round(ours.x), Math.round(ours.y)], [Math.round(x), Math.round(y)], `rot ${angle} at (${u}, ${v})`)
      }
    } finally {
      await js.destroy()
    }
  }
})

await check('crop all pages to the left half', async () => {
  const out = await cropPdf(A, { rect: { left: 0, top: 0, width: 0.5, height: 1 } })
  const doc = await PDFDocument.load(out)
  const src = await PDFDocument.load(A)
  doc.getPages().forEach((p, i) => {
    const before = src.getPage(i).getSize()
    eq(Math.round(p.getCropBox().width), Math.round(before.width / 2), `page ${i + 1} crop width`)
    eq(Math.round(p.getMediaBox().height), Math.round(before.height), `page ${i + 1} media height`)
  })
})

await check('crop respects page rotation and page selection', async () => {
  const rotated = await rotatePages(A, [1], 90)
  const out = await cropPdf(rotated, { rect: { left: 0, top: 0, width: 0.5, height: 1 }, pageIndices: [1] })
  const doc = await PDFDocument.load(out)
  const src = (await PDFDocument.load(A)).getPage(1).getSize()
  const crop = doc.getPage(1).getCropBox()
  eq([Math.round(crop.width), Math.round(crop.height)], [Math.round(src.width), Math.round(src.height / 2)], 'rotated crop')
  eq(Math.round(doc.getPage(0).getCropBox().width), Math.round(src.width), 'page 1 untouched')
})

await check('crop rejects a tiny area', async () => {
  await throwsWith(() => cropPdf(A, { rect: { left: 0, top: 0, width: 0.001, height: 0.5 } }), 'too small')
})

await check('uprightPlacement turns stamps with the page', async () => {
  const doc = await PDFDocument.load(await rotatePages(B, [0], 90))
  const r = { left: 0.1, top: 0.1, width: 0.2, height: 0.1 }
  eq(Math.round(uprightPlacement(doc.getPage(0), r).rotate.angle), 90, 'rotated page')
  eq(Math.round(uprightPlacement(doc.getPage(1), r).rotate.angle), 0, 'upright page')
})

await check('stamp the same PNG on 3 pages embeds it once', async () => {
  const rect = { left: 0.6, top: 0.8, width: 0.25, height: 0.08 }
  const out = await stampImages(B, [0, 1, 2].map((pageIndex) => ({ pageIndex, rect, png: PNG })))
  eq(await pages(out), 3, 'page count')
  const imageObjects = async (bytes: Uint8Array) =>
    (await PDFDocument.load(bytes)).context
      .enumerateIndirectObjects()
      .filter(([, o]) => o.toString().includes('/Subtype /Image')).length
  const once = await stampImages(B, [{ pageIndex: 0, rect, png: PNG }])
  eq(await imageObjects(out), await imageObjects(once), 'image objects (image + alpha mask, not ×3)')
})

await check('stamp with nothing placed throws', async () => {
  await throwsWith(() => stampImages(B, []), 'Place at least one')
})

// --- password protection, cross-checked against pdf.js (what browsers use) and qpdf (reference encryptor)

async function pdfjsRead(bytes: Uint8Array, password?: string): Promise<{ pages: number; text: string }> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), password, verbosity: 0 }).promise
  try {
    const content = await (await doc.getPage(1)).getTextContent()
    const text = content.items.map((i) => ('str' in i ? i.str : '')).join('')
    return { pages: doc.numPages, text }
  } finally {
    await doc.destroy()
  }
}

/** Encrypt with qpdf. `user` may be '' for a restrictions-only file. */
async function qpdfEncrypt(bytes: Uint8Array, user: string, owner: string, cipher: string[]): Promise<Uint8Array> {
  const q = await loadQpdf()
  q.FS.writeFile('/in.pdf', bytes)
  const weak = cipher.includes('--allow-weak-crypto') ? ['--allow-weak-crypto'] : []
  const opts = cipher.filter((c) => c !== '--allow-weak-crypto')
  const args = [...weak, '--encrypt', `--user-password=${user}`, `--owner-password=${owner}`, ...opts, '--', '/in.pdf', '/out.pdf']
  const code = q.callMain(args)
  if (code !== 0) throw new Error(`qpdf --encrypt exited ${code}`)
  return q.FS.readFile('/out.pdf').slice()
}

const ORIGINAL_TEXT = (await pdfjsRead(A)).text

await check('protect: pdf.js needs the password, then reads every page', async () => {
  const locked = await protectPdf(A, { password: 'pässwörd 1', allowPrint: true, allowCopy: true, allowEdit: true })
  let needsPassword = false
  try {
    await pdfjsRead(locked)
  } catch (e) {
    needsPassword = (e as { name?: string }).name === 'PasswordException'
  }
  if (!needsPassword) throw new Error('pdf.js opened the file without a password')
  const read = await pdfjsRead(locked, 'pässwörd 1')
  eq(read.pages, 5, 'pages')
  eq(read.text, ORIGINAL_TEXT, 'page 1 text')
  eq(await inspectLock(locked), 'password', 'lock state')
})

await check('protect: qpdf decrypts our output with the password', async () => {
  const locked = await protectPdf(B, { password: 'pw', allowPrint: false, allowCopy: false, allowEdit: false })
  const q = await loadQpdf()
  q.FS.writeFile('/in.pdf', locked)
  eq(q.callMain(['--password=pw', '--decrypt', '/in.pdf', '/out.pdf']), 0, 'qpdf exit code')
  eq(await pages(q.FS.readFile('/out.pdf').slice()), 3, 'decrypted pages')
})

await check('protect refuses an already-protected PDF', async () => {
  const locked = await protectPdf(B, { password: 'pw', allowPrint: true, allowCopy: true, allowEdit: true })
  await throwsWith(
    () => protectPdf(locked, { password: 'x', allowPrint: true, allowCopy: true, allowEdit: true }),
    'already password-protected',
  )
})

for (const [label, cipher] of [
  ['AES-256', ['--bits=256']],
  ['AES-128', ['--bits=128', '--use-aes=y']],
  ['RC4-128', ['--bits=128', '--use-aes=n', '--allow-weak-crypto']],
] as const) {
  await check(`unlock a qpdf ${label} file: wrong password refused, right one decrypts`, async () => {
    const locked = await qpdfEncrypt(A, 'open sesame', 'owner-pw', [...cipher])
    eq(await inspectLock(locked), 'password', 'lock state')
    await throwsWith(() => unlockPdf(locked, 'nope'), 'Wrong password')
    const opened = await unlockPdf(locked, 'open sesame')
    eq(await inspectLock(opened), 'none', 'state after unlock')
    eq(await pages(opened), 5, 'pages via pdf-lib')
    eq((await pdfjsRead(opened)).text, ORIGINAL_TEXT, 'page 1 text via pdf.js')
  })
}

await check('unlock a restrictions-only file without a password', async () => {
  const restricted = await qpdfEncrypt(B, '', 'owner-pw', ['--bits=256', '--print=none', '--extract=n'])
  eq(await inspectLock(restricted), 'restrictions-only', 'lock state')
  const opened = await unlockPdf(restricted, '')
  eq(await inspectLock(opened), 'none', 'state after unlock')
  eq(await pages(opened), 3, 'pages')
})

await check('unlock: a plain PDF has nothing to unlock; junk is rejected', async () => {
  eq(await inspectLock(B), 'none', 'plain')
  await throwsWith(() => unlockPdf(B, 'x'), "isn't password-protected")
  await throwsWith(() => inspectLock(new TextEncoder().encode('not a pdf at all')), 'valid PDF')
})

// --- Scan: automatic page-edge detection, on synthetic photos ---

interface P {
  x: number
  y: number
}

/** mulberry32, so the synthetic photos are identical on every run */
function prng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * A W×H photo of `ground(x, y)` with a sheet of paper inside `page` (pixel corners TL, TR, BR, BL,
 * anti-aliased edges) carrying lines of dark "text", plus lighting falloff and sensor noise.
 */
function photo(
  W: number,
  H: number,
  ground: (x: number, y: number) => number,
  page: P[] | null,
  o: { paper?: number; noise?: number; seed?: number } = {},
): Pixels {
  const rand = prng(o.seed ?? 1)
  const ink = new Uint8Array(W * H)
  if (page) {
    const at = (u: number, v: number) => {
      const tx = page[0].x + (page[1].x - page[0].x) * u
      const ty = page[0].y + (page[1].y - page[0].y) * u
      const bx = page[3].x + (page[2].x - page[3].x) * u
      const by = page[3].y + (page[2].y - page[3].y) * u
      return { x: Math.round(tx + (bx - tx) * v), y: Math.round(ty + (by - ty) * v) }
    }
    for (let v = 0.12; v < 0.88; v += 0.045) {
      for (let dv = 0; dv < 0.012; dv += 0.002) {
        for (let u = 0.1; u < 0.9; u += 0.001) {
          if (Math.sin(u * 140 + v * 50) > 0.75) continue // word gaps
          const p = at(u, v + dv)
          if (p.x >= 0 && p.y >= 0 && p.x < W && p.y < H) ink[p.y * W + p.x] = 1
        }
      }
    }
  }
  const data = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let l = ground(x, y)
      if (page) {
        let cover = 1
        for (let i = 0; i < 4; i++) {
          const a = page[i]
          const b = page[(i + 1) % 4]
          const inward = ((x - a.x) * (a.y - b.y) + (y - a.y) * (b.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y)
          cover = Math.min(cover, Math.max(0, Math.min(1, inward + 0.5)))
        }
        l += ((ink[y * W + x] ? 40 : (o.paper ?? 225)) - l) * cover
      }
      l *= 1 - 0.2 * Math.hypot(x / W - 0.3, y / H - 0.3)
      l += (rand() + rand() + rand() - 1.5) * 2 * (o.noise ?? 4)
      const i = (y * W + x) * 4
      data[i] = data[i + 1] = data[i + 2] = l
      data[i + 3] = 255
    }
  }
  return { data, width: W, height: H }
}

function cornersNear(img: Pixels, truth: P[]) {
  const q = findPageQuad(img)
  if (!q) throw new Error('no page found')
  const frac = (v: number, size: number) => Math.min(1, Math.max(0, (v + 0.5) / size))
  let worst = 0
  q.forEach((c, i) => {
    worst = Math.max(worst, Math.abs(c.x - frac(truth[i].x, img.width)), Math.abs(c.y - frac(truth[i].y, img.height)))
  })
  if (worst > 0.02) throw new Error(`a corner is off by ${(worst * 100).toFixed(1)}%: ${JSON.stringify(q)}`)
}

function noPage(img: Pixels) {
  const q = findPageQuad(img)
  if (q) throw new Error(`expected no page, got ${JSON.stringify(q)}`)
}

const rotated = (cx: number, cy: number, w: number, h: number, deg: number): P[] => {
  const r = (deg * Math.PI) / 180
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([dx, dy]) => ({ x: cx + dx * Math.cos(r) - dy * Math.sin(r), y: cy + dx * Math.sin(r) + dy * Math.cos(r) }))
}

await check('scan: finds a skewed page on a dark wooden table', () => {
  const page = [
    { x: 230, y: 120 },
    { x: 940, y: 80 },
    { x: 1030, y: 800 },
    { x: 150, y: 760 },
  ]
  cornersNear(photo(1200, 900, (x, y) => 60 + 10 * Math.sin(x * 0.05 + 3 * Math.sin(y * 0.01)), page), page)
})

await check('scan: finds a rotated page on a mottled gray desk (portrait photo)', () => {
  const page = rotated(450, 610, 560, 760, 17)
  cornersNear(photo(900, 1200, (x, y) => 125 + 15 * Math.sin(x * 0.13) * Math.sin(y * 0.11), page, { noise: 8, seed: 2 }), page)
})

await check('scan: finds a white page on a light-gray desk (low contrast)', () => {
  const page = [
    { x: 300, y: 150 },
    { x: 900, y: 170 },
    { x: 960, y: 820 },
    { x: 240, y: 790 },
  ]
  cornersNear(photo(1200, 900, () => 170, page, { paper: 230, noise: 3, seed: 3 }), page)
})

await check('scan: a page running off the bottom of the photo ends at the frame', () => {
  const page = [
    { x: 250, y: 200 },
    { x: 950, y: 180 },
    { x: 1000, y: 1050 },
    { x: 200, y: 1060 },
  ]
  const atBottom = (a: P, b: P) => ({ x: a.x + ((b.x - a.x) * (899.5 - a.y)) / (b.y - a.y), y: 899.5 })
  cornersNear(photo(1200, 900, () => 50, page, { seed: 4 }), [page[0], page[1], atBottom(page[1], page[2]), atBottom(page[0], page[3])])
})

await check('scan: no page in plain photos → whole photo', () => {
  noPage(photo(1200, 900, () => 128, null, { seed: 5 }))
  noPage(photo(1200, 900, (x, y) => 40 + (180 * (x + y)) / 2100, null, { seed: 6 }))
  noPage(photo(1000, 1000, () => 128, null, { noise: 40, seed: 7 }))
  noPage(photo(1200, 900, (x, y) => (Math.hypot(x - 600, y - 450) < 330 ? 220 : 50), null, { seed: 8 }))
})

await check('scan: a close-up of text with no paper edges → whole photo', () => {
  // the "page" extends past every side of the frame
  noPage(photo(1200, 900, () => 50, [{ x: -200, y: -200 }, { x: 1400, y: -200 }, { x: 1400, y: 1100 }, { x: -200, y: 1100 }], { seed: 9 }))
})

console.log(`\n${pass} passed, ${failures.length} failed`)
if (failures.length > 0) process.exit(1)
