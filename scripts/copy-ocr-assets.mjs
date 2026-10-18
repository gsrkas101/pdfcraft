// Self-host the OCR engine: copy the Tesseract worker, its LSTM-only WASM cores and the
// language data into public/ocr, so OCR never fetches code or models from a third-party CDN.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`))

const OUT = 'public/ocr'
const files = [
  [join(pkgDir('tesseract.js'), 'dist/worker.min.js'), join(OUT, 'worker.min.js')],
  // tesseract.js picks one of these by the browser's SIMD support (LSTM engine only)
  ...['tesseract-core-lstm', 'tesseract-core-simd-lstm', 'tesseract-core-relaxedsimd-lstm'].map((core) => [
    join(pkgDir('tesseract.js-core'), `${core}.wasm.js`),
    join(OUT, 'core', `${core}.wasm.js`),
  ]),
  ...['eng', 'hin'].map((lang) => [
    join(pkgDir(`@tesseract.js-data/${lang}`), '4.0.0_best_int', `${lang}.traineddata.gz`),
    join(OUT, 'lang', `${lang}.traineddata.gz`),
  ]),
]

let copied = 0
for (const [from, to] of files) {
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  copied++
}
console.log(`copy-ocr-assets: ${copied} copied, ${files.length - copied} up to date in ${OUT}/`)
