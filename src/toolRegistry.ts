export type ToolCategory = 'organize' | 'optimize' | 'convert' | 'edit' | 'security'

export interface ToolMeta {
  id: string
  route: string
  title: string
  tagline: string
  category: ToolCategory
}

export const CATEGORY_LABEL: Record<ToolCategory, string> = {
  organize: 'Organize',
  optimize: 'Optimize',
  convert: 'Convert',
  edit: 'Edit',
  security: 'Security',
}

export const TOOLS: ToolMeta[] = [
  { id: 'merge', route: '/merge-pdf', title: 'Merge PDF', tagline: 'Combine multiple PDFs into one, in the order you choose.', category: 'organize' },
  { id: 'split', route: '/split-pdf', title: 'Split PDF', tagline: 'Split a PDF by page ranges, or into chunks of every N pages.', category: 'organize' },
  { id: 'extract', route: '/extract-pages', title: 'Extract pages', tagline: 'Pick pages visually and save them as a new PDF.', category: 'organize' },
  { id: 'remove', route: '/remove-pages', title: 'Remove pages', tagline: 'Delete unwanted pages from your PDF.', category: 'organize' },
  { id: 'organize', route: '/organize-pdf', title: 'Organize PDF', tagline: 'Reorder, rotate and delete pages visually — drag and drop.', category: 'organize' },
  { id: 'compress', route: '/compress-pdf', title: 'Compress PDF', tagline: 'Shrink PDF file size right in your browser.', category: 'optimize' },
  { id: 'jpg-to-pdf', route: '/jpg-to-pdf', title: 'JPG to PDF', tagline: 'Turn JPG, PNG or WebP images into a single PDF.', category: 'convert' },
  { id: 'pdf-to-jpg', route: '/pdf-to-jpg', title: 'PDF to JPG', tagline: 'Export every PDF page as a JPG or PNG image.', category: 'convert' },
  { id: 'scan', route: '/scan-to-pdf', title: 'Scan to PDF', tagline: 'Photograph pages with your phone — straighten, clean up and save as one PDF.', category: 'convert' },
  { id: 'ocr', route: '/ocr-pdf', title: 'OCR PDF', tagline: 'Make scanned PDFs searchable and copyable — English and Hindi.', category: 'convert' },
  { id: 'rotate', route: '/rotate-pdf', title: 'Rotate PDF', tagline: 'Rotate all pages or just the ones you select.', category: 'edit' },
  { id: 'watermark', route: '/add-watermark', title: 'Add watermark', tagline: 'Stamp text or an image over your pages.', category: 'edit' },
  { id: 'page-numbers', route: '/add-page-numbers', title: 'Page numbers', tagline: 'Add customizable page numbers to your PDF.', category: 'edit' },
  { id: 'sign', route: '/sign-pdf', title: 'Sign PDF', tagline: 'Draw, type or upload your signature and place it anywhere — plus dates and text.', category: 'edit' },
  { id: 'crop', route: '/crop-pdf', title: 'Crop PDF', tagline: 'Trim margins or cut pages down to the area you need.', category: 'edit' },
  { id: 'protect', route: '/protect-pdf', title: 'Protect PDF', tagline: 'Add a password with AES-256 encryption, and optionally block printing or copying.', category: 'security' },
  { id: 'unlock', route: '/unlock-pdf', title: 'Unlock PDF', tagline: 'Remove the password and restrictions from a PDF you can open.', category: 'security' },
]

export function getTool(id: string): ToolMeta {
  const tool = TOOLS.find((t) => t.id === id)
  if (!tool) throw new Error(`Unknown tool: ${id}`)
  return tool
}
