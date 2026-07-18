// GitHub Pages SPA fallback: serve index.html for unknown routes via 404.html
import { copyFileSync, writeFileSync } from 'node:fs'

copyFileSync('dist/index.html', 'dist/404.html')
writeFileSync('dist/.nojekyll', '')
console.log('spa-fallback: wrote dist/404.html and dist/.nojekyll')
