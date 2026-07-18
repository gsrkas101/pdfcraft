import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-emerald-600">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-500">That page doesn't exist — but all the PDF tools are one click away.</p>
      <Link to="/" className="btn-primary mt-6">
        Browse all tools
      </Link>
    </div>
  )
}
