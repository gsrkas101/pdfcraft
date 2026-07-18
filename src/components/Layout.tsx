import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Github } from 'lucide-react'
import { CATEGORY_LABEL, TOOLS, type ToolCategory } from '../toolRegistry'

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#059669" />
        <path d="M22 14h14l8 8v28H22z" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
        <path d="M36 14v8h8" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
        <path d="M27 34h10M27 40h10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-lg font-bold tracking-tight text-slate-900">
        PDF<span className="text-emerald-600">Craft</span>
      </span>
    </Link>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])

  const categories: ToolCategory[] = ['organize', 'optimize', 'convert', 'edit']

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Logo />
          <p className="hidden text-sm font-medium text-slate-500 sm:block">
            Free forever · No signup · 100% private
          </p>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-slate-500">
              Every tool runs entirely in your browser. Your files never leave your device — there is no server to
              upload them to.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              By the maker of{' '}
              <a
                href="https://gsrkas101.github.io/resumecraft/"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-emerald-700 hover:underline"
              >
                ResumeCraft
              </a>{' '}
              — a free, no-signup resume builder.
            </p>
          </div>
          {categories.map((cat) => (
            <nav key={cat} aria-label={CATEGORY_LABEL[cat]}>
              <h3 className="text-sm font-semibold text-slate-900">{CATEGORY_LABEL[cat]}</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {TOOLS.filter((t) => t.category === cat).map((t) => (
                  <li key={t.id}>
                    <Link to={t.route} className="text-slate-500 hover:text-emerald-700">
                      {t.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="border-t border-slate-100">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-slate-400">
            <p>Made in India 🇮🇳 · Open source (MIT) · No ads, no tracking</p>
            <div className="flex items-center gap-4">
              <Link to="/privacy" className="hover:text-slate-600">
                Privacy
              </Link>
              <a
                href="https://github.com/gsrkas101/pdfcraft"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-slate-600"
              >
                <Github className="h-3.5 w-3.5" /> GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
