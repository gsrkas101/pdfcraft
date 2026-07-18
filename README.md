# PDFCraft

**Free PDF tools that run entirely in your browser.** No signup, no limits, no watermarks, no ads — and your files never leave your device, because there is no server.

Live: https://gsrkas101.github.io/pdfcraft/

Sister project: [ResumeCraft](https://gsrkas101.github.io/resumecraft/) — free, no-signup resume builder.

## Tools (Phase 1)

- **Organize:** Merge, Split (ranges / every N pages), Extract pages, Remove pages, Organize (drag-reorder, rotate, delete)
- **Optimize:** Compress (lossless + raster presets with honest before/after sizes)
- **Convert:** JPG/PNG/WebP → PDF, PDF → JPG/PNG
- **Edit:** Rotate, Text/Image watermark, Page numbers

Everything is processed client-side with [pdf-lib](https://pdf-lib.js.org/) (manipulation) and [pdf.js](https://mozilla.github.io/pdf.js/) (rendering).

## Roadmap

- **Phase 2:** Sign, Crop, Protect/Unlock, Scan → PDF, OCR (English + Hindi), route prerendering for SEO, PWA offline, Hindi UI
- **Phase 3:** Redact, Compare, Repair, HTML → PDF, basic PDF ↔ Word/Excel (honestly labeled as approximate)

Not planned: high-fidelity PDF ↔ Office conversion and validated PDF/A — those need servers (that's how the paid sites do it), and PDFCraft is server-free by design.

## Development

```bash
npm install
npm run dev          # dev server
npm run fixtures     # generate test PDFs/images into public/fixtures
npm run test:engines # headless engine tests (page counts, ranges, rotations…)
npm run typecheck
npm run build        # typecheck + vite build + SPA 404 fallback
```

Stack: Vite + React 19 + TypeScript + Tailwind 4 + react-router 7 + pdf-lib + pdfjs-dist + dnd-kit + fflate.

## Deploy

Pushes to `main` deploy to GitHub Pages via `.github/workflows/deploy.yml` (Vite `base` is `/pdfcraft/`).

## License

MIT
