import { useEffect, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { openPdfJs } from '../lib/browser/pdfjs'

export interface PdfState {
  doc: PDFDocumentProxy | null
  bytes: Uint8Array | null
  error: string | null
  loading: boolean
}

const EMPTY: PdfState = { doc: null, bytes: null, error: null, loading: false }

/** Read a File, open it with pdf.js for previews, keep the raw bytes for the engines. */
export function usePdfDoc(file: File | null): PdfState {
  const [state, setState] = useState<PdfState>(EMPTY)

  useEffect(() => {
    if (!file) {
      setState(EMPTY)
      return
    }
    let dead = false
    let opened: PDFDocumentProxy | null = null
    setState({ doc: null, bytes: null, error: null, loading: true })
    void (async () => {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const doc = await openPdfJs(bytes)
        opened = doc
        if (!dead) setState({ doc, bytes, error: null, loading: false })
      } catch (e) {
        const name = (e as { name?: string } | null)?.name
        const msg =
          name === 'PasswordException'
            ? 'This PDF is password-protected. Remove the password first with the Unlock PDF tool, then try again.'
            : "This file doesn't look like a valid PDF, or it may be corrupted."
        if (!dead) setState({ doc: null, bytes: null, error: msg, loading: false })
      }
    })()
    return () => {
      dead = true
      void opened?.destroy()
    }
  }, [file])

  return state
}
