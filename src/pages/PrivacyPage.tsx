import { usePageMeta } from '../hooks/usePageMeta'

export default function PrivacyPage() {
  usePageMeta('Privacy — PDFCraft', 'PDFCraft privacy: your files never leave your device. No uploads, no tracking, no accounts.')
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Privacy</h1>
      <div className="prose-slate mt-6 space-y-4 text-slate-600">
        <p>
          <strong className="text-slate-900">Your files never leave your device.</strong> Every PDFCraft tool runs
          entirely inside your browser using JavaScript and WebAssembly. There is no upload step and no server that
          could receive your documents — the site is plain static files.
        </p>
        <p>
          <strong className="text-slate-900">No accounts, no tracking.</strong> PDFCraft has no signup, no login, no
          analytics scripts, no ads and no cookies. We cannot see what files you process, because nothing about your
          usage is sent anywhere.
        </p>
        <p>
          <strong className="text-slate-900">Downloads are local.</strong> When you press Download, the file is
          generated in your browser's memory and saved straight to your device.
        </p>
        <p>
          <strong className="text-slate-900">Open source.</strong> Don't take our word for it — the entire source code
          is public on GitHub, and you can verify with your browser's network tab that no file data ever leaves the
          page. You can even use the tools with your internet disconnected.
        </p>
      </div>
    </div>
  )
}
