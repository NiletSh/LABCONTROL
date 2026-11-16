import type { IncomingMessage, ServerResponse } from 'node:http'
import app from '../backend/src/index.ts'

export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? '/'
  if (!url.startsWith('/api')) {
    const encabezado = req.headers['x-forwarded-uri']
    const original = Array.isArray(encabezado) ? encabezado[0] : encabezado
    if (typeof original === 'string' && original.startsWith('/api')) req.url = original
    else req.url = url === '/' ? '/api' : `/api${url.startsWith('/') ? url : `/${url}`}`
  }
  return app(req, res)
}
