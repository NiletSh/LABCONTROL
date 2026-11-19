import type { FiltrosInforme, FormatoInforme, Membrete, VistaInforme } from '@shared/informes'
import type { DocumentoInstitucional, ExtensionInforme, TipoInstitucional } from '@shared/institucional'
import type { DemoData } from '@shared/types'
import type { Revision } from '@shared/validate'
import { leerToken } from './sesion'

const API_NUBE = 'https://labcontrol-kvpg.onrender.com'

export function rutaApi(ruta: string) {
  const publicada = import.meta.env.PROD ? API_NUBE : ''
  const base = (import.meta.env.VITE_API_URL || publicada).replace(/\/$/, '')
  return `${base}${ruta}`
}

function cabeceras() {
  const token = leerToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function validarEnServidor(tipo: string, datos: unknown) {
  try {
    const response = await fetch(rutaApi('/api/validar'), {
      method: 'POST',
      headers: cabeceras(),
      body: JSON.stringify({ tipo, datos }),
    })
    const text = await response.text()
    const result = JSON.parse(text) as Revision
    if (!result || typeof result.ok !== 'boolean') return { online: false as const }
    return { online: true as const, result }
  } catch {
    return { online: false as const }
  }
}

export async function vistaInforme(id: string, filtros: FiltrosInforme) {
  const response = await fetch(rutaApi('/api/informes/vista'), {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({ id, filtros }),
  })
  const body = await response.json() as VistaInforme & { message?: string }
  if (!response.ok) throw new Error(body.message ?? 'No se pudo preparar la vista previa.')
  return body
}

export async function vistaInstitucional(tipo: TipoInstitucional, extension: ExtensionInforme, filtros: FiltrosInforme, membrete: Membrete) {
  const response = await fetch(rutaApi('/api/informes/institucional'), {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({ institucional: { tipo, extension }, filtros, membrete }),
  })
  const body = await response.json() as DocumentoInstitucional & { message?: string }
  if (!response.ok) throw new Error(body.message ?? 'No se pudo preparar el informe.')
  return body
}

export async function descargarInforme(id: string, formato: FormatoInforme, filtros: FiltrosInforme, membrete: Membrete, logo: string, institucional?: { tipo: TipoInstitucional; extension: ExtensionInforme }) {
  const response = await fetch(rutaApi('/api/informes/archivo'), {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({ id, formato, filtros, membrete, logo: formato === 'pdf' || formato === 'docx' ? logo : '', institucional }),
  })
  if (!response.ok) {
    let message = 'No se pudo generar el archivo.'
    try {
      const body = await response.json() as { message?: string }
      if (body.message) message = body.message
    } catch {
      /* el cuerpo no trae JSON */
    }
    throw new Error(message)
  }
  await guardarDescarga(response, `LAB-CONTROL.${formato}`)
}

export async function descargarExcel(filas: unknown[], filtros: string[]) {
  const response = await fetch(rutaApi('/api/reportes/excel'), {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({ filas, filtros }),
  })
  if (!response.ok) {
    let message = 'No se pudo generar el archivo de Excel.'
    try {
      const body = await response.json() as { message?: string }
      if (body.message) message = body.message
    } catch {
      /* el cuerpo no trae JSON */
    }
    throw new Error(message)
  }
  await guardarDescarga(response, 'LAB-CONTROL-ingresos.xlsx')
}

export async function operarEnServidor(tipo: string, datos: unknown, ids: string[], accion: string) {
  const response = await fetch(rutaApi('/api/operacion'), {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({ tipo, datos, ids, accion }),
  })
  const body = await response.json() as Revision & { data?: DemoData; claveTemporal?: string; message?: string }
  return { status: response.status, body }
}

export async function avisarOlvido(correo: string) {
  const response = await fetch(rutaApi('/api/sesion/olvido'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo }),
  })
  const body = await response.json() as { ok?: boolean; message?: string }
  return { status: response.status, body }
}

export interface AvisoClave {
  id: string
  usuarioId: string
  nombre: string
  correo: string
  creado: string
}

export async function avisosDeClave() {
  const response = await fetch(rutaApi('/api/claves/avisos'), { headers: cabeceras() })
  const body = await response.json() as { ok?: boolean; avisos?: AvisoClave[]; message?: string }
  if (!response.ok) throw new Error(body.message ?? 'No se pudieron leer los avisos.')
  return body.avisos ?? []
}

export async function enviarClavePorCorreo(usuarioId: string) {
  const response = await fetch(rutaApi('/api/claves/enviar'), {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({ usuarioId }),
  })
  const body = await response.json() as {
    ok?: boolean
    message?: string
    claveTemporal?: string
    enviado?: boolean
    correo?: string
    nombre?: string
  }
  return { status: response.status, body }
}

export async function cambiarClaveEnServidor(nueva: string, actual: string) {
  const response = await fetch(rutaApi('/api/sesion/clave'), {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({ nueva, actual }),
  })
  const body = await response.json() as { ok: boolean; message?: string }
  return { status: response.status, body }
}

async function guardarDescarga(response: Response, respaldo: string) {
  const blob = await response.blob()
  const header = response.headers.get('Content-Disposition') ?? ''
  const match = header.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? respaldo
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
