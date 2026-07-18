import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FileText, GripVertical, X } from 'lucide-react'
import { formatBytes } from '../lib/format'

export interface FileItem {
  uid: string
  file: File
}

function Row({ item, onRemove }: { item: FileItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.uid })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 ${
        isDragging ? 'z-10 opacity-75 shadow-lg ring-2 ring-emerald-500' : 'shadow-sm'
      }`}
    >
      <span {...attributes} {...listeners} className="cursor-grab touch-none text-slate-400 active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </span>
      <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{item.file.name}</span>
      <span className="shrink-0 text-xs text-slate-400">{formatBytes(item.file.size)}</span>
      <button type="button" onClick={onRemove} className="text-slate-400 hover:text-red-600" title="Remove">
        <X className="h-4 w-4" />
      </button>
    </li>
  )
}

export function SortableFileList({
  items,
  onChange,
}: {
  items: FileItem[]
  onChange: (items: FileItem[]) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function onDragEnd(ev: DragEndEvent) {
    const { active, over } = ev
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.uid === active.id)
    const to = items.findIndex((i) => i.uid === over.id)
    if (from < 0 || to < 0) return
    onChange(arrayMove(items, from, to))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.uid)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {items.map((item) => (
            <Row key={item.uid} item={item} onRemove={() => onChange(items.filter((x) => x.uid !== item.uid))} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
