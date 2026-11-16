import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public')

function crc32(buffer) {
  let crc = ~0
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index]
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}

function inRoundRect(x, y, x0, y0, x1, y1, radius) {
  if (x < x0 || y < y0 || x >= x1 || y >= y1) return false
  const dx = x < x0 + radius ? x0 + radius - x : x >= x1 - radius ? x - (x1 - radius - 1) : 0
  const dy = y < y0 + radius ? y0 + radius - y : y >= y1 - radius ? y - (y1 - radius - 1) : 0
  return dx * dx + dy * dy <= radius * radius
}

function paint(x, y, size) {
  const navy = [11, 31, 58, 255]
  const light = [147, 197, 253, 255]
  const x0 = Math.round(size * 0.24)
  const y0 = Math.round(size * 0.2)
  const x1 = Math.round(size * 0.76)
  const y1 = Math.round(size * 0.6)
  const radius = Math.round(size * 0.05)
  if (inRoundRect(x, y, x0, y0, x1, y1, radius)) {
    const inset = Math.max(3, Math.round(size * 0.035))
    if (!inRoundRect(x, y, x0 + inset, y0 + inset, x1 - inset, y1 - inset, Math.max(1, radius - inset))) return light
    return [255, 255, 255, 255]
  }
  const standTop = y1
  const standBottom = Math.round(size * 0.7)
  if (x >= Math.round(size * 0.46) && x < Math.round(size * 0.54) && y >= standTop && y < standBottom) return light
  if (inRoundRect(x, y, Math.round(size * 0.34), standBottom, Math.round(size * 0.66), Math.round(size * 0.76), Math.round(size * 0.03))) {
    return light
  }
  return navy
}

function png(size) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y += 1) {
    const row = y * stride
    raw[row] = 0
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y, size)
      const pixel = row + 1 + x * 4
      raw[pixel] = r
      raw[pixel + 1] = g
      raw[pixel + 2] = b
      raw[pixel + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'pwa-192.png'), png(192))
fs.writeFileSync(path.join(outDir, 'pwa-512.png'), png(512))
console.log('Iconos PWA generados en frontend/public')
