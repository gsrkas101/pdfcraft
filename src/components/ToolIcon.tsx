import {
  Combine,
  Crop,
  FileLock2,
  FileScan,
  LockOpen,
  ScanText,
  Signature,
  FileImage,
  FileMinus,
  FileOutput,
  Hash,
  Images,
  LayoutGrid,
  Minimize2,
  RotateCw,
  Scissors,
  Stamp,
  type LucideIcon,
} from 'lucide-react'
import type { ToolCategory, ToolMeta } from '../toolRegistry'

const ICONS: Record<string, LucideIcon> = {
  merge: Combine,
  split: Scissors,
  extract: FileOutput,
  remove: FileMinus,
  organize: LayoutGrid,
  rotate: RotateCw,
  compress: Minimize2,
  'jpg-to-pdf': FileImage,
  'pdf-to-jpg': Images,
  watermark: Stamp,
  'page-numbers': Hash,
  sign: Signature,
  crop: Crop,
  scan: FileScan,
  ocr: ScanText,
  protect: FileLock2,
  unlock: LockOpen,
}

const CAT_BG: Record<ToolCategory, string> = {
  organize: 'bg-emerald-600',
  optimize: 'bg-amber-500',
  convert: 'bg-sky-600',
  edit: 'bg-violet-600',
  security: 'bg-rose-600',
}

export function ToolIcon({ tool, size = 'md' }: { tool: ToolMeta; size?: 'md' | 'lg' }) {
  const Icon = ICONS[tool.id] ?? FileImage
  const box = size === 'lg' ? 'h-11 w-11 rounded-xl' : 'h-9 w-9 rounded-lg'
  const glyph = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'
  return (
    <div className={`${CAT_BG[tool.category]} ${box} flex shrink-0 items-center justify-center text-white`}>
      <Icon className={glyph} strokeWidth={2} />
    </div>
  )
}
