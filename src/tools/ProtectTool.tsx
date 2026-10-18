import { useState } from 'react'
import { FileText } from 'lucide-react'
import { getTool } from '../toolRegistry'
import { ToolShell } from '../components/ToolShell'
import { FileDrop } from '../components/FileDrop'
import { Field } from '../components/controls'
import { PasswordInput } from '../components/PasswordInput'
import { ErrorAlert } from '../components/ErrorAlert'
import { ResultCard } from '../components/ResultCard'
import { protectPdf } from '../lib/pdf/security'
import { friendlyError } from '../lib/pdf/errors'
import { formatBytes, outputName } from '../lib/format'

function Check({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-emerald-600"
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  )
}

export default function ProtectTool() {
  const tool = getTool('protect')
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [allowPrint, setAllowPrint] = useState(true)
  const [allowCopy, setAllowCopy] = useState(true)
  const [allowEdit, setAllowEdit] = useState(true)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; data: Uint8Array } | null>(null)

  function reset() {
    setFile(null)
    setPassword('')
    setConfirm('')
    setResult(null)
    setError(null)
  }

  const mismatch = confirm.length > 0 && confirm !== password
  const ready = !!password && password === confirm

  async function run() {
    if (!file || !ready) return
    setError(null)
    setBusy(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const data = await protectPdf(bytes, { password, allowPrint, allowCopy, allowEdit })
      setResult({ name: outputName(file.name, 'protected'), data })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolShell tool={tool}>
      {result ? (
        <ResultCard
          files={[result]}
          onReset={reset}
          note="Keep your password safe — nobody, including PDFCraft, can recover it for you."
        />
      ) : !file ? (
        <FileDrop kind="pdf" onFiles={(f) => setFile(f[0])} title="Select a PDF" />
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

          <div className="card space-y-4">
            <Field label="Password">
              <PasswordInput value={password} onChange={setPassword} autoFocus placeholder="Choose a password" testId="password" />
            </Field>
            <Field label="Repeat password">
              <PasswordInput value={confirm} onChange={setConfirm} onEnter={run} placeholder="Type it again" testId="password-confirm" />
            </Field>
            {mismatch && <p className="text-sm text-red-600">The passwords don’t match.</p>}
            {password.length > 0 && password.length < 6 && (
              <p className="text-xs text-amber-700">Short passwords are easy to guess — 8+ characters is safer.</p>
            )}

            <div className="space-y-3 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700">After opening, people can:</p>
              <Check label="Print" hint="Print the document" checked={allowPrint} onChange={setAllowPrint} />
              <Check label="Copy text" hint="Select and copy text and images" checked={allowCopy} onChange={setAllowCopy} />
              <Check label="Edit" hint="Change pages, fill forms, add comments" checked={allowEdit} onChange={setAllowEdit} />
              <p className="text-xs text-slate-500">
                Restrictions are honored by standard PDF readers (Acrobat, browsers, phones) but are not a strong
                security barrier — the password itself is what keeps the file private.
              </p>
            </div>
          </div>

          <button className="btn-primary w-full" disabled={busy || !ready} onClick={run} data-testid="action-button">
            Protect PDF
          </button>
          <p className="text-center text-xs text-slate-500">Encrypted with AES-256, the strongest standard PDF encryption.</p>
          {busy && <p className="animate-pulse text-sm text-slate-500">Encrypting…</p>}
          {error && <ErrorAlert message={error} />}
        </div>
      )}
    </ToolShell>
  )
}
