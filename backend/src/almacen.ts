import { mkdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { aplicarOperacion } from '../../shared/aplicar.ts'
import { getDemo } from '../../shared/demo.ts'
import { puede } from '../../shared/permisos.ts'
import type { DemoData, Rol, Usuario } from '../../shared/types.ts'
import { revisar } from '../../shared/validate.ts'
import { claveTemporal, hashClave, tokenAcceso, verificarClave } from './claves.ts'
import { borrarAcceso, claveTidb, crearAcceso, guardarClave, guardarTidb, leerTidb, revocarTidb, usaTidb, usuarioDeToken } from './tidb.ts'

const raiz = path.dirname(fileURLToPath(import.meta.url))
const carpeta = process.env.VERCEL ? '/tmp' : path.resolve(raiz, '../data')
mkdirSync(carpeta, { recursive: true })

const db = new DatabaseSync(path.join(carpeta, 'lab-control.sqlite'))
db.exec(`
  CREATE TABLE IF NOT EXISTS documento (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS clave (
    usuario_id TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    debe_cambiar INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS acceso (
    token TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    creado TEXT NOT NULL
  );
`)

const CLAVES_SEMILLA: Record<string, string> = {
  'usr-andrea': 'Admin2026',
  'usr-sayle': 'Admin2026',
  'usr-hector': 'Lab2026',
  'usr-claudia': 'Lab2026',
}

function sembrar() {
  const fila = db.prepare('SELECT json FROM documento WHERE id = 1').get() as { json: string } | undefined
  if (fila) return
  const demo = getDemo()
  db.prepare('INSERT INTO documento (id, json) VALUES (1, ?)').run(JSON.stringify(demo))
  const insertar = db.prepare('INSERT INTO clave (usuario_id, hash, debe_cambiar) VALUES (?, ?, 0)')
  for (const usuario of demo.usuarios) {
    const clave = CLAVES_SEMILLA[usuario.id]
    if (clave) insertar.run(usuario.id, hashClave(clave))
  }
}

sembrar()

export interface SesionActiva {
  token: string
  usuario: Usuario
  rol: Rol
  debeCambiar: boolean
}

function leerDocumento() {
  const fila = db.prepare('SELECT json FROM documento WHERE id = 1').get() as { json: string }
  const data = JSON.parse(fila.json) as DemoData
  data.meta.persistido = true
  return data
}

function guardarDocumento(data: DemoData) {
  db.prepare('UPDATE documento SET json = ? WHERE id = 1').run(JSON.stringify(data))
}

async function leer() {
  return usaTidb() ? leerTidb() : leerDocumento()
}

async function guardar(data: DemoData) {
  if (usaTidb()) await guardarTidb(data)
  else guardarDocumento(data)
}

async function claveDe(usuarioId: string) {
  if (usaTidb()) return claveTidb(usuarioId)
  return db.prepare('SELECT hash, debe_cambiar FROM clave WHERE usuario_id = ?').get(usuarioId) as { hash: string; debe_cambiar: number } | undefined
}

export async function leerDatos() {
  return leer()
}

export async function sesionDe(token: string): Promise<SesionActiva | null> {
  if (!token) return null
  const usuarioId = usaTidb()
    ? await usuarioDeToken(token)
    : (db.prepare('SELECT usuario_id FROM acceso WHERE token = ?').get(token) as { usuario_id: string } | undefined)?.usuario_id
  if (!usuarioId) return null
  const data = await leer()
  const usuario = data.usuarios.find((item) => item.id === usuarioId && item.estado === 'activo')
  if (!usuario) return null
  const clave = await claveDe(usuario.id)
  return { token, usuario, rol: usuario.rol, debeCambiar: clave?.debe_cambiar === 1 }
}

export async function entrar(correo: string, clave: string) {
  const data = await leer()
  const usuario = data.usuarios.find((item) => item.correo.toLowerCase() === correo.trim().toLowerCase())
  if (!usuario || usuario.estado !== 'activo') {
    return { ok: false as const, message: 'Correo o clave incorrectos, o la cuenta está inactiva.' }
  }
  const guardada = await claveDe(usuario.id)
  if (!guardada || !verificarClave(clave, guardada.hash)) {
    return { ok: false as const, message: 'Correo o clave incorrectos, o la cuenta está inactiva.' }
  }
  const token = tokenAcceso()
  if (usaTidb()) await crearAcceso(token, usuario.id)
  else db.prepare('INSERT INTO acceso (token, usuario_id, creado) VALUES (?, ?, ?)').run(token, usuario.id, new Date().toISOString())
  await anotar(data, usuario.nombre, 'Inició sesión.')
  return { ok: true as const, token, usuario, debeCambiar: guardada.debe_cambiar === 1, data: await leer() }
}

export async function cerrar(token: string) {
  const sesion = await sesionDe(token)
  if (sesion) {
    const data = await leer()
    await anotar(data, sesion.usuario.nombre, 'Cerró sesión.')
  }
  if (usaTidb()) await borrarAcceso(token)
  else db.prepare('DELETE FROM acceso WHERE token = ?').run(token)
}

export async function cambiarClave(usuarioId: string, nueva: string, actual?: string) {
  const guardada = await claveDe(usuarioId)
  if (!guardada) return { ok: false as const, message: 'Esta cuenta no tiene clave.' }
  if (guardada.debe_cambiar !== 1) {
    if (!actual || !verificarClave(actual, guardada.hash)) return { ok: false as const, message: 'La clave actual no coincide.' }
  }
  if (nueva.trim().length < 8) return { ok: false as const, message: 'La clave nueva debe tener al menos 8 caracteres.' }
  const hash = hashClave(nueva.trim())
  if (usaTidb()) await guardarClave(usuarioId, hash, 0)
  else db.prepare('UPDATE clave SET hash = ?, debe_cambiar = 0 WHERE usuario_id = ?').run(hash, usuarioId)
  const data = await leer()
  const usuario = data.usuarios.find((item) => item.id === usuarioId)
  if (usuario) await anotar(data, usuario.nombre, 'Cambió su clave.')
  return { ok: true as const }
}

async function anotar(data: DemoData, usuario: string, accion: string) {
  const date = new Date()
  const p = (value: number) => String(value).padStart(2, '0')
  data.bitacora.unshift({
    id: `bit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fechaHora: `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`,
    usuario,
    accion,
    origen: 'sesion',
  })
  await guardar(data)
}

async function revocar(usuarioId: string, conservarToken?: string) {
  if (usaTidb()) {
    await revocarTidb(usuarioId, conservarToken)
    return
  }
  if (conservarToken) db.prepare('DELETE FROM acceso WHERE usuario_id = ? AND token != ?').run(usuarioId, conservarToken)
  else db.prepare('DELETE FROM acceso WHERE usuario_id = ?').run(usuarioId)
}

export async function operar(sesion: SesionActiva, tipo: string, datos: Record<string, unknown>, ids: string[], accion: string) {
  const data = await leer()
  if (tipo === 'usuario') {
    const propio = (typeof datos.id === 'string' && datos.id === sesion.usuario.id) || ids[0] === sesion.usuario.id
    if (!puede(sesion.rol, 'usuarios')) {
      if (!propio) return { ok: false as const, status: 403, message: 'No puedes administrar otras cuentas.' }
      if (datos.rol !== sesion.usuario.rol || datos.estado !== sesion.usuario.estado) {
        return { ok: false as const, status: 403, message: 'No puedes cambiar tu rol ni el estado de la cuenta.' }
      }
    }
  }
  const revision = revisar(tipo, datos, data)
  if (!revision.ok) return { ok: false as const, status: revision.conflict ? 409 : 400, revision }
  const copia = structuredClone(data)
  aplicarOperacion(copia, tipo, { ...datos, accion }, ids, sesion.usuario.nombre)
  copia.meta.persistido = true
  await guardar(copia)

  let claveTemporalTexto = ''
  if (tipo === 'usuario') {
    const id = (typeof datos.id === 'string' && datos.id) || ids[0]
    const escrita = typeof datos.clave === 'string' ? datos.clave.trim() : ''
    const generar = datos.generarTemporal === true
    const existe = await claveDe(id)
    const clave = generar || !existe ? (escrita || claveTemporal()) : escrita
    if (clave) {
      const propia = id === sesion.usuario.id
      const temporal = generar || !escrita
      const debeCambiar = propia && !temporal ? 0 : 1
      const hash = hashClave(clave)
      if (usaTidb()) await guardarClave(id, hash, debeCambiar)
      else {
        db.prepare(`
          INSERT INTO clave (usuario_id, hash, debe_cambiar) VALUES (?, ?, ?)
          ON CONFLICT(usuario_id) DO UPDATE SET hash = excluded.hash, debe_cambiar = excluded.debe_cambiar
        `).run(id, hash, debeCambiar)
      }
      if (!propia) await revocar(id)
      else if (temporal) await revocar(id, sesion.token)
      if (temporal) claveTemporalTexto = clave
    }
    const usuario = copia.usuarios.find((item) => item.id === id)
    if (usuario?.estado !== 'activo') await revocar(id)
  }

  return { ok: true as const, data: copia, message: revision.message, claveTemporal: claveTemporalTexto }
}
