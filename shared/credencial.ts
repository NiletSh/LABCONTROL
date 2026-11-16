import type { TurnoId } from './types.ts'
import { grupoValido, semestreValido, turnoValido } from './academico.ts'

export interface CredencialQr {
  matricula: string
  nombre: string
  semestre: number | null
  grupo: string
  turnoId: TurnoId | ''
}

const ALIAS: Record<string, 'matricula' | 'nombre' | 'semestre' | 'grupo' | 'turnoId'> = {
  matricula: 'matricula',
  matriculaalumno: 'matricula',
  nocontrol: 'matricula',
  numerodecontrol: 'matricula',
  numerocontrol: 'matricula',
  numcontrol: 'matricula',
  control: 'matricula',
  ncontrol: 'matricula',
  idalumno: 'matricula',
  id: 'matricula',
  clave: 'matricula',
  numero: 'matricula',
  folio: 'matricula',
  nombre: 'nombre',
  nombrecompleto: 'nombre',
  nombrealumno: 'nombre',
  alumno: 'nombre',
  name: 'nombre',
  fn: 'nombre',
  semestre: 'semestre',
  grado: 'semestre',
  grupo: 'grupo',
  turno: 'turnoId',
  turnoid: 'turnoId',
}

const MENORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])

function clave(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function matriculaValida(value: string) {
  return /^(?=.*\d)[A-Z0-9]{6,14}$/.test(value)
}

export function normalizarMatricula(value: string) {
  const compacto = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (matriculaValida(compacto)) return compacto
  const digitos = value.replace(/\D/g, '')
  return matriculaValida(digitos) ? digitos : ''
}

function nombrePresentable(value: string) {
  const limpio = value.replace(/[,|/]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (limpio.length < 5 || !limpio.includes(' ') || !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(limpio)) return ''
  const base = limpio === limpio.toUpperCase() ? limpio.toLocaleLowerCase('es-MX') : limpio
  return base.replace(/(^|[\s'-])(\p{L})(\p{L}*)/gu, (_match, sep: string, inicial: string, resto: string, offset: number) => {
    const palabra = `${inicial}${resto}`.toLocaleLowerCase('es-MX')
    if (offset > 0 && MENORES.has(palabra)) return `${sep}${palabra}`
    return `${sep}${inicial.toLocaleUpperCase('es-MX')}${resto.toLocaleLowerCase('es-MX')}`
  })
}

function turnoDe(value: string): TurnoId | '' {
  const texto = clave(value)
  if (texto === 'm' || texto === 'mat' || texto === 'matutino' || texto === 'manana') return 'matutino'
  if (texto === 'v' || texto === 'ves' || texto === 'vesp' || texto === 'vespertino' || texto === 'tarde') return 'vespertino'
  return turnoValido(texto) ? texto : ''
}

function semestreDe(value: string) {
  const numero = Number(value.replace(/[^\d]/g, ''))
  return semestreValido(numero) ? numero : null
}

function grupoDe(value: string) {
  const grupo = value.trim().toUpperCase()
  return grupoValido(grupo) ? grupo : ''
}

function asignar(bolsa: Map<string, string>, campo: string, valor: string) {
  const destino = ALIAS[clave(campo)]
  if (!destino || !valor.trim() || bolsa.has(destino)) return
  bolsa.set(destino, valor.trim())
}

function absorberObjeto(value: unknown, bolsa: Map<string, string>, profundidad = 0) {
  if (!value || typeof value !== 'object' || profundidad > 3) return
  for (const [campo, item] of Object.entries(value)) {
    if (item && typeof item === 'object') absorberObjeto(item, bolsa, profundidad + 1)
    else if (typeof item === 'string' || typeof item === 'number') asignar(bolsa, campo, String(item))
  }
}

function absorberTexto(texto: string, bolsa: Map<string, string>) {
  if (/^https?:\/\//i.test(texto)) {
    try {
      const url = new URL(texto)
      url.searchParams.forEach((valor, campo) => asignar(bolsa, campo, valor))
      const ultimo = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '')
      if (ultimo) asignar(bolsa, 'matricula', ultimo)
    } catch {
      /* el texto parece una liga, pero no se pudo leer */
    }
  }

  for (const linea of texto.split(/\r?\n/)) {
    const vcard = linea.match(/^\s*(FN|N|NOTE)\s*:(.*)$/i)
    if (vcard) {
      const cuerpo = vcard[2].trim()
      if (/^N$/i.test(vcard[1])) {
        const [apellido = '', nombre = ''] = cuerpo.split(';')
        asignar(bolsa, 'nombre', `${nombre} ${apellido}`.trim())
      } else if (/nota|matricula|control/i.test(cuerpo)) {
        absorberTexto(cuerpo, bolsa)
      } else {
        asignar(bolsa, 'nombre', cuerpo)
      }
    }
    const par = linea.match(/^\s*([^:=]{2,40}?)\s*[:=]\s*(.+)$/)
    if (par) asignar(bolsa, par[1], par[2])
  }

  const partes = texto.split(/[|;~\n\t]+/).map((parte) => parte.trim()).filter(Boolean)
  if (partes.length > 1) {
    for (const parte of partes) {
      const par = parte.match(/^([^:=]{2,40}?)\s*[:=]\s*(.+)$/)
      if (par) asignar(bolsa, par[1], par[2])
    }
  }
}

function armar(bolsa: Map<string, string>, texto: string): CredencialQr | null {
  let matricula = normalizarMatricula(bolsa.get('matricula') ?? '')
  let nombre = nombrePresentable(bolsa.get('nombre') ?? '')
  let semestre = bolsa.has('semestre') ? semestreDe(bolsa.get('semestre') ?? '') : null
  let grupo = grupoDe(bolsa.get('grupo') ?? '')
  let turnoId = turnoDe(bolsa.get('turnoId') ?? '')

  if (!matricula || !nombre || semestre == null || !grupo || !turnoId) {
    const partes = texto.split(/[|;~\n\t,]+/).map((parte) => parte.trim()).filter(Boolean)
    for (const parte of partes) {
      if (!matricula) matricula = normalizarMatricula(parte)
    }
    for (const parte of partes) {
      if (!nombre) nombre = nombrePresentable(parte)
      if (semestre == null && /^\d$/.test(parte)) semestre = semestreDe(parte)
      if (!grupo && /^[A-F]$/i.test(parte)) grupo = grupoDe(parte)
      if (!turnoId && turnoDe(parte)) turnoId = turnoDe(parte)
    }
  }

  if (!matricula && normalizarMatricula(texto)) matricula = normalizarMatricula(texto)
  if (!matricula) return null

  return { matricula, nombre, semestre, grupo, turnoId }
}

const PALABRAS_CREDENTIAL = new Set(['NOMBRE', 'EXPEDIENTE', 'PLANTEL', 'CURP', 'COLEGIO', 'BACHILLERES', 'BACHILLER', 'ESTADO', 'QUERETARO', 'QUEREYARO'])

function lineaCredencial(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function titulo(value: string) {
  const limpio = value.toLocaleLowerCase('es-MX')
  return limpio.charAt(0).toLocaleUpperCase('es-MX') + limpio.slice(1)
}

function palabrasDeNombre(linea: string) {
  const palabras = linea.split(' ').filter((palabra) => /^[A-Z]{4,}$/.test(palabra) && !PALABRAS_CREDENTIAL.has(palabra) && /[AEIOU]/.test(palabra))
  if (palabras.length >= 3) return palabras.slice(-3)
  if (palabras.length === 2) return palabras
  return []
}

/** Saca nombre, expediente y plantel del texto impreso de una credencial. */
export function interpretarCredencialImpresa(raw: string) {
  const lineas = raw.split(/\n/).map(lineaCredencial).filter(Boolean)
  const expediente = normalizarMatricula(raw.match(/\d{8,10}/)?.[0] ?? raw.match(/\d{6,12}/)?.[0] ?? '')
  const indiceNumero = lineas.findIndex((linea) => expediente && linea.replace(/\s/g, '').includes(expediente))
  let nombre = ''
  if (indiceNumero >= 0) {
    for (const delta of [0, -1, 1, -2, 2, -3]) {
      const palabras = palabrasDeNombre(lineas[indiceNumero + delta] ?? '')
      if (palabras.length >= 2) {
        nombre = nombrePresentable(palabras.join(' '))
        break
      }
    }
  }
  if (!nombre) {
    for (const linea of lineas) {
      const palabras = palabrasDeNombre(linea)
      if (palabras.length >= 3) {
        nombre = nombrePresentable(palabras.join(' '))
        break
      }
    }
  }

  let plantel = ''
  const alrededor = indiceNumero >= 0 ? lineas.slice(Math.max(0, indiceNumero - 1), indiceNumero + 3) : lineas
  const largas = alrededor.flatMap((linea) => linea.split(' ')).filter((palabra) => /^[A-Z]{8,}$/.test(palabra) && !PALABRAS_CREDENTIAL.has(palabra) && !nombre.toUpperCase().includes(palabra))
  if (largas.length) plantel = titulo(largas.sort((a, b) => b.length - a.length)[0])

  return { nombre, expediente, plantel }
}

/** Lee matrícula, nombre, semestre, grupo y turno desde el texto de un QR de credencial. */
export function leerCredencialQr(raw: string): CredencialQr | null {
  const texto = raw.replace(/^\uFEFF/, '').trim()
  if (!texto || texto.length > 2000) return null

  const bolsa = new Map<string, string>()
  if (texto.startsWith('{') || texto.startsWith('[')) {
    try {
      absorberObjeto(JSON.parse(texto), bolsa)
    } catch {
      /* no es JSON; se intenta como texto */
    }
  }
  absorberTexto(texto, bolsa)
  return armar(bolsa, texto)
}
