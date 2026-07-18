import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base matches the GitHub Pages project path: https://gsrkas101.github.io/pdfcraft/
export default defineConfig({
  base: '/pdfcraft/',
  plugins: [react(), tailwindcss()],
})
