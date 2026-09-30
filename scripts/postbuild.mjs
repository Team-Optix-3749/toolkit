// Vercel/static hosts serve index.html for "/" by default. TanStack Start's
// SPA build emits _shell.html, so copy it to index.html for a no-config root.
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dir = 'dist/client'
const shell = join(dir, '_shell.html')
const index = join(dir, 'index.html')

if (existsSync(shell)) {
  copyFileSync(shell, index)
  console.log('postbuild: copied _shell.html -> index.html')
  copyFileSync(shell, join(dir, '404.html'))
  console.log('postbuild: copied _shell.html -> 404.html (SPA fallback for GitHub Pages)')
} else {
  console.warn('postbuild: _shell.html not found, skipped')
}
