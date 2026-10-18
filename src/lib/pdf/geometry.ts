import { degrees, type PDFPage } from 'pdf-lib'

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** A rectangle on the page *as displayed* (page rotation applied), in 0..1 fractions, origin top-left. */
export interface DisplayRect {
  left: number
  top: number
  width: number
  height: number
}

export type Rotation = 0 | 90 | 180 | 270

export function normRotation(angle: number): Rotation {
  const r = (((Math.round(angle / 90) * 90) % 360) + 360) % 360
  return r as Rotation
}

/** The visible area of a page: its CropBox clipped to its MediaBox, like viewers show it. */
export function visibleBox(page: PDFPage): Box {
  const m = page.getMediaBox()
  const c = page.getCropBox()
  const x0 = Math.max(m.x, c.x)
  const y0 = Math.max(m.y, c.y)
  const x1 = Math.min(m.x + m.width, c.x + c.width)
  const y1 = Math.min(m.y + m.height, c.y + c.height)
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : m
}

/**
 * Map a display-space point (u → right, v → down, both 0..1 across the visible page)
 * to PDF user space. /Rotate turns the page clockwise for display.
 */
export function displayToPdf(box: Box, rotation: number, u: number, v: number): { x: number; y: number } {
  const { x, y, width: W, height: H } = box
  switch (normRotation(rotation)) {
    case 0:
      return { x: x + u * W, y: y + (1 - v) * H }
    case 90:
      return { x: x + v * W, y: y + u * H }
    case 180:
      return { x: x + (1 - u) * W, y: y + v * H }
    case 270:
      return { x: x + (1 - v) * W, y: y + (1 - u) * H }
  }
}

/** Axis-aligned PDF box covering a display rect. */
export function displayRectToPdfBox(box: Box, rotation: number, r: DisplayRect): Box {
  const a = displayToPdf(box, rotation, r.left, r.top)
  const b = displayToPdf(box, rotation, r.left + r.width, r.top + r.height)
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

/**
 * Where to draw something so it appears upright inside a display rect:
 * origin is the rect's displayed bottom-left corner, `rotate` turns it to match the page.
 */
export function uprightPlacement(
  page: PDFPage,
  r: DisplayRect,
): { x: number; y: number; width: number; height: number; rotate: ReturnType<typeof degrees> } {
  const box = visibleBox(page)
  const rot = page.getRotation().angle
  const p0 = displayToPdf(box, rot, r.left, r.top + r.height) // displayed bottom-left
  const p1 = displayToPdf(box, rot, r.left + r.width, r.top + r.height) // displayed bottom-right
  const p2 = displayToPdf(box, rot, r.left, r.top) // displayed top-left
  return {
    x: p0.x,
    y: p0.y,
    width: Math.hypot(p1.x - p0.x, p1.y - p0.y),
    height: Math.hypot(p2.x - p0.x, p2.y - p0.y),
    rotate: degrees((Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180) / Math.PI),
  }
}
