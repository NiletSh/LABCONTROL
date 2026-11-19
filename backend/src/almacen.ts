import { aplicarOperacion } from '../../shared/aplicar.ts'
import { puede } from '../../shared/permisos.ts'
import type { DemoData, Rol, Usuario } from '../../shared/types.ts'
import { revisar } from '../../shared/validate.ts'
import { claveTemporal, hashClave, tokenAcceso, verificarClave } from './claves.ts'
import { correoConfigurado, enviarCorreo } from './correo.ts'
import { atenderAvisosClave, borrarAcceso, claveTidb, crearAcceso, crearAvisoClave, guardarClave, guardarTidb, leerTidb, listarAvisosClave, revocarTidb, usaTidb, usuarioDeToken } from './tidb.ts'

export interface SesionActiva {
  token: string
  usuario: Usuario
  rol: Rol
  debeCambiar: boolean
}

function exigirMysql() {
  if (!usaTidb()) throw new Error('Faltan los datos de MySQL.')
}

async function leer() {
  exigirMysql()
  return leerTidb()
}

async function guardar(data: DemoData) {
  exigirMysql()
  await guardarTidb(data)
}

async function claveDe(usuarioId: string) {
  exigirMysql()
  return claveTidb(usuarioId)
}

export async function leerDatos() {
  return leer()
}

export async function sesionDe(token: string): Promise<SesionActiva | null> {
  if (!token) return null
  exigirMysql()
  const usuarioId = await usuarioDeToken(token)
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
  await crearAcceso(token, usuario.id)
  await anotar(data, usuario.nombre, 'Inició sesión.')
  return { ok: true as const, token, usuario, debeCambiar: guardada.debe_cambiar === 1, data: await leer() }
}

export async function cerrar(token: string) {
  const sesion = await sesionDe(token)
  if (sesion) {
    const data = await leer()
    await anotar(data, sesion.usuario.nombre, 'Cerró sesión.')
  }
  if (token) await borrarAcceso(token)
}

const AVISO_OLVIDO = 'Si ese correo está registrado, el administrador ya tiene el aviso.'

export async function pedirRecuperacion(correo: string) {
  const data = await leer()
  const usuario = data.usuarios.find((item) => item.correo.toLowerCase() === correo.trim().toLowerCase())
  if (!usuario || usuario.estado !== 'activo') return { ok: true as const, message: AVISO_OLVIDO }
  const nuevo = await crearAvisoClave(usuario.id)
  if (!nuevo) return { ok: true as const, message: AVISO_OLVIDO }
  await anotar(data, usuario.nombre, 'Pidió una contraseña temporal porque olvidó la suya.')
  const texto = `${usuario.nombre} (${usuario.correo}) olvidó su contraseña de LAB CONTROL. Entra como administrador, abre Usuarios y pulsa Enviar por correo.`
  for (const admin of data.usuarios.filter((item) => item.rol === 'administrador' && item.estado === 'activo')) {
    try {
      await enviarCorreo(admin.correo, 'LAB CONTROL: un encargado olvidó su contraseña', texto)
    } catch (error) {
      console.error('No se pudo avisar por correo al administrador.')
      console.error(error instanceof Error ? error.message : error)
    }
  }
  return { ok: true as const, message: AVISO_OLVIDO }
}

export async function avisosDeClave() {
  return listarAvisosClave()
}

export async function enviarTemporal(usuarioId: string, autor: string) {
  const data = await leer()
  const usuario = data.usuarios.find((item) => item.id === usuarioId)
  if (!usuario || usuario.estado !== 'activo') return { ok: false as const, message: 'Esa cuenta no está activa.' }
  const clave = claveTemporal()
  await guardarClave(usuario.id, hashClave(clave), 1)
  await revocar(usuario.id)
  await atenderAvisosClave(usuario.id)
  await anotar(data, autor, `Generó una contraseña temporal para ${usuario.nombre}.`)
  const texto = [
    `Hola ${usuario.nombre}.`,
    '',
    'Tu contraseña temporal de LAB CONTROL es:',
    '',
    clave,
    '',
    `Entra en https://laboratorioscontrol.vercel.app/ con ${usuario.correo}.`,
    'Al entrar, el sistema te pedirá que elijas una propia.',
    'Si no pediste este cambio, avisa al administrador.',
  ].join('\n')
  let enviado = false
  if (correoConfigurado()) {
    try {
      enviado = await enviarCorreo(usuario.correo, 'LAB CONTROL: contraseña temporal', texto)
    } catch (error) {
      console.error('No se pudo enviar la contraseña temporal.')
      console.error(error instanceof Error ? error.message : error)
    }
  }
  return {
    ok: true as const,
    claveTemporal: clave,
    enviado,
    correoConfigurado: correoConfigurado(),
    correo: usuario.correo,
    nombre: usuario.nombre,
    message: enviado
      ? `Se envió la contraseña a ${usuario.correo}.`
      : 'Gmail todavía no está conectado en el servidor. Ábrelo para enviar el mensaje.',
  }
}

export async function cambiarClave(usuarioId: string, nueva: string, actual?: string) {
  const guardada = await claveDe(usuarioId)
  if (!guardada) return { ok: false as const, message: 'Esta cuenta no tiene clave.' }
  if (guardada.debe_cambiar !== 1) {
    if (!actual || !verificarClave(actual, guardada.hash)) return { ok: false as const, message: 'La clave actual no coincide.' }
  }
  if (nueva.trim().length < 8) return { ok: false as const, message: 'La clave nueva debe tener al menos 8 caracteres.' }
  const hash = hashClave(nueva.trim())
  await guardarClave(usuarioId, hash, 0)
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
  await revocarTidb(usuarioId, conservarToken)
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
      await guardarClave(id, hash, debeCambiar)
      if (!propia) await revocar(id)
      else if (temporal) await revocar(id, sesion.token)
      if (temporal) claveTemporalTexto = clave
    }
    const usuario = copia.usuarios.find((item) => item.id === id)
    if (usuario?.estado !== 'activo') await revocar(id)
  }

  return { ok: true as const, data: copia, message: revision.message, claveTemporal: claveTemporalTexto }
}
