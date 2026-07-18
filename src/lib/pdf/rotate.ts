import { degrees } from 'pdf-lib'
import { loadPdf } from './load'

export type RotationDelta = 90 | 180 | 270

export async function rotatePages(
  bytes: Uint8Array,
  indices: number[] | 'all',
  delta: RotationDelta,
): Promise<Uint8Array> {
  const doc = await loadPdf(bytes)
  const targets = indices === 'all' ? doc.getPageIndices() : indices
  for (const i of targets) {
    const page = doc.getPage(i)
    const next = (((page.getRotation().angle + delta) % 360) + 360) % 360
    page.setRotation(degrees(next))
  }
  return doc.save({ useObjectStreams: true })
}
