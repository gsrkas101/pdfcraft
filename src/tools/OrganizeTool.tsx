import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { FileDrop } from '../components/FileDrop'
import { OrganizeGrid, type OrganizeEntry } from '../components/OrganizeGrid'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard } from '../components/ResultCard'
import { usePdfDoc } from '../components/usePdfDoc'
import { reassemblePdf } from '../lib/pdf/organize'
import { friendlyError } from '../lib/pdf/errors'
import { outputName } from '../lib/format'

function initEntries(doc: PDFDocumentProxy): OrganizeEntry[] {
  return Array.from({ length: doc.numPages }, (_, i) => ({
    uid: crypto.randomUUID(),
    srcIndex: i,
    rotation: 0,
  }))
}

export default function OrganizeTool() {
  const tool = getTool('organize')
  const [file, setFile] = useState<File | null>(null)
  const { doc, bytes, error: loadError, loading } = usePdfDoc(file)
  const [entries, setEntries] = useState<OrganizeEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; data: Uint8Array } | null>(null)

  useEffect(() => {
    setEntries(doc ? initEntries(doc) : [])
  }, [doc])

  function reset() {
    setFile(null)
    setResult(null)
    setError(null)
  }

  async function run() {
    if (!bytes || !file) return
    setError(null)
    setBusy(true)
    try {
      const data = await reassemblePdf(
        bytes,
        entries.map((e) => ({ srcIndex: e.srcIndex, rotationDelta: e.rotation })),
      )
      setResult({ name: outputName(file.name, 'organized'), data })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolShell tool={tool}>
      {result ? (
        <ResultCard files={[result]} onReset={reset} />
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
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-500">Drag pages to reorder. Hover a page to rotate or delete it.</p>
            <button className="btn-secondary" onClick={() => setEntries(initEntries(doc))}>
              Reset changes
            </button>
          </div>
          <OrganizeGrid doc={doc} entries={entries} onChange={setEntries} />
          <button className="btn-primary" disabled={busy || entries.length === 0} onClick={run} data-testid="action-button">
            Apply changes ({entries.length} page{entries.length === 1 ? '' : 's'})
          </button>
          {busy && <p className="animate-pulse text-sm text-slate-500">Rebuilding PDF…</p>}
          {error && <ErrorAlert message={error} />}
        </div>
      ) : null}
    </ToolShell>
  )
}
