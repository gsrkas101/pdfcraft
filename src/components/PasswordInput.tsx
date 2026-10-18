import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoFocus,
  onEnter,
  testId,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoFocus?: boolean
  onEnter?: () => void
  testId?: string
}) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <input
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="new-password"
        spellCheck={false}
        className="w-full rounded-xl border border-slate-300 py-2 pl-3 pr-10 text-sm focus:border-emerald-500 focus:outline-none"
        data-testid={testId}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-700"
        aria-label={shown ? 'Hide password' : 'Show password'}
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}
