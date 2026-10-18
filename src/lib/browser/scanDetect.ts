// Automatic page-edge detection for Scan to PDF: find the paper's four corners in a photo.
// Pure pixel math (no DOM), so scripts/test-engines.ts can check it headlessly.
//
// Shrink to ~512 px, grayscale + blur, Sobel gradients. Rough page outlines come from the
// largest bright and dark (Otsu) regions and the largest edge-map blobs: convex hull → biggest
// 4-gon inside it. Each side then snaps to the strongest straight edge nearby (a small Hough
// vote + line fit), corners are where the side lines cross, and the result is kept only if
// long runs of same-polarity edges back up its sides. Otherwise: null, i.e. "use the whole photo".
import type { Pt, Quad } from './scan'

export interface Pixels {
  /** RGBA, row-major */
  data: ArrayLike<number>
  width: number
  height: number
}

/** Detection works at about this many pixels on the long side. */
export const DETECT_SIZE = 512

const DEG = Math.PI / 180
/** how far (degrees) a rough side may be tilted from the real edge */
const MAX_TILT = 6
/** gradients within this angle of a side's normal count as running along it */
const ALIGN = Math.cos(30 * DEG)
/** a page must cover at least this fraction of the photo */
const MIN_AREA = 0.12
/** corner angles outside this range mean a degenerate or implausible quad */
const MIN_ANGLE = 35
const MAX_ANGLE = 145
/** share of a side's length that must sit on a matching edge */
const MIN_SUPPORT = 0.6
const MIN_SIDE_SUPPORT = 0.35

interface Grad {
  w: number
  h: number
  gx: Float32Array
  gy: Float32Array
  mag: Float32Array
  /** gradient strength that counts as an edge */
  t: number
  /** pixels with mag ≥ t, and their coordinates */
  edges: Int32Array
  ex: Int16Array
  ey: Int16Array
}

interface Line {
  p: Pt
  d: Pt
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

/** Find the page's corners (fractions of the image, TL, TR, BR, BL), or null if no clear page outline. */
export function findPageQuad(img: Pixels): Quad | null {
  const { g, w, h, f } = shrinkGray(img)
  if (w < 32 || h < 32) return null
  const blurred = blur(g, w, h)
  const G = gradients(blurred, w, h)

  // rough outlines come from a half-size copy: plenty for a starting point, and 4× less to label
  const hw = w >> 1
  const hh = h >> 1
  const small = new Float32Array(hw * hh)
  const peak = new Float32Array(hw * hh)
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < hw; x++) {
      const i = 2 * y * w + 2 * x
      small[y * hw + x] = (blurred[i] + blurred[i + 1] + blurred[i + w] + blurred[i + w + 1]) / 4
      peak[y * hw + x] = Math.max(G.mag[i], G.mag[i + 1], G.mag[i + w], G.mag[i + w + 1])
    }
  }
  const t = otsu(small)
  // strong edges keep a page apart from busy backgrounds; all edges catch white-on-white
  const strong = Math.max(2 * G.t, quantile(G.mag, 0.85))
  const bright = new Uint8Array(hw * hh)
  const dark = new Uint8Array(hw * hh)
  const strongEdges = new Uint8Array(hw * hh)
  const allEdges = new Uint8Array(hw * hh)
  for (let i = 0; i < hw * hh; i++) {
    if (small[i] > t) bright[i] = 1
    else dark[i] = 1
    if (peak[i] >= strong) strongEdges[i] = 1
    if (peak[i] >= G.t) allEdges[i] = 1
  }
  const outlines = [
    ...blobs(morph(bright, hw, hh, 1), hw, hh, false),
    ...blobs(morph(dark, hw, hh, 1), hw, hh, false),
    ...blobs(strongEdges, hw, hh, true),
    ...blobs(allEdges, hw, hh, true),
  ]

  let best: { quad: Pt[]; score: number } | null = null
  const tried = new Set<string>()
  for (const pts of outlines) {
    const rough = largestQuad(convexHull(pts.map((p) => ({ x: 2 * p.x + 0.5, y: 2 * p.y + 0.5 }))))
    if (!rough) continue
    const key = rough.map((p) => `${Math.round(p.x / 4)},${Math.round(p.y / 4)}`).join(' ')
    if (tried.has(key)) continue
    tried.add(key)
    const c = snapQuad(rough, G)
    if (c && (!best || c.score > best.score)) best = c
  }
  if (!best) return null

  // the side pointing most to the right is the top, so the page keeps the photo's orientation
  const q = best.quad
  let k = 0
  for (let i = 1; i < 4; i++) {
    const rightness = (j: number) => (q[(j + 1) % 4].x - q[j].x) / dist(q[j], q[(j + 1) % 4])
    if (rightness(i) > rightness(k)) k = i
  }
  const toFrac = (p: Pt) => ({
    x: Math.min(1, Math.max(0, ((p.x + 0.5) * f) / img.width)),
    y: Math.min(1, Math.max(0, ((p.y + 0.5) * f) / img.height)),
  })
  return [0, 1, 2, 3].map((i) => toFrac(q[(k + i) % 4])) as Quad
}

/** Snap a rough quad's sides to real edges and score the result (null = not a page). */
function snapQuad(rough: Pt[], G: Grad): { quad: Pt[]; score: number } | null {
  const { w, h } = G
  const band = Math.max(6, Math.round(0.03 * Math.hypot(w, h)))
  const sides = [0, 1, 2, 3].map((i) => [rough[i], rough[(i + 1) % 4]] as const)

  const borders = sides.map(([a, b]) => borderOf(a, b, w, h))
  if (borders.filter((b) => b !== null).length > 1) return null
  const fits = sides.map(([a, b], i) => (borders[i] ? null : snapSide(a, b, G, band)))

  // light page on dark ground or the reverse — all sides must agree
  let vPos = 0
  let vNeg = 0
  for (const fit of fits) {
    vPos += fit?.[0]?.votes ?? 0
    vNeg += fit?.[1]?.votes ?? 0
  }
  const pol = vPos >= vNeg ? 0 : 1
  const lines: Line[] = sides.map(([a, b], i) => {
    const border = borders[i]
    if (border) return border
    const fit = fits[i]?.[pol]
    if (fit) return fit
    const len = dist(a, b)
    return { p: a, d: { x: (b.x - a.x) / len, y: (b.y - a.y) / len } }
  })

  const quad: Pt[] = []
  for (let i = 0; i < 4; i++) {
    const c = intersect(lines[(i + 3) % 4], lines[i])
    if (!c) return null
    const slack = 0.02 * Math.max(w, h)
    if (c.x < -slack || c.y < -slack || c.x > w + slack || c.y > h + slack) return null
    quad.push({ x: Math.min(w - 0.5, Math.max(-0.5, c.x)), y: Math.min(h - 0.5, Math.max(-0.5, c.y)) })
  }

  let area = 0
  for (let i = 0; i < 4; i++) {
    const a = quad[i]
    const b = quad[(i + 1) % 4]
    const c = quad[(i + 2) % 4]
    if (cross(a, b, c) <= 0) return null // not convex (or flipped)
    const angle =
      Math.acos(
        Math.max(-1, Math.min(1, ((a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y)) / (dist(a, b) * dist(c, b)))),
      ) / DEG
    if (angle < MIN_ANGLE || angle > MAX_ANGLE) return null
    area += a.x * b.y - b.x * a.y
  }
  area = area / 2 / (w * h)
  if (area < MIN_AREA) return null

  let hits = 0
  let samples = 0
  for (let i = 0; i < 4; i++) {
    if (borders[i]) continue
    const s = sideSupport(quad[i], quad[(i + 1) % 4], pol === 0 ? 1 : -1, G)
    if (s.hits < MIN_SIDE_SUPPORT * s.samples) return null
    hits += s.hits
    samples += s.samples
  }
  const support = hits / samples
  if (support < MIN_SUPPORT) return null
  return { quad, score: area * support }
}

/** The image edge a rough side lies along (a page running out of frame), as a line. */
function borderOf(a: Pt, b: Pt, w: number, h: number): Line | null {
  const tol = 0.02 * Math.max(w, h)
  if (a.x < tol && b.x < tol) return { p: { x: -0.5, y: 0 }, d: { x: 0, y: 1 } }
  if (a.x > w - 1 - tol && b.x > w - 1 - tol) return { p: { x: w - 0.5, y: 0 }, d: { x: 0, y: 1 } }
  if (a.y < tol && b.y < tol) return { p: { x: 0, y: -0.5 }, d: { x: 1, y: 0 } }
  if (a.y > h - 1 - tol && b.y > h - 1 - tol) return { p: { x: 0, y: h - 0.5 }, d: { x: 1, y: 0 } }
  return null
}

function intersect(l1: Line, l2: Line): Pt | null {
  const den = l1.d.x * l2.d.y - l1.d.y * l2.d.x
  if (Math.abs(den) < Math.sin(20 * DEG)) return null
  const t = ((l2.p.x - l1.p.x) * l2.d.y - (l2.p.y - l1.p.y) * l2.d.x) / den
  return { x: l1.p.x + t * l1.d.x, y: l1.p.y + t * l1.d.y }
}

/**
 * Find the strongest straight edge near the rough side a→b, separately for gradients pointing
 * into the quad (light page) and out of it (dark page): vote over small tilts and offsets,
 * then fit a line to the winner's pixels.
 */
function snapSide(a: Pt, b: Pt, G: Grad, band: number): [(Line & { votes: number }) | null, (Line & { votes: number }) | null] {
  const { w, gx, gy, mag, edges } = G
  const len = dist(a, b)
  const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len }
  const n = { x: -u.y, y: u.x } // points into the quad (corners run clockwise on screen)
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const reach = band + 0.5 * len * Math.tan(MAX_TILT * DEG)
  const tilts = 2 * MAX_TILT + 1
  const nb = 2 * band + 1
  const tnx = new Float32Array(tilts)
  const tny = new Float32Array(tilts)
  for (let k = 0; k < tilts; k++) {
    const th = (k - MAX_TILT) * DEG
    tnx[k] = n.x * Math.cos(th) - n.y * Math.sin(th)
    tny[k] = n.x * Math.sin(th) + n.y * Math.cos(th)
  }
  const votes = [new Float32Array(tilts * nb), new Float32Array(tilts * nb)]
  const near: number[] = []
  const x0 = Math.min(a.x, b.x) - reach
  const x1 = Math.max(a.x, b.x) + reach
  const y0 = Math.min(a.y, b.y) - reach
  const y1 = Math.max(a.y, b.y) + reach
  for (let e = 0; e < edges.length; e++) {
    const ex = G.ex[e]
    const ey = G.ey[e]
    if (ex < x0 || ex > x1 || ey < y0 || ey > y1) continue
    const i = edges[e]
    const rx = ex - m.x
    const ry = ey - m.y
    if (Math.abs(rx * u.x + ry * u.y) > 0.45 * len || Math.abs(rx * n.x + ry * n.y) > reach) continue
    const c = (gx[i] * n.x + gy[i] * n.y) / mag[i]
    if (Math.abs(c) < ALIGN) continue
    const v = votes[c > 0 ? 0 : 1]
    const wt = Math.min(1, mag[i] / (2 * G.t))
    for (let k = 0; k < tilts; k++) {
      const o = Math.round(rx * tnx[k] + ry * tny[k])
      if (o >= -band && o <= band) v[k * nb + o + band] += wt
    }
    near.push(i)
  }

  return [0, 1].map((p) => {
    const v = votes[p]
    let top = 0
    for (let j = 1; j < v.length; j++) if (v[j] > v[top]) top = j
    if (v[top] < 0.15 * len) return null
    const k = (top / nb) | 0
    const off = (top % nb) - band
    // weighted total least squares over the winning line's pixels
    let sw = 0
    let sx = 0
    let sy = 0
    let sxx = 0
    let sxy = 0
    let syy = 0
    for (const i of near) {
      const c = gx[i] * n.x + gy[i] * n.y
      if ((c > 0 ? 0 : 1) !== p) continue
      const x = i % w
      const y = (i / w) | 0
      if (Math.abs((x - m.x) * tnx[k] + (y - m.y) * tny[k] - off) > 2) continue
      const wt = mag[i]
      sw += wt
      sx += wt * x
      sy += wt * y
      sxx += wt * x * x
      sxy += wt * x * y
      syy += wt * y * y
    }
    if (!sw) return null
    const mx = sx / sw
    const my = sy / sw
    const cxx = sxx / sw - mx * mx
    const cxy = sxy / sw - mx * my
    const cyy = syy / sw - my * my
    const th = 0.5 * Math.atan2(2 * cxy, cxx - cyy)
    let d = { x: Math.cos(th), y: Math.sin(th) }
    if (d.x * u.x + d.y * u.y < 0) d = { x: -d.x, y: -d.y }
    return { p: { x: mx, y: my }, d, votes: v[top] }
  }) as [(Line & { votes: number }) | null, (Line & { votes: number }) | null]
}

/** How much of side a→b (ends trimmed) has an aligned edge of the right polarity within 2 px. */
function sideSupport(a: Pt, b: Pt, sign: number, G: Grad): { hits: number; samples: number } {
  const { w, h, gx, gy, mag } = G
  const len = dist(a, b)
  const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len }
  const samples = Math.max(8, Math.floor((0.84 * len) / 1.5))
  let hits = 0
  for (let s = 0; s < samples; s++) {
    const t = 0.08 + (0.84 * (s + 0.5)) / samples
    const px = a.x + (b.x - a.x) * t
    const py = a.y + (b.y - a.y) * t
    for (let o = -2; o <= 2; o++) {
      const x = Math.round(px + n.x * o)
      const y = Math.round(py + n.y * o)
      if (x < 0 || y < 0 || x >= w || y >= h) continue
      const i = y * w + x
      if (mag[i] >= G.t && (sign * (gx[i] * n.x + gy[i] * n.y)) / mag[i] >= ALIGN) {
        hits++
        break
      }
    }
  }
  return { hits, samples }
}

/** The largest-area quadrilateral with corners on the hull (clockwise on screen, like the hull). */
function largestQuad(hull: Pt[]): Pt[] | null {
  const n = hull.length
  if (n < 4) return null
  const P = (i: number) => hull[i % n]
  const tri = (a: number, b: number, c: number) => Math.abs(cross(P(a), P(b), P(c)))
  let best = -1
  let q = [0, 1, 2, 3]
  for (let a = 0; a < n; a++) {
    let b = a + 1
    let d = a + 3
    for (let c = a + 2; c <= a + n - 2; c++) {
      // the farthest vertex from diagonal a–c only moves forward as c does
      while (b + 1 < c && tri(a, b + 1, c) >= tri(a, b, c)) b++
      if (d <= c) d = c + 1
      while (d + 1 < a + n && tri(a, c, d + 1) >= tri(a, c, d)) d++
      const area = tri(a, b, c) + tri(a, c, d)
      if (area > best) {
        best = area
        q = [a, b, c, d]
      }
    }
  }
  return q.map(P)
}

/** Monotone-chain convex hull; on screen (y down) the result runs clockwise. */
function convexHull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y)
  if (p.length < 3) return p
  const lower: Pt[] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: Pt[] = []
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop()
    upper.push(q)
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

/**
 * The 3 largest connected regions spanning ≥ 20% of the photo each way, as their row-end pixels.
 * `diagonal`: corners touching count as connected (for thin edge lines).
 */
function blobs(mask: Uint8Array, w: number, h: number, diagonal: boolean): Pt[][] {
  const label = new Int32Array(w * h)
  const stack = new Int32Array(w * h)
  const found: { id: number; count: number; x0: number; x1: number; y0: number; y1: number }[] = []
  let id = 0
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || label[start]) continue
    label[start] = ++id
    let sp = 0
    stack[sp++] = start
    let count = 0
    let x0 = w
    let x1 = 0
    let y0 = h
    let y1 = 0
    while (sp) {
      const p = stack[--sp]
      const x = p % w
      const y = (p / w) | 0
      count++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (x > 0 && mask[p - 1] && !label[p - 1]) (label[p - 1] = id), (stack[sp++] = p - 1)
      if (x < w - 1 && mask[p + 1] && !label[p + 1]) (label[p + 1] = id), (stack[sp++] = p + 1)
      if (y > 0 && mask[p - w] && !label[p - w]) (label[p - w] = id), (stack[sp++] = p - w)
      if (y < h - 1 && mask[p + w] && !label[p + w]) (label[p + w] = id), (stack[sp++] = p + w)
      if (!diagonal) continue
      if (x > 0 && y > 0 && mask[p - w - 1] && !label[p - w - 1]) (label[p - w - 1] = id), (stack[sp++] = p - w - 1)
      if (x < w - 1 && y > 0 && mask[p - w + 1] && !label[p - w + 1]) (label[p - w + 1] = id), (stack[sp++] = p - w + 1)
      if (x > 0 && y < h - 1 && mask[p + w - 1] && !label[p + w - 1]) (label[p + w - 1] = id), (stack[sp++] = p + w - 1)
      if (x < w - 1 && y < h - 1 && mask[p + w + 1] && !label[p + w + 1]) (label[p + w + 1] = id), (stack[sp++] = p + w + 1)
    }
    if (x1 - x0 + 1 >= 0.2 * w && y1 - y0 + 1 >= 0.2 * h) found.push({ id, count, x0, x1, y0, y1 })
  }
  return found
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((c) => {
      const pts: Pt[] = []
      for (let y = c.y0; y <= c.y1; y++) {
        let lo = -1
        let hi = -1
        for (let x = c.x0; x <= c.x1; x++) {
          if (label[y * w + x] !== c.id) continue
          if (lo < 0) lo = x
          hi = x
        }
        if (lo >= 0) pts.push({ x: lo, y }, { x: hi, y })
      }
      return pts
    })
}

/** Square erosion of a 0/1 mask (cuts thin bridges between regions); outside the image counts as background. */
function morph(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const full = 2 * r + 1
  // sliding count of set pixels in a (2r+1) window; only full windows survive
  const pass = (src: Uint8Array, dst: Uint8Array, len: number, lines: number, step: number, stride: number) => {
    for (let l = 0; l < lines; l++) {
      const base = l * stride
      let count = 0
      for (let k = 0; k < r && k < len; k++) count += src[base + k * step]
      for (let i = 0; i < len; i++) {
        if (i + r < len) count += src[base + (i + r) * step]
        if (i - r - 1 >= 0) count -= src[base + (i - r - 1) * step]
        dst[base + i * step] = count === full ? 1 : 0
      }
    }
  }
  const tmp = new Uint8Array(w * h)
  const out = new Uint8Array(w * h)
  pass(m, tmp, w, h, 1, w)
  pass(tmp, out, h, w, w, 1)
  return out
}

/** Luminance, box-averaged down to about DETECT_SIZE on the long side. */
function shrinkGray(img: Pixels): { g: Float32Array; w: number; h: number; f: number } {
  const f = Math.max(1, Math.round(Math.max(img.width, img.height) / DETECT_SIZE))
  const w = Math.floor(img.width / f)
  const h = Math.floor(img.height / f)
  const g = new Float32Array(w * h)
  const d = img.data
  const W = img.width
  const k = 1 / (f * f)
  for (let yy = 0; yy < h * f; yy++) {
    const row = ((yy / f) | 0) * w
    for (let xx = 0, i = yy * W * 4; xx < w * f; xx++, i += 4) {
      g[row + ((xx / f) | 0)] += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * k
    }
  }
  return { g, w, h, f }
}

/** Separable 5-tap binomial blur (σ ≈ 1 px), edges clamped. */
function blur(src: Float32Array, w: number, h: number): Float32Array {
  // [1 4 6 4 1] / 16 along one line of `len` samples, `step` apart
  const pass = (s: Float32Array, d: Float32Array, len: number, lines: number, step: number, stride: number) => {
    for (let l = 0; l < lines; l++) {
      const o = l * stride
      const at = (i: number) => s[o + Math.min(len - 1, Math.max(0, i)) * step]
      for (const i of [0, 1, len - 2, len - 1]) {
        d[o + i * step] = (at(i - 2) + 4 * at(i - 1) + 6 * at(i) + 4 * at(i + 1) + at(i + 2)) / 16
      }
      for (let i = 2, p = o + 2 * step; i < len - 2; i++, p += step) {
        d[p] = (s[p - 2 * step] + 4 * s[p - step] + 6 * s[p] + 4 * s[p + step] + s[p + 2 * step]) / 16
      }
    }
  }
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  pass(src, tmp, w, h, 1, w)
  pass(tmp, out, h, w, w, 1)
  return out
}

/** Sobel gradients (in gray levels per pixel), with an edge threshold a few times the noise floor. */
function gradients(g: Float32Array, w: number, h: number): Grad {
  const gx = new Float32Array(w * h)
  const gy = new Float32Array(w * h)
  const mag = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const dx = (g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1]) / 8
      const dy = (g[i + w - 1] + 2 * g[i + w] + g[i + w + 1] - g[i - w - 1] - 2 * g[i - w] - g[i - w + 1]) / 8
      gx[i] = dx
      gy[i] = dy
      mag[i] = Math.sqrt(dx * dx + dy * dy)
    }
  }
  const t = Math.max(4, 2.5 * quantile(mag, 0.5))
  let n = 0
  for (let i = 0; i < w * h; i++) if (mag[i] >= t) n++
  const edges = new Int32Array(n)
  const ex = new Int16Array(n)
  const ey = new Int16Array(n)
  for (let y = 0, j = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mag[y * w + x] < t) continue
      edges[j] = y * w + x
      ex[j] = x
      ey[j++] = y
    }
  }
  return { w, h, gx, gy, mag, t, edges, ex, ey }
}

/** Approximate quantile of values in 0..255 (larger values count as 255). */
function quantile(v: Float32Array, q: number): number {
  const hist = new Uint32Array(256)
  for (let i = 0; i < v.length; i++) hist[Math.min(255, v[i] | 0)]++
  let acc = 0
  for (let b = 0; b < 256; b++) {
    acc += hist[b]
    if (acc >= q * v.length) return b + 0.5
  }
  return 255
}

/** Otsu's threshold: the gray level that best splits the photo into two classes. */
function otsu(g: Float32Array): number {
  const hist = new Float64Array(256)
  for (let i = 0; i < g.length; i++) hist[Math.min(255, Math.max(0, g[i] | 0))]++
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let wB = 0
  let sumB = 0
  let best = -1
  let t = 127
  for (let i = 0; i < 256; i++) {
    wB += hist[i]
    if (!wB) continue
    const wF = g.length - wB
    if (!wF) break
    sumB += i * hist[i]
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2
    if (between > best) {
      best = between
      t = i
    }
  }
  return t + 0.5
}
