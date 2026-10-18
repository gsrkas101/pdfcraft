import { useEffect, useState } from 'react'
import { FileText, LockOpen } from 'lucide-react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { FileDrop } from '../components/FileDrop'
import { Field } from '../components/controls'
import { PasswordInput } from '../components/PasswordInput'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard } from '../components/ResultCard'
import { inspectLock, unlockPdf, type LockState } from '../lib/pdf/security'
import { friendlyError } from '../lib/pdf/errors'
import { formatBytes, outputName } from '../lib/format'

export default function UnlockTool() {
  const tool = getTool('unlock')
  const [file, setFile] = useState<File | null>(null)
  const [bytes, setBytes] = useState<Uint8Array | null>(null)
  const [state, setState] = useState<LockState | null>(null)
  const [password, setPassword] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; data: Uint8Array } | null>(null)

  useEffect(() => {
    if (!file) return
    let dead = false
    setState(null)
    setError(null)
    void (async () => {
      try {
        const b = new Uint8Array(await file.arrayBuffer())
        const s = await inspectLock(b)
        if (dead) return
        setBytes(b)
        setState(s)
      } catch (e) {
        if (!dead) setError(friendlyError(e))
      }
    })()
    return () => {
      dead = true
    }
  }, [file])

  function reset() {
    setFile(null)
    setBytes(null)
    setState(null)
    setPassword('')
    setResult(null)
    setError(null)
  }

  async function run() {
    if (!bytes || !file) return
    if (state === 'password' && !password) return
    setError(null)
    setBusy(true)
    try {
      const data = await unlockPdf(bytes, state === 'password' ? password : '')
      setResult({ name: outputName(file.name, 'unlocked'), data })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolShell tool={tool}>
      {result ? (
        <ResultCard files={[result]} onReset={reset} note="The password and all restrictions have been removed." />
      ) : !file ? (
        <FileDrop kind="pdf" onFiles={(f) => setFile(f[0])} title="Select a protected PDF" />
      ) : (
        <div className="mx-auto max-w-lg space-y-5">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <FileText className="h-5 w-5 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{file.name}</span>
            <span className="text-xs text-slate-400">{formatBytes(file.size)}</span>
            <button className="text-xs text-slate-500 hover:text-slate-800" onClick={reset}>
              Change
            </button>
          </div>

          {!state && !error && <p className="animate-pulse text-sm text-slate-500">Checking the file…</p>}

          {state === 'none' && (
            <div className="card text-sm text-slate-600">
              This PDF isn’t password-protected and has no restrictions — there’s nothing to unlock.
            </div>
          )}

          {state === 'restrictions-only' && (
            <div className="card space-y-4">
              <p className="text-sm text-slate-600">
                This PDF opens without a password but restricts printing, copying or editing. You can remove those
                restrictions directly.
              </p>
              <button className="btn-primary w-full" disabled={busy} onClick={run} data-testid="action-button">
                <LockOpen className="h-4 w-4" /> Remove restrictions
              </button>
            </div>
          )}

          {state === 'password' && (
            <div className="card space-y-4">
              <Field label="Password">
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  onEnter={run}
                  autoFocus
                  placeholder="The password you open this PDF with"
                  testId="password"
                />
              </Field>
              <button className="btn-primary w-full" disabled={busy || !password} onClick={run} data-testid="action-button">
                <LockOpen className="h-4 w-4" /> Unlock PDF
              </button>
              <p className="text-xs text-slate-500">
                You need the password — PDFCraft removes protection from files you can already open; it doesn’t crack
                passwords. Only unlock documents you own or are allowed to change.
              </p>
            </div>
          )}

          {busy && <p className="animate-pulse text-sm text-slate-500">Unlocking…</p>}
          {error && <ErrorAlert message={error} />}
        </div>
      )}
    </ToolShell>
  )
}
