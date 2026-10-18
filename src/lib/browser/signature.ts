export interface InkImage {
  png: Uint8Array
  url: string
  /** height / width in pixels */
  aspect: number
}

/** Copy of the canvas cropped to its non-transparent pixels (plus padding), or null if empty. */
export function trimCanvas(src: HTMLCanvasElement, pad = 6): HTMLCanvasElement | null {
  const ctx = src.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const { width: w, height: h } = src
  const px = ctx.getImageData(0, 0, w, h).data
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const x0 = Math.max(0, minX - pad)
  const y0 = Math.max(0, minY - pad)
  const x1 = Math.min(w, maxX + 1 + pad)
  const y1 = Math.min(h, maxY + 1 + pad)
  const out = document.createElement('canvas')
  out.width = x1 - x0
  out.height = y1 - y0
  out.getContext('2d')!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

export async function canvasToInk(canvas: HTMLCanvasElement): Promise<InkImage> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the signature image.'))), 'image/png'),
  )
  return {
    png: new Uint8Array(await blob.arrayBuffer()),
    url: URL.createObjectURL(blob),
    aspect: canvas.height / canvas.width,
  }
}

/** Render one line of text to a trimmed, transparent PNG. */
export async function textToInk(text: string, font: string, color: string): Promise<InkImage | null> {
  if (!text.trim()) return null
  const size = 120
  const css = `${size}px ${font}`
  await document.fonts.load(css, text).catch(() => undefined)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = css
  canvas.width = Math.ceil(ctx.measureText(text).width + size)
  canvas.height = Math.ceil(size * 1.8)
  ctx.font = css // resizing the canvas resets its state
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.fillText(text, size / 2, canvas.height / 2)
  const trimmed = trimCanvas(canvas, 8)
  return trimmed ? canvasToInk(trimmed) : null
}

/**
 * Turn a photo/scan of a signature into a transparent PNG: near-white paper fades out,
 * ink stays. Large photos are scaled down first.
 */
export async function imageToInk(file: File, removeBackground: boolean): Promise<InkImage | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`Could not read "${file.name}" — is it a valid image?`)
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  if (removeBackground) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      // ≥ 215 → paper (transparent), ≤ 140 → ink (opaque), smooth in between
      const keep = Math.min(1, Math.max(0, (215 - lum) / 75))
      d[i + 3] = Math.round(d[i + 3] * keep)
    }
    ctx.putImageData(img, 0, 0)
  }
  const trimmed = trimCanvas(canvas, 4)
  return trimmed ? canvasToInk(trimmed) : null
}
