// Generates test PDFs and tiny images used by test-engines.ts and browser smoke tests.
// Usage: tsx scripts/make-fixtures.ts <out-dir>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const dir = process.argv[2]
if (!dir) throw new Error('usage: tsx scripts/make-fixtures.ts <out-dir>')
mkdirSync(dir, { recursive: true })

// 1x1 valid images (classic minimal base64 blobs)
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const JPG_B64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q=='

async function makePdf(n: number, label: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const colors = [
    rgb(0.02, 0.59, 0.41),
    rgb(0.03, 0.52, 0.78),
    rgb(0.55, 0.36, 0.96),
    rgb(0.96, 0.62, 0.04),
    rgb(0.86, 0.15, 0.15),
  ]
  for (let i = 0; i < n; i++) {
    const c = colors[i % colors.length]
    const page = doc.addPage([595.28, 841.89])
    page.drawRectangle({ x: 0, y: 791, width: 595.28, height: 50.89, color: c })
    page.drawText(`${label} — page ${i + 1}`, { x: 40, y: 807, size: 20, font, color: rgb(1, 1, 1) })
    page.drawText(String(i + 1), { x: 220, y: 340, size: 160, font, color: c })
  }
  return doc.save()
}

writeFileSync(join(dir, 'sample-a.pdf'), await makePdf(5, 'Sample A'))
writeFileSync(join(dir, 'sample-b.pdf'), await makePdf(3, 'Sample B'))
writeFileSync(join(dir, 'tiny.png'), Buffer.from(PNG_B64, 'base64'))
writeFileSync(join(dir, 'tiny.jpg'), Buffer.from(JPG_B64, 'base64'))
console.log(`fixtures written to ${dir}: sample-a.pdf (5p), sample-b.pdf (3p), tiny.png, tiny.jpg`)
