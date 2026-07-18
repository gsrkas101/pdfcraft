export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB']
  let v = n
  let u = -1
  do {
    v /= 1024
    u++
  } while (v >= 1024 && u < units.length - 1)
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[u]}`
}

/** "report.pdf" + "merged" → "report_merged.pdf" */
export function outputName(input: string, suffix: string, ext = 'pdf'): string {
  const base = input.replace(/\.[^.]+$/, '') || 'pdfcraft'
  return `${base}_${suffix}.${ext}`
}

export function baseName(input: string): string {
  return input.replace(/\.[^.]+$/, '') || 'pdfcraft'
}
