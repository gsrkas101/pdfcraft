import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Maximize, RotateCcw, RotateCw, WandSparkles } from 'lucide-react'
import { Field, Segmented } from './controls'
import { FULL_QUAD, type Quad, type ScanEdit, type ScanFilter } from '../lib/browser/scan'

export const FILTERS: { value: ScanFilter; label: string }[] = [
  { value: 'enhance', label: 'Enhanced' },
  { value: 'bw', label: 'B&W document' },
  { value: 'gray', label: 'Grayscale' },
  { value: 'original', label: 'Original' },
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Drag the four corners onto the page's edges; pick rotation and filter. */
export function ScanEditor({
  src,
  initial,
  detect,
  onApply,
  onClose,
}: {
  src: string
  initial: ScanEdit
  /** find the page's corners automatically (null: none found) */
  detect: () => Quad | null
  onApply: (e: ScanEdit) => void
  onClose: () => void
}) {
  const [quad, setQuad] = useState<Quad>(initial.quad)
  const [notFound, setNotFound] = useState(false)
  const [turns, setTurns] = useState(initial.turns)
  const [filter, setFilter] = useState(initial.filter)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function drag(e: ReactPointerEvent, corner: number) {
    const box = boxRef.current
    if (!box) return
    e.preventDefault()
    const r = box.getBoundingClientRect()
    const move = (ev: PointerEvent) => {
      const p = { x: clamp01((ev.clientX - r.left) / r.width), y: clamp01((ev.clientY - r.top) / r.height) }
      setQuad((q) => q.map((c, i) => (i === corner ? p : c)) as Quad)
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const points = quad.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3">
      <div role="dialog" aria-label="Adjust page" className="flex max-h-full w-full max-w-3xl flex-col rounded-2xl bg-white p-4 shadow-xl sm:p-6">
        {notFound ? (
          <p className="mb-3 text-sm text-amber-700" role="status">
            Couldn't find the page edges automatically — drag the corners onto them.
          </p>
        ) : (
          <p className="mb-3 text-sm text-slate-600">Drag the corners onto the page edges.</p>
        )}
        <div className="flex min-h-0 flex-1 items-start justify-center">
          <div ref={boxRef} className="relative touch-none select-none">
            <img src={src} alt="Page photo" draggable={false} className="block max-h-[58vh] max-w-full" />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
              <polygon
                points={points}
                fill="rgba(16,185,129,0.12)"
                stroke="#059669"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {quad.map((p, i) => (
              <span
                key={i}
                onPointerDown={(e) => drag(e, i)}
                data-testid={`corner-${i}`}
                className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-[3px] border-emerald-600 bg-white/80 shadow"
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              />
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <Field label="Filter">
            <Segmented options={FILTERS} value={filter} onChange={setFilter} />
          </Field>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary px-3" onClick={() => setTurns(((turns + 3) % 4) as ScanEdit['turns'])} aria-label="Rotate left">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" className="btn-secondary px-3" onClick={() => setTurns(((turns + 1) % 4) as ScanEdit['turns'])} aria-label="Rotate right">
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                const found = detect()
                if (found) setQuad(found)
                setNotFound(!found)
              }}
              data-testid="auto-detect"
            >
              <WandSparkles className="h-4 w-4" /> Auto-detect
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setQuad(FULL_QUAD)
                setNotFound(false)
              }}
            >
              <Maximize className="h-4 w-4" /> Whole photo
            </button>
          </div>
          {turns !== 0 && <span className="text-xs text-slate-500">Rotated {turns * 90}°</span>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={() => onApply({ quad, turns, filter })} data-testid="apply-edit">
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
