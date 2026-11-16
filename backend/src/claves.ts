import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function hashClave(clave: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(clave, salt, 32).toString('hex')
  return `${salt}:${hash}`
}

export function verificarClave(clave: string, stored: string) {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const actual = scryptSync(clave, salt, 32)
  const esperado = Buffer.from(hash, 'hex')
  if (actual.length !== esperado.length) return false
  return timingSafeEqual(actual, esperado)
}

export function claveTemporal() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(10)
  return Array.from(bytes, (byte) => alfabeto[byte % alfabeto.length]).join('')
}

export function tokenAcceso() {
  return randomBytes(32).toString('hex')
}
