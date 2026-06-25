// Generates the PWA PNG icons (dependency-free) into /public.
// Green background (#3a5a40) with a white "O" ring - the Optix mark.
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(outDir, { recursive: true })

const BG = [0x3a, 0x5a, 0x40] // hunter green
const FG = [0xff, 0xff, 0xff]

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0, 0)
  return Buffer.concat([len, body, crc])
}

function makePng(size, { outer, inner, padBg }) {
  const cx = size / 2
  const cy = size / 2
  const ro = size * outer
  const ri = size * inner
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let p = 0
  for (let y = 0; y < size; y++) {
    raw[p++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      let c = BG
      // ring (the "O")
      if (d <= ro && d >= ri) c = FG
      raw[p++] = c[0]
      raw[p++] = c[1]
      raw[p++] = c[2]
      raw[p++] = 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  return png
}

const ring = { outer: 0.36, inner: 0.23 }
const maskRing = { outer: 0.3, inner: 0.19 } // more padding for maskable safe zone

writeFileSync(join(outDir, 'icon-192.png'), makePng(192, ring))
writeFileSync(join(outDir, 'icon-512.png'), makePng(512, ring))
writeFileSync(join(outDir, 'maskable-512.png'), makePng(512, maskRing))
writeFileSync(join(outDir, 'apple-touch-icon.png'), makePng(180, ring))
console.log('icons written to', outDir)
