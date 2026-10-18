// Phone-photo → clean page: perspective correction and paper-whitening filters, all on canvas.

export interface Pt {
  x: number
  y: number
}

/** Corners as fractions of the image, clockwise from top-left. */
export type Quad = [Pt, Pt, Pt, Pt]

export type ScanFilter = 'original' | 'enhance' | 'gray' | 'bw'

export const FULL_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

/** Longest side of a processed page, in pixels (~200 dpi on A4). */
const MAX_OUT = 2400
/** Photos are scaled to this before sampling. */
const MAX_SRC = 3200

export async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    throw new Error(`Could not read "${file.name}" — is it a valid image?`)
  }
}

/** Solve the 8×8 system for the homography taking each `from` point to its `to` point. */
function homography(from: Pt[], to: Pt[]): number[] {
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = from[i]
    const { x, y } = to[i]
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x])
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y, y])
  }
  for (let c = 0; c < 8; c++) {
    let pivot = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[pivot][c])) pivot = r
    ;[A[c], A[pivot]] = [A[pivot], A[c]]
    const p = A[c][c] || 1e-12
    for (let k = c; k < 9; k++) A[c][k] /= p
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = A[r][c]
      if (f) for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k]
    }
  }
  return [...A.map((row) => row[8]), 1]
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)

/** Straighten the quad into a rectangle (bilinear sampling). */
function warp(src: ImageData, quad: Pt[]): ImageData {
  const [tl, tr, br, bl] = quad
  let w = Math.max(dist(tl, tr), dist(bl, br))
  let h = Math.max(dist(tl, bl), dist(tr, br))
  const s = Math.min(1, MAX_OUT / Math.max(w, h))
  w = Math.max(1, Math.round(w * s))
  h = Math.max(1, Math.round(h * s))
  // map output pixel (u, v) → source pixel (x, y)
  const H = homography(
    [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ],
    quad,
  )
  const out = new ImageData(w, h)
  const o = out.data
  const d = src.data
  const sw = src.width
  const sh = src.height
  for (let v = 0; v < h; v++) {
    for (let u = 0; u < w; u++) {
      const den = H[6] * u + H[7] * v + 1
      let x = (H[0] * u + H[1] * v + H[2]) / den
      let y = (H[3] * u + H[4] * v + H[5]) / den
      x = Math.min(sw - 1.001, Math.max(0, x))
      y = Math.min(sh - 1.001, Math.max(0, y))
      const x0 = x | 0
      const y0 = y | 0
      const fx = x - x0
      const fy = y - y0
      const i00 = (y0 * sw + x0) * 4
      const i10 = i00 + 4
      const i01 = i00 + sw * 4
      const i11 = i01 + 4
      const oi = (v * w + u) * 4
      for (let c = 0; c < 3; c++) {
        const top = d[i00 + c] + (d[i10 + c] - d[i00 + c]) * fx
        const bot = d[i01 + c] + (d[i11 + c] - d[i01 + c]) * fx
        o[oi + c] = top + (bot - top) * fy
      }
      o[oi + 3] = 255
    }
  }
  return out
}

/**
 * Estimate the paper brightness at every pixel: the brightest value in coarse cells,
 * smoothed and interpolated. Dividing by it removes shadows and uneven lighting.
 */
function paperLevel(img: ImageData): Float32Array {
  const { width: w, height: h, data: d } = img
  const cell = Math.max(16, Math.round(Math.max(w, h) / 48))
  const gw = Math.ceil(w / cell)
  const gh = Math.ceil(h / cell)
  const grid = new Float32Array(gw * gh)
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const g = ((y / cell) | 0) * gw + ((x / cell) | 0)
      if (l > grid[g]) grid[g] = l
    }
  }
  // 3×3 smoothing evens out cells that are all ink (e.g. a photo or a big heading)
  const smooth = new Float32Array(gw * gh)
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let sum = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const yy = gy + dy
          const xx = gx + dx
          if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) {
            // max-biased: one dark cell shouldn't drag the paper level down
            sum += Math.max(grid[yy * gw + xx], grid[gy * gw + gx] * 0.9)
            n++
          }
        }
      }
      smooth[gy * gw + gx] = Math.max(40, sum / n)
    }
  }
  const level = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const gyf = Math.min(gh - 1, Math.max(0, y / cell - 0.5))
    const gy0 = gyf | 0
    const gy1 = Math.min(gh - 1, gy0 + 1)
    const fy = gyf - gy0
    for (let x = 0; x < w; x++) {
      const gxf = Math.min(gw - 1, Math.max(0, x / cell - 0.5))
      const gx0 = gxf | 0
      const gx1 = Math.min(gw - 1, gx0 + 1)
      const fx = gxf - gx0
      const a = smooth[gy0 * gw + gx0] + (smooth[gy0 * gw + gx1] - smooth[gy0 * gw + gx0]) * fx
      const b = smooth[gy1 * gw + gx0] + (smooth[gy1 * gw + gx1] - smooth[gy1 * gw + gx0]) * fx
      level[y * w + x] = a + (b - a) * fy
    }
  }
  return level
}

function applyFilter(img: ImageData, filter: ScanFilter): void {
  if (filter === 'original') return
  const d = img.data
  if (filter === 'gray') {
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = d[i + 1] = d[i + 2] = l
    }
    return
  }
  const level = paperLevel(img)
  for (let p = 0, i = 0; i < d.length; p++, i += 4) {
    const k = 255 / level[p]
    if (filter === 'enhance') {
      // whiten the paper, keep colours, add a little contrast
      for (let c = 0; c < 3; c++) {
        const v = d[i + c] * k
        d[i + c] = v >= 245 ? 255 : Math.max(0, (v - 20) * 1.09)
      }
    } else {
      const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * k
      // steep curve: paper → white, ink → black, anti-aliased edges kept
      const v = Math.min(255, Math.max(0, ((l - 150) * 255) / 75))
      d[i] = d[i + 1] = d[i + 2] = v
    }
  }
}

export interface ScanEdit {
  quad: Quad
  /** clockwise quarter turns */
  turns: 0 | 1 | 2 | 3
  filter: ScanFilter
}

/** Crop, straighten, rotate and filter one photo into a JPEG page. */
export async function processScan(bitmap: ImageBitmap, edit: ScanEdit): Promise<{ jpg: Uint8Array; url: string }> {
  const s = Math.min(1, MAX_SRC / Math.max(bitmap.width, bitmap.height))
  const src = document.createElement('canvas')
  src.width = Math.round(bitmap.width * s)
  src.height = Math.round(bitmap.height * s)
  const sctx = src.getContext('2d', { willReadFrequently: true })!
  sctx.drawImage(bitmap, 0, 0, src.width, src.height)
  const quad = edit.quad.map((p) => ({ x: p.x * src.width, y: p.y * src.height }))
  const img = warp(sctx.getImageData(0, 0, src.width, src.height), quad)
  src.width = src.height = 0
  applyFilter(img, edit.filter)

  const flat = document.createElement('canvas')
  flat.width = img.width
  flat.height = img.height
  flat.getContext('2d')!.putImageData(img, 0, 0)
  const out = document.createElement('canvas')
  const sideways = edit.turns % 2 === 1
  out.width = sideways ? img.height : img.width
  out.height = sideways ? img.width : img.height
  const octx = out.getContext('2d')!
  octx.translate(out.width / 2, out.height / 2)
  octx.rotate((edit.turns * Math.PI) / 2)
  octx.drawImage(flat, -img.width / 2, -img.height / 2)
  flat.width = flat.height = 0

  const blob = await new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the page.'))), 'image/jpeg', 0.85),
  )
  out.width = out.height = 0
  return { jpg: new Uint8Array(await blob.arrayBuffer()), url: URL.createObjectURL(blob) }
}
