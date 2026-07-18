import { StandardFonts, degrees, rgb } from 'pdf-lib'
import { loadPdf } from './load'
import { PdfError } from './errors'

export type PlacedPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type WatermarkPosition = PlacedPosition | 'tiled'

const POS: Record<PlacedPosition, readonly ['top' | 'middle' | 'bottom', 'left' | 'center' | 'right']> = {
  'top-left': ['top', 'left'],
  'top-center': ['top', 'center'],
  'top-right': ['top', 'right'],
  'middle-left': ['middle', 'left'],
  center: ['middle', 'center'],
  'middle-right': ['middle', 'right'],
  'bottom-left': ['bottom', 'left'],
  'bottom-center': ['bottom', 'center'],
  'bottom-right': ['bottom', 'right'],
}

const MARGIN = 40

function placeXY(
  position: PlacedPosition,
  pageW: number,
  pageH: number,
  itemW: number,
  itemH: number,
): { x: number; y: number } {
  const [v, h] = POS[position]
  const x = h === 'left' ? MARGIN : h === 'center' ? (pageW - itemW) / 2 : pageW - MARGIN - itemW
  const y = v === 'bottom' ? MARGIN : v === 'middle' ? (pageH - itemH) / 2 : pageH - MARGIN - itemH
  return { x, y }
}

export interface TextWatermarkOptions {
  text: string
  fontSize: number
  color: { r: number; g: number; b: number }
  /** 0..1 */
  opacity: number
  /** degrees, ignored when position is "tiled" (tiled is always 45°) */
  rotation: number
  position: WatermarkPosition
  /** 0-based page indices; omit for all pages */
  pageIndices?: number[]
}

export async function addTextWatermark(bytes: Uint8Array, opts: TextWatermarkOptions): Promise<Uint8Array> {
  if (!opts.text.trim()) throw new PdfError('Enter the watermark text.')
  const doc = await loadPdf(bytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  let textWidth: number
  try {
    textWidth = font.widthOfTextAtSize(opts.text, opts.fontSize)
  } catch {
    throw new PdfError('Watermark text supports English/Latin characters for now — Indian language support is coming.')
  }
  const color = rgb(opts.color.r, opts.color.g, opts.color.b)
  const pages = doc.getPages()
  const targets = opts.pageIndices ?? pages.map((_, i) => i)

  for (const i of targets) {
    const page = pages[i]
    if (!page) continue
    const { width, height } = page.getSize()
    if (opts.position === 'tiled') {
      const stepX = textWidth + 90
      const stepY = opts.fontSize + 110
      for (let y = -stepY; y < height + stepY; y += stepY) {
        for (let x = -stepX; x < width + stepX; x += stepX) {
          page.drawText(opts.text, {
            x,
            y,
            size: opts.fontSize,
            font,
            color,
            opacity: opts.opacity,
            rotate: degrees(45),
          })
        }
      }
    } else {
      const { x, y } = placeXY(opts.position, width, height, textWidth, opts.fontSize)
      page.drawText(opts.text, {
        x,
        y,
        size: opts.fontSize,
        font,
        color,
        opacity: opts.opacity,
        rotate: degrees(opts.rotation),
      })
    }
  }
  return doc.save({ useObjectStreams: true })
}

export interface ImageWatermarkOptions {
  imageBytes: Uint8Array
  imageKind: 'jpg' | 'png'
  /** watermark width as a fraction of page width, 0..1 */
  scale: number
  /** 0..1 */
  opacity: number
  position: PlacedPosition
  /** 0-based page indices; omit for all pages */
  pageIndices?: number[]
}

export async function addImageWatermark(bytes: Uint8Array, opts: ImageWatermarkOptions): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  const img = opts.imageKind === 'jpg' ? await doc.embedJpg(opts.imageBytes) : await doc.embedPng(opts.imageBytes)
  const pages = doc.getPages()
  const targets = opts.pageIndices ?? pages.map((_, i) => i)

  for (const i of targets) {
    const page = pages[i]
    if (!page) continue
    const { width, height } = page.getSize()
    const w = width * opts.scale
    const h = w * (img.height / img.width)
    const { x, y } = placeXY(opts.position, width, height, w, h)
    page.drawImage(img, { x, y, width: w, height: h, opacity: opts.opacity })
  }
  return doc.save({ useObjectStreams: true })
}
