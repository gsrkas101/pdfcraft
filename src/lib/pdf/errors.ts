/** Errors with messages that are safe and helpful to show directly in the UI. */
export class PdfError extends Error {}

export class EncryptedPdfError extends PdfError {
  constructor() {
    super('This PDF is password-protected. Remove the password first — an Unlock tool is coming to PDFCraft soon.')
  }
}

export class InvalidPdfError extends PdfError {
  constructor() {
    super("This file doesn't look like a valid PDF, or it may be corrupted.")
  }
}

export function friendlyError(e: unknown): string {
  if (e instanceof PdfError) return e.message
  if (e instanceof Error && e.message) return e.message
  return 'Something went wrong while processing the file.'
}
