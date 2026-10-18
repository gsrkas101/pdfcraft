import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Eraser, X } from 'lucide-react'
import '@fontsource/great-vibes/latin-400.css'
import '@fontsource/dancing-script/latin-400.css'
import '@fontsource/caveat/latin-400.css'
import { Segmented } from './controls'
import { AddFilesButton } from './FileDrop'
import { ErrorAlert } from './ErrorAlert'
import { canvasToInk, imageToInk, textToInk, trimCanvas, type InkImage } from '../lib/browser/signature'

const COLORS = { black: '#111827', blue: '#1d4ed8' } as const
type ColorKey = keyof typeof COLORS

const FONTS = [
  { family: '"Great Vibes", cursive', label: 'Great Vibes' },
  { family: '"Dancing Script", cursive', label: 'Dancing Script' },
  { family: 'Caveat, cursive', label: 'Caveat' },
]

const PAD_W = 1000
const PAD_H = 360

function DrawPad({ color, onInk }: { color: string; onInk: (has: boolean, canvas: HTMLCanvasElement) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const pts = useRef<{ x: number; y: number }[]>([])

  useEffect(() => {
    // re-colour existing ink when the colour changes
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = color
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.globalCompositeOperation = 'source-over'
  }, [color])

  function pos(e: ReactPointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * PAD_W, y: ((e.clientY - r.top) / r.height) * PAD_H }
  }

  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // pointer already gone — the stroke still works without capture
    }
    const p = pos(e)
    pts.current = [p]
    const ctx = e.currentTarget.getContext('2d')!
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!pts.current.length) return
    const ctx = e.currentTarget.getContext('2d')!
    const p = pos(e)
    const list = pts.current
    list.push(p)
    if (list.length < 3) return
    // smooth: curve through midpoints of the last three samples
    const [a, b, c] = list.slice(-3)
    ctx.strokeStyle = color
    ctx.lineWidth = 7
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2)
    ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2)
    ctx.stroke()
  }

  function up(e: ReactPointerEvent<HTMLCanvasElement>) {
    pts.current = []
    onInk(true, e.currentTarget)
  }

  function clear() {
    const c = ref.current
    if (!c) return
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    onInk(false, c)
  }

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white">
        <canvas
          ref={ref}
          width={PAD_W}
          height={PAD_H}
          className="block aspect-[25/9] w-full cursor-crosshair touch-none"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          data-testid="sign-pad"
        />
        <div className="pointer-events-none absolute inset-x-8 bottom-10 border-b border-slate-300" />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span>Sign above the line with your mouse, finger or stylus.</span>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 hover:text-slate-800">
          <Eraser className="h-3.5 w-3.5" /> Clear
        </button>
      </div>
    </div>
  )
}

export function SignatureMaker({ onDone, onClose }: { onDone: (ink: InkImage) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'draw' | 'type' | 'upload'>('draw')
  const [colorKey, setColorKey] = useState<ColorKey>('black')
  const [hasInk, setHasInk] = useState(false)
  const padRef = useRef<HTMLCanvasElement | null>(null)
  const [name, setName] = useState('')
  const [font, setFont] = useState(FONTS[0].family)
  const [upload, setUpload] = useState<File | null>(null)
  const [removeBg, setRemoveBg] = useState(true)
  const [uploadInk, setUploadInk] = useState<InkImage | null>(null)
  const uploadInkRef = useRef(uploadInk)
  uploadInkRef.current = uploadInk
  useEffect(
    () => () => {
      if (uploadInkRef.current) URL.revokeObjectURL(uploadInkRef.current.url)
    },
    [],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  useEffect(() => {
    if (!upload) return
    let dead = false
    setError(null)
    imageToInk(upload, removeBg)
      .then((ink) => {
        if (dead) {
          if (ink) URL.revokeObjectURL(ink.url)
          return
        }
        setUploadInk((prev) => {
          if (prev) URL.revokeObjectURL(prev.url)
          return ink
        })
        if (!ink) setError('No signature found in that image — try a darker photo on white paper.')
      })
      .catch((e: Error) => !dead && setError(e.message))
    return () => {
      dead = true
    }
  }, [upload, removeBg])

  const ready = tab === 'draw' ? hasInk : tab === 'type' ? !!name.trim() : !!uploadInk

  async function use() {
    setError(null)
    setBusy(true)
    try {
      let ink: InkImage | null = null
      if (tab === 'draw' && padRef.current) {
        const trimmed = trimCanvas(padRef.current, 6)
        ink = trimmed ? await canvasToInk(trimmed) : null
      } else if (tab === 'type') {
        ink = await textToInk(name.trim(), font, COLORS[colorKey])
      } else {
        ink = uploadInk
        setUploadInk(null) // ownership of the object URL moves to the caller
      }
      if (!ink) {
        setError('Your signature is empty.')
        return
      }
      onDone(ink)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-label="Create your signature" className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Create your signature</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            options={[
              { value: 'draw', label: 'Draw' },
              { value: 'type', label: 'Type' },
              { value: 'upload', label: 'Upload' },
            ]}
            value={tab}
            onChange={(t) => {
              setTab(t)
              setHasInk(false) // the pad remounts empty
              setError(null)
            }}
          />
          {tab !== 'upload' && (
            <div className="flex items-center gap-2">
              {(Object.keys(COLORS) as ColorKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-label={`${k} ink`}
                  title={`${k} ink`}
                  onClick={() => setColorKey(k)}
                  className={`h-7 w-7 rounded-full ring-offset-2 ${colorKey === k ? 'ring-2 ring-emerald-500' : ''}`}
                  style={{ background: COLORS[k] }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          {tab === 'draw' && (
            <DrawPad
              color={COLORS[colorKey]}
              onInk={(has, canvas) => {
                setHasInk(has)
                padRef.current = canvas
              }}
            />
          )}
          {tab === 'type' && (
            <div className="space-y-3">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Type your name"
                maxLength={60}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none"
                data-testid="sign-name"
              />
              <div className="grid gap-2 sm:grid-cols-3">
                {FONTS.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => setFont(f.family)}
                    className={`truncate rounded-xl border px-3 py-3 text-3xl ${
                      font === f.family ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                    style={{ fontFamily: f.family, color: COLORS[colorKey] }}
                    title={f.label}
                  >
                    {name.trim() || 'Signature'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab === 'upload' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <AddFilesButton
                  kind="image"
                  label={upload ? 'Choose another image' : 'Choose image'}
                  onFiles={(f) => setUpload(f[0])}
                />
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={removeBg}
                    onChange={(e) => setRemoveBg(e.target.checked)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  Remove white background
                </label>
              </div>
              <div className="flex h-36 items-center justify-center rounded-xl border border-slate-200 bg-[repeating-conic-gradient(#f1f5f9_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
                {uploadInk ? (
                  <img src={uploadInk.url} alt="Your signature" className="max-h-32 max-w-full object-contain" />
                ) : (
                  <p className="text-sm text-slate-400">A photo of your signature on white paper works best.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {error && <ErrorAlert message={error} />}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={!ready || busy} onClick={use} data-testid="use-signature">
            Use signature
          </button>
        </div>
      </div>
    </div>
  )
}
