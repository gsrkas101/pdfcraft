import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'
import type { ToolMeta } from '../toolRegistry'
import { usePageMeta } from '../hooks/usePageMeta'
import { ToolIcon } from './ToolIcon'

export function ToolShell({ tool, children }: { tool: ToolMeta; children: ReactNode }) {
  usePageMeta(
    `${tool.title} — free & private | PDFCraft`,
    `${tool.tagline} Free, no signup, no limits — runs entirely in your browser.`,
  )
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-emerald-700">
        <ArrowLeft className="h-3.5 w-3.5" /> All tools
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <ToolIcon tool={tool} size="lg" />
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{tool.title}</h1>
      </div>
      <p className="mt-2 max-w-2xl text-slate-600">{tool.tagline}</p>
      <div className="mt-6">{children}</div>
      <p className="mt-12 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
        <Lock className="h-3 w-3" /> Your files never leave your device — everything happens in your browser.
      </p>
    </div>
  )
}
