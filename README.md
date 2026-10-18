# PDFCraft

**Free PDF tools that run entirely in your browser.** No signup, no limits, no watermarks, no ads — and your files never leave your device, because there is no server.

Live: https://gsrkas101.github.io/pdfcraft/

Sister project: [ResumeCraft](https://gsrkas101.github.io/resumecraft/) — free, no-signup resume builder.

## Tools

- **Organize:** Merge, Split (ranges / every N pages), Extract pages, Remove pages, Organize (drag-reorder, rotate, delete)
- **Optimize:** Compress (lossless + raster presets with honest before/after sizes)
- **Convert:** JPG/PNG/WebP → PDF, PDF → JPG/PNG, Scan to PDF (camera/photos → straightened, cleaned-up pages), OCR (searchable text layer, English + Hindi)
- **Edit:** Rotate, Text/Image watermark, Page numbers, Sign (draw / type / upload, plus text and dates), Crop (drag a box or trim white margins)
- **Security:** Protect (AES-256 password, optional print/copy/edit restrictions), Unlock (with the password you know)

Everything is processed client-side with [pdf-lib](https://pdf-lib.js.org/) (manipulation), [pdf.js](https://mozilla.github.io/pdf.js/) (rendering), [@cantoo/pdf-lib](https://github.com/cantoo-scribe/pdf-lib) (encryption) and [Tesseract.js](https://tesseract.projectnaptha.com/) (OCR). The OCR engine and language data are self-hosted (copied into `public/ocr/` by `scripts/copy-ocr-assets.mjs` on dev/build), so no tool loads code from a third-party CDN.

## Roadmap

- **Phase 2:** route prerendering for SEO, PWA offline, Hindi UI, automatic page-edge detection for Scan, more OCR languages
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
