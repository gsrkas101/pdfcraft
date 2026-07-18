import { useRef, useState } from 'react'
import { Plus, Upload } from 'lucide-react'

function matches(file: File, kind: 'pdf' | 'image'): boolean {
  if (kind === 'pdf') return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  return file.type.startsWith('image/')
}

export function FileDrop({
  kind,
  multiple,
  onFiles,
  title,
  subtitle,
}: {
  kind: 'pdf' | 'image'
  multiple?: boolean
  onFiles: (files: File[]) => void
  title: string
  subtitle?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const handle = (list: FileList | null) => {
    if (!list) return
    const files = Array.from(list).filter((f) => matches(f, kind))
    if (files.length) onFiles(multiple ? files : files.slice(0, 1))
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        handle(e.dataTransfer.files)
      }}
      className={`flex flex-col items-center gap-5 rounded-2xl border-2 border-dashed bg-white py-16 text-center shadow-sm transition ${
        over ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300'
      }`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white">
        <Upload className="h-7 w-7" />
      </div>
      <div>
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary text-base">
          {title}
        </button>
        <p className="mt-3 text-sm text-slate-500">{subtitle ?? 'or drop files here'}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={kind === 'pdf' ? '.pdf,application/pdf' : 'image/*'}
        multiple={multiple}
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          handle(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/** Small "add more files" button with its own hidden input. */
export function AddFilesButton({
  kind,
  onFiles,
  label = 'Add more',
}: {
  kind: 'pdf' | 'image'
  onFiles: (files: File[]) => void
  label?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary">
        <Plus className="h-4 w-4" /> {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={kind === 'pdf' ? '.pdf,application/pdf' : 'image/*'}
        multiple
        className="hidden"
        data-testid="add-file-input"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).filter((f) => matches(f, kind))
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
    </>
  )
}
