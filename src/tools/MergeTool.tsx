import { useState } from 'react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { AddFilesButton, FileDrop } from '../components/FileDrop'
import { SortableFileList, type FileItem } from '../components/SortableFileList'
import { Progress } from '../components/Progress'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard } from '../components/ResultCard'
import { mergePdfs } from '../lib/pdf/merge'
import { friendlyError } from '../lib/pdf/errors'
import { outputName } from '../lib/format'

export default function MergeTool() {
  const tool = getTool('merge')
  const [items, setItems] = useState<FileItem[]>([])
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; data: Uint8Array } | null>(null)

  const addFiles = (files: File[]) =>
    setItems((prev) => [...prev, ...files.map((f) => ({ uid: crypto.randomUUID(), file: f }))])

  function reset() {
    setItems([])
    setResult(null)
    setError(null)
  }

  async function run() {
    setError(null)
    setBusy({ done: 0, total: items.length })
    try {
      const buffers: Uint8Array[] = []
      for (const it of items) buffers.push(new Uint8Array(await it.file.arrayBuffer()))
      const data = await mergePdfs(buffers, (done, total) => setBusy({ done, total }))
      setResult({ name: outputName(items[0].file.name, 'merged'), data })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <ToolShell tool={tool}>
      {result ? (
        <ResultCard files={[result]} onReset={reset} />
      ) : items.length === 0 ? (
        <FileDrop kind="pdf" multiple onFiles={addFiles} title="Select PDF files" subtitle="or drop them here — at least 2" />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Drag files to set the merge order.</p>
          <SortableFileList items={items} onChange={setItems} />
          <div className="flex flex-wrap items-center gap-3">
            <AddFilesButton kind="pdf" onFiles={addFiles} />
            <button className="btn-primary" disabled={items.length < 2 || !!busy} onClick={run}>
              Merge {items.length} PDF{items.length === 1 ? '' : 's'}
            </button>
          </div>
          {busy && <Progress label="Merging" done={busy.done} total={busy.total} />}
          {error && <ErrorAlert message={error} />}
        </div>
      )}
    </ToolShell>
  )
}
