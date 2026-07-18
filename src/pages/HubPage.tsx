import { Link } from 'react-router-dom'
import { Infinity as InfinityIcon, Lock, ShieldCheck, Zap } from 'lucide-react'
import { CATEGORY_LABEL, TOOLS, type ToolCategory } from '../toolRegistry'
import { ToolIcon } from '../components/ToolIcon'
import { usePageMeta } from '../hooks/usePageMeta'

const CATEGORIES: ToolCategory[] = ['organize', 'optimize', 'convert', 'edit']

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is PDFCraft really free? What’s the catch?',
    a: 'No catch. PDFCraft is a static, open-source website — there are no servers doing the work, so there is nothing to pay for and no reason to charge you, show ads, or make you sign up. Your own browser does all the processing.',
  },
  {
    q: 'Are my files uploaded anywhere?',
    a: 'Never. Every tool runs 100% inside your browser using JavaScript/WebAssembly. You can even load a tool, turn on airplane mode, and it will still work. Your documents never touch a server because there is no server.',
  },
  {
    q: 'Are there limits on file size or number of tasks?',
    a: 'No daily limits, no file caps, no watermarks. The only practical limit is your device’s memory for very large PDFs (hundreds of MB).',
  },
  {
    q: 'Can it handle password-protected PDFs?',
    a: 'Not yet — Protect and Unlock tools are on the roadmap, along with Sign, OCR (English + Hindi), Scan to PDF, and Crop.',
  },
]

export default function HubPage() {
  usePageMeta(
    'PDFCraft — Free PDF tools, no signup, 100% private',
    'Merge, split, compress, convert and edit PDFs free — right in your browser. No signup, no limits, no watermarks. Your files never leave your device.',
  )
  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Hero */}
      <section className="py-14 text-center sm:py-20">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Every PDF tool you need. <span className="text-emerald-600">Free, private, no signup.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Merge, split, compress and convert PDFs entirely in your browser. Files never leave your device. No
          accounts, no limits, no watermarks, no ads.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-4 w-4 text-emerald-600" /> No uploads — 100% private
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-emerald-600" /> Instant, works on slow connections
          </span>
          <span className="inline-flex items-center gap-1.5">
            <InfinityIcon className="h-4 w-4 text-emerald-600" /> No daily limits
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Open source
          </span>
        </div>
      </section>

      {/* Tool grid */}
      {CATEGORIES.map((cat) => (
        <section key={cat} className="mb-10">
          <h2 className="mb-4 text-xl font-bold text-slate-900">{CATEGORY_LABEL[cat]}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.filter((t) => t.category === cat).map((t) => (
              <Link
                key={t.id}
                to={t.route}
                className="card flex items-start gap-4 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
              >
                <ToolIcon tool={t} />
                <div>
                  <h3 className="font-semibold text-slate-900">{t.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t.tagline}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {/* Why */}
      <section className="mb-12 grid gap-4 sm:grid-cols-3">
        <div className="card">
          <Lock className="h-6 w-6 text-emerald-600" />
          <h3 className="mt-3 font-semibold text-slate-900">Private by design</h3>
          <p className="mt-1 text-sm text-slate-500">
            Other PDF sites upload your documents to their servers. PDFCraft has no server — your bank statements,
            marksheets and Aadhaar copies stay on your device.
          </p>
        </div>
        <div className="card">
          <InfinityIcon className="h-6 w-6 text-emerald-600" />
          <h3 className="mt-3 font-semibold text-slate-900">No “3 tasks per day”</h3>
          <p className="mt-1 text-sm text-slate-500">
            No task limits, no premium tier, no watermarks, no “upgrade to continue”. Use every tool as many times
            as you want, forever.
          </p>
        </div>
        <div className="card">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          <h3 className="mt-3 font-semibold text-slate-900">Free because it costs ₹0 to run</h3>
          <p className="mt-1 text-sm text-slate-500">
            The site is static and open source. Your browser does the work, so there are no server bills — and
            nothing to charge you for.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-16">
        <h2 className="mb-4 text-xl font-bold text-slate-900">Frequently asked questions</h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="card group p-0">
              <summary className="cursor-pointer list-none px-6 py-4 font-medium text-slate-800 marker:hidden">
                {f.q}
              </summary>
              <p className="px-6 pb-5 text-sm text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
