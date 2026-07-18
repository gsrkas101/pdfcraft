import { zipSync } from 'fflate'

/** Store-only zip (PDFs/JPEGs are already compressed — level 0 keeps it instant). */
export function zipFiles(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const f of files) entries[f.name] = f.data
  return zipSync(entries, { level: 0 })
}
