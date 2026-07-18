import { useState } from 'react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { FileDrop } from '../components/FileDrop'
import { Field, Segmented } from '../components/controls'
import { Progress } from '../components/Progress'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard, type ResultFile } from '../components/ResultCard'
import { usePdfDoc } from '../components/usePdfDoc'
import { pdfToImages } from '../lib/browser/render'
import { friendlyError } from '../lib/pdf/errors'
import { baseName } from '../lib/format'

export default function PdfToJpgTool() {
  const tool = getTool('pdf-to-jpg')
  const [file, setFile] = useState<File | null>(null)
  const { doc, bytes, error: loadError, loading } = usePdfDoc(file)
  const [format, setFormat] = useState<'jpg' | 'png'>('jpg')
  const [dpi, setDpi] = useState<'72' | '150' | '300'>('150')
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResultFile[] | null>(null)

  function reset() {
    setFile(null)
    setResult(null)
    setError(null)
  }

  async function run() {
    if (!bytes || !file || !doc) return
    setError(null)
    setBusy({ done: 0, total: doc.numPages })
    try {
      const pages = await pdfToImages(bytes, {
        format,
        dpi: Number(dpi),
        baseName: baseName(file.name),
        onProgress: (done, total) => setBusy({ done, total }),
      })
      const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
      setResult(pages.map((p) => ({ ...p, mime })))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <ToolShell tool={tool}>
      {result && file ? (
        <ResultCard files={result} onReset={reset} zipName={`${baseName(file.name)}_pages.zip`} />
      ) : !file ? (
        <FileDrop kind="pdf" onFiles={(f) => setFile(f[0])} title="Select a PDF" />
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
        <div className="space-y-5">
          <p className="text-sm text-slate-500">
            <span className="font-medium text-slate-700">{file.name}</span> · {doc.numPages} page
            {doc.numPages === 1 ? '' : 's'} → {doc.numPages} image{doc.numPages === 1 ? '' : 's'}
          </p>
          <div className="card flex flex-wrap gap-6">
            <Field label="Format">
              <Segmented
                options={[
                  { value: 'jpg', label: 'JPG' },
                  { value: 'png', label: 'PNG' },
                ]}
                value={format}
                onChange={setFormat}
              />
            </Field>
            <Field label="Quality">
              <Segmented
                options={[
                  { value: '72', label: 'Screen (72 DPI)' },
                  { value: '150', label: 'Good (150 DPI)' },
                  { value: '300', label: 'Print (300 DPI)' },
                ]}
                value={dpi}
                onChange={setDpi}
              />
            </Field>
          </div>
          <button className="btn-primary" disabled={!!busy} onClick={run} data-testid="action-button">
            Convert to {format.toUpperCase()}
          </button>
          {busy && <Progress label="Rendering pages" done={busy.done} total={busy.total} />}
          {error && <ErrorAlert message={error} />}
        </div>
      ) : null}
    </ToolShell>
  )
}
