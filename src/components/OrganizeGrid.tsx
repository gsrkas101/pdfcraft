import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { RotateCw, Trash2 } from 'lucide-react'
import { ThumbCanvas } from './ThumbCanvas'

export interface OrganizeEntry {
  uid: string
  srcIndex: number
  /** extra rotation on top of the page's own: 0 | 90 | 180 | 270 */
  rotation: number
}

function SortablePage({
  entry,
  order,
  doc,
  onRotate,
  onRemove,
}: {
  entry: OrganizeEntry
  order: number
  doc: PDFDocumentProxy
  onRotate: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.uid })
  const odd = entry.rotation % 180 !== 0
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative rounded-lg bg-slate-100 p-1.5 ${
        isDragging ? 'z-10 opacity-75 ring-2 ring-emerald-500' : ''
      }`}
      data-testid={`organize-page-${entry.srcIndex + 1}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab touch-none active:cursor-grabbing">
        <div className="flex items-center justify-center overflow-hidden">
          <div
            className="w-full transition-transform"
            style={{
              transform: entry.rotation ? `rotate(${entry.rotation}deg)${odd ? ' scale(0.72)' : ''}` : undefined,
            }}
          >
            <ThumbCanvas doc={doc} pageIndex={entry.srcIndex} />
          </div>
        </div>
      </div>
      <span className="mt-1 block text-center text-xs text-slate-500">{order}</span>
      <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
        <button
          type="button"
          onClick={onRotate}
          className="rounded bg-white/95 p-1 text-slate-700 shadow hover:bg-white"
          title="Rotate 90°"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded bg-white/95 p-1 text-red-600 shadow hover:bg-white"
          title="Remove page"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function OrganizeGrid({
  doc,
  entries,
  onChange,
}: {
  doc: PDFDocumentProxy
  entries: OrganizeEntry[]
  onChange: (entries: OrganizeEntry[]) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev
    if (!over || active.id === over.id) return
    const from = entries.findIndex((e) => e.uid === active.id)
    const to = entries.findIndex((e) => e.uid === over.id)
    if (from < 0 || to < 0) return
    onChange(arrayMove(entries, from, to))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={entries.map((e) => e.uid)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {entries.map((e, i) => (
            <SortablePage
              key={e.uid}
              entry={e}
              order={i + 1}
              doc={doc}
              onRotate={() =>
                onChange(entries.map((x) => (x.uid === e.uid ? { ...x, rotation: (x.rotation + 90) % 360 } : x)))
              }
              onRemove={() => onChange(entries.filter((x) => x.uid !== e.uid))}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
