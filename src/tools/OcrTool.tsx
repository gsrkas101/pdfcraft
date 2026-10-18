import { useState } from 'react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { FileDrop } from '../components/FileDrop'
import { Field, Segmented } from '../components/controls'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard, type ResultFile } from '../components/ResultCard'
import { usePdfDoc } from '../components/usePdfDoc'
import { OCR_LANGS, OcrProgressBar } from '../components/OcrOptions'
import { ocrPdf, type OcrLang, type OcrProgress } from '../lib/browser/ocr'
import { friendlyError } from '../lib/pdf/errors'
import { baseName, outputName } from '../lib/format'

export default function OcrTool() {
  const tool = getTool('ocr')
  const [file, setFile] = useState<File | null>(null)
  const { doc, bytes, error: loadError, loading } = usePdfDoc(file)
  const [lang, setLang] = useState<OcrLang>('eng')
  const [skipText, setSkipText] = useState(true)

  const [progress, setProgress] = useState<OcrProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ files: ResultFile[]; note: string } | null>(null)

  function reset() {
    setFile(null)
    setResult(null)
    setError(null)
  }

  async function run() {
    if (!bytes || !file) return
    setError(null)
    setProgress({ page: 1, total: doc?.numPages ?? 1, progress: 0, status: 'Starting' })
    try {
      const r = await ocrPdf(bytes, { lang, skipTextPages: skipText, onProgress: setProgress })
      setResult({
        files: [
          { name: outputName(file.name, 'searchable'), data: r.pdf },
          { name: `${baseName(file.name)}.txt`, data: new TextEncoder().encode(r.text), mime: 'text/plain' },
        ],
        note: r.skippedPages
          ? `Recognised ${r.ocrPages} page${r.ocrPages === 1 ? '' : 's'}; ${r.skippedPages} already had text and were left as they were.`
          : `Recognised ${r.ocrPages} page${r.ocrPages === 1 ? '' : 's'}. You can now search and copy the text.`,
      })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setProgress(null)
    }
  }

  return (
    <ToolShell tool={tool}>
      {result ? (
        <ResultCard files={result.files} note={result.note} onReset={reset} zipName={`${baseName(file?.name ?? 'ocr')}-ocr.zip`} />
      ) : !file ? (
        <FileDrop kind="pdf" onFiles={(f) => setFile(f[0])} title="Select a scanned PDF" />
      ) : loading ? (
        <p className="animate-pulse text-sm text-slate-500">Reading PDF…</p>
      ) : loadError ? (
        <div>
          <ErrorAlert message={loadError} />
          <button className="btn-secondary mt-4" onClick={reset}>
            Try another file
          </button>
        </div>
      ) : doc ? (
        <div className="mx-auto max-w-xl space-y-5">
          <div className="card space-y-5">
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <p className="min-w-0 truncate">
                <span className="font-medium text-slate-900">{file.name}</span> · {doc.numPages} page
                {doc.numPages === 1 ? '' : 's'}
              </p>
              <button className="shrink-0 text-xs text-slate-500 hover:text-slate-800" onClick={reset} disabled={!!progress}>
                Change
              </button>
            </div>
            <Field label="Document language">
              <Segmented options={OCR_LANGS} value={lang} onChange={setLang} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={skipText}
                onChange={(e) => setSkipText(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
              Skip pages that already have text
            </label>
            <p className="text-xs text-slate-500">
              Your pages look exactly the same — an invisible text layer is added so you can search, select and copy
              text. The first run downloads the OCR engine and language data (about 6 MB) from this site; after that it
              is cached. Expect a few seconds per page.
            </p>
          </div>
          <button className="btn-primary w-full" disabled={!!progress} onClick={run} data-testid="action-button">
            Make searchable
          </button>
          {progress && <OcrProgressBar p={progress} />}
          {error && <ErrorAlert message={error} />}
        </div>
      ) : null}
    </ToolShell>
  )
}
