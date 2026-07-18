import { useState } from 'react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { FileDrop } from '../components/FileDrop'
import { Progress } from '../components/Progress'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard } from '../components/ResultCard'
import { usePdfDoc } from '../components/usePdfDoc'
import { compressLossless } from '../lib/pdf/compressLossless'
import { rasterCompress } from '../lib/browser/render'
import { friendlyError } from '../lib/pdf/errors'
import { formatBytes, outputName } from '../lib/format'

type Preset = 'recommended' | 'extreme' | 'lossless'

const PRESETS: { id: Preset; title: string; desc: string }[] = [
  {
    id: 'recommended',
    title: 'Recommended',
    desc: 'Good quality, big savings. Pages are re-rendered at 120 DPI — text stops being selectable.',
  },
  {
    id: 'extreme',
    title: 'Extreme',
    desc: 'Smallest file (96 DPI, stronger JPEG). Best for upload limits on portals, WhatsApp and email.',
  },
  {
    id: 'lossless',
    title: 'Lossless',
    desc: 'Only rebuilds the file structure. Text stays selectable; savings are modest.',
  },
]

export default function CompressTool() {
  const tool = getTool('compress')
  const [file, setFile] = useState<File | null>(null)
  const { doc, bytes, error: loadError, loading } = usePdfDoc(file)
  const [preset, setPreset] = useState<Preset>('recommended')
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; data: Uint8Array } | null>(null)

  function reset() {
    setFile(null)
    setResult(null)
    setError(null)
  }

  async function run() {
    if (!bytes || !file || !doc) return
    setError(null)
    setBusy({ done: 0, total: preset === 'lossless' ? 1 : doc.numPages })
    try {
      const data =
        preset === 'lossless'
          ? await compressLossless(bytes)
          : await rasterCompress(bytes, {
              dpi: preset === 'recommended' ? 120 : 96,
              quality: preset === 'recommended' ? 0.7 : 0.5,
              onProgress: (done, total) => setBusy({ done, total }),
            })
      setResult({ name: outputName(file.name, 'compressed'), data })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(null)
    }
  }

  const note =
    result && file && result.data.length >= file.size
      ? 'This PDF was already very efficient — the result came out no smaller. Keep your original file, or try a different mode.'
      : undefined

  return (
    <ToolShell tool={tool}>
      {result && file ? (
        <ResultCard files={[result]} before={file.size} note={note} onReset={reset} />
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
            <span className="font-medium text-slate-700">{file.name}</span> · {formatBytes(file.size)} ·{' '}
            {doc.numPages} page{doc.numPages === 1 ? '' : 's'}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`card text-left transition ${
                  preset === p.id ? 'border-emerald-500 ring-2 ring-emerald-500' : 'hover:border-slate-300'
                }`}
              >
                <span className="font-semibold text-slate-900">{p.title}</span>
                <span className="mt-1 block text-sm text-slate-500">{p.desc}</span>
              </button>
            ))}
          </div>
          <button className="btn-primary" disabled={!!busy} onClick={run} data-testid="action-button">
            Compress PDF
          </button>
          {busy && <Progress label="Compressing" done={busy.done} total={busy.total} />}
          {error && <ErrorAlert message={error} />}
        </div>
      ) : null}
    </ToolShell>
  )
}
