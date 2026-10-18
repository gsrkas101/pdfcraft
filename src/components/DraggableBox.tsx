import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { DisplayRect } from '../lib/pdf/geometry'

type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const CORNERS: Handle[] = ['nw', 'ne', 'sw', 'se']
const EDGES: Handle[] = ['n', 's', 'e', 'w']

const HANDLE_POS: Record<Exclude<Handle, 'move'>, string> = {
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize',
  sw: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize',
  se: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize',
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize',
  s: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize',
  e: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function resize(s: DisplayRect, h: Handle, dx: number, dy: number, min: number, keepAspect: boolean): DisplayRect {
  if (h === 'move') {
    return { ...s, left: clamp(s.left + dx, 0, 1 - s.width), top: clamp(s.top + dy, 0, 1 - s.height) }
  }
  const right = s.left + s.width
  const bottom = s.top + s.height
  const west = h.includes('w')
  const east = h.includes('e')
  const north = h.includes('n')
  const south = h.includes('s')

  if (keepAspect && h.length === 2) {
    // scale from the opposite corner, limited by the page edges on both axes
    const ratio = s.height / s.width
    const maxW = Math.min(west ? right : 1 - s.left, (north ? bottom : 1 - s.top) / ratio)
    const w = clamp(s.width + (west ? -dx : dx), min, maxW)
    const hgt = w * ratio
    return { left: west ? right - w : s.left, top: north ? bottom - hgt : s.top, width: w, height: hgt }
  }

  let { left, top, width, height } = s
  if (east) width = clamp(s.width + dx, min, 1 - s.left)
  if (west) {
    left = clamp(s.left + dx, 0, right - min)
    width = right - left
  }
  if (south) height = clamp(s.height + dy, min, 1 - s.top)
  if (north) {
    top = clamp(s.top + dy, 0, bottom - min)
    height = bottom - top
  }
  return { left, top, width, height }
}

/** A box you can drag and resize inside its positioned parent; all geometry in 0..1 fractions. */
export function DraggableBox({
  rect,
  onChange,
  keepAspect = false,
  minSize = 0.03,
  handles = 'all',
  className = '',
  style,
  children,
  onActivate,
  testId,
}: {
  rect: DisplayRect
  onChange: (r: DisplayRect) => void
  keepAspect?: boolean
  minSize?: number
  handles?: 'all' | 'corners' | 'none'
  className?: string
  style?: CSSProperties
  children?: ReactNode
  onActivate?: () => void
  testId?: string
}) {
  function start(e: ReactPointerEvent<HTMLElement>, handle: Handle) {
    const container = (e.currentTarget.closest('[data-drag-box]') as HTMLElement | null)?.parentElement
    if (!container || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    onActivate?.()
    const bounds = container.getBoundingClientRect()
    const startRect = rect
    const x0 = e.clientX
    const y0 = e.clientY
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / bounds.width
      const dy = (ev.clientY - y0) / bounds.height
      onChange(resize(startRect, handle, dx, dy, minSize, keepAspect))
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

  const shown = handles === 'none' ? [] : handles === 'all' && !keepAspect ? [...CORNERS, ...EDGES] : CORNERS
  return (
    <div
      data-drag-box
      data-testid={testId}
      className={`absolute cursor-move touch-none ${className}`}
      style={{
        left: `${rect.left * 100}%`,
        top: `${rect.top * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
        ...style,
      }}
      onPointerDown={(e) => start(e, 'move')}
    >
      {children}
      {shown.map((h) => (
        <span
          key={h}
          data-handle={h}
          className={`absolute h-3.5 w-3.5 touch-none rounded-sm border-2 border-emerald-600 bg-white shadow ${HANDLE_POS[h as Exclude<Handle, 'move'>]}`}
          onPointerDown={(e) => start(e, h)}
        />
      ))}
    </div>
  )
}
