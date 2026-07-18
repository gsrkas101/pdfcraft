export interface EmbeddableImage {
  bytes: Uint8Array
  kind: 'jpg' | 'png'
}

/** JPG/PNG pass through untouched; anything else (WebP, HEIC the browser can decode…) is re-encoded via canvas. */
export async function fileToEmbeddable(file: File): Promise<EmbeddableImage> {
  if (file.type === 'image/jpeg') return { bytes: new Uint8Array(await file.arrayBuffer()), kind: 'jpg' }
  if (file.type === 'image/png') return { bytes: new Uint8Array(await file.arrayBuffer()), kind: 'png' }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`Could not read "${file.name}" — is it a valid image?`)
  }
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create a canvas — try a different browser.')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Could not convert "${file.name}".`))), 'image/jpeg', 0.92),
  )
  return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: 'jpg' }
}
