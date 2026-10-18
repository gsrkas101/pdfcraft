// Password protection runs on @cantoo/pdf-lib, a maintained pdf-lib fork with AES-256
// encryption and decryption. It is only loaded by the Protect and Unlock tools.
import { PDFDocument, PDFName, PDFRawStream, PDFRef } from '@cantoo/pdf-lib'
import { InvalidPdfError, PdfError } from './errors'

export interface ProtectOptions {
  /** needed to open the file */
  password: string
  allowPrint: boolean
  allowCopy: boolean
  allowEdit: boolean
}

export type LockState = 'none' | 'restrictions-only' | 'password'

async function openUndecrypted(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
  } catch {
    throw new InvalidPdfError()
  }
}

async function opensWith(bytes: Uint8Array, password: string): Promise<PDFDocument | null> {
  try {
    return await PDFDocument.load(bytes, { password, updateMetadata: false })
  } catch {
    return null
  }
}

/**
 * The fork keeps the parser's cross-reference and object streams as ordinary objects and
 * would write them back out — stale copies whose old trailer data (including /Encrypt)
 * confuses readers. Their contents are already parsed, so drop them before saving.
 */
function dropParserLeftovers(doc: PDFDocument): void {
  const stale = new Set([PDFName.of('XRef'), PDFName.of('ObjStm')])
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && stale.has(obj.dict.lookup(PDFName.of('Type')) as PDFName)) {
      doc.context.delete(ref)
    }
  }
}

function randomOwnerPassword(): string {
  const a = new Uint8Array(24)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Is the file encrypted, and does it need a password just to open? */
export async function inspectLock(bytes: Uint8Array): Promise<LockState> {
  const doc = await openUndecrypted(bytes)
  if (!doc.isEncrypted) return 'none'
  const open = await opensWith(bytes, '')
  return open && !open.isEncrypted ? 'restrictions-only' : 'password'
}

/** Add an open password (AES-256), optionally blocking printing, copying and editing. */
export async function protectPdf(bytes: Uint8Array, opts: ProtectOptions): Promise<Uint8Array> {
  if (!opts.password) throw new PdfError('Enter a password.')
  const doc = await openUndecrypted(bytes)
  if (doc.isEncrypted) {
    throw new PdfError('This PDF is already password-protected. Unlock it first, then protect it with a new password.')
  }
  dropParserLeftovers(doc)
  const restricted = !opts.allowPrint || !opts.allowCopy || !opts.allowEdit
  doc.encrypt({
    userPassword: opts.password,
    // With restrictions, the owner password must differ from the open password —
    // otherwise opening the file would also lift every restriction.
    ownerPassword: restricted ? randomOwnerPassword() : opts.password,
    permissions: {
      printing: opts.allowPrint ? 'highResolution' : false,
      copying: opts.allowCopy,
      contentAccessibility: true,
      modifying: opts.allowEdit,
      annotating: opts.allowEdit,
      fillingForms: opts.allowEdit,
      documentAssembly: opts.allowEdit,
    },
  })
  return doc.save({ useObjectStreams: false })
}

/** Remove the open password and every restriction. Pass '' for files that only have restrictions. */
export async function unlockPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const raw = await openUndecrypted(bytes)
  if (!raw.isEncrypted) throw new PdfError("This PDF isn't password-protected — there's nothing to unlock.")
  const doc = await opensWith(bytes, password)
  if (!doc || doc.isEncrypted) {
    throw new PdfError(password ? 'Wrong password — please try again.' : 'This PDF needs its password to unlock.')
  }
  dropParserLeftovers(doc)
  const encryptRef = raw.context.trailerInfo.Encrypt
  if (encryptRef instanceof PDFRef) doc.context.delete(encryptRef)
  return doc.save({ useObjectStreams: true })
}
