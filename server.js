import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'

const PORT = process.env.PORT || 3000
const DIR = join(import.meta.dirname, '.output', 'static')

const TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webp': 'image/webp',
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  let filePath = join(DIR, url.pathname === '/' ? 'index.html' : url.pathname)

  try {
    const data = await readFile(filePath)
    const ext = extname(filePath)
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' })
    res.end(data)
  } catch {
    // SPA fallback — serve index.html for all routes
    try {
      const data = await readFile(join(DIR, 'index.html'))
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(data)
    } catch {
      res.writeHead(404)
      res.end('Not found')
    }
  }
}).listen(PORT, () => console.log(`Listening on :${PORT}`))
