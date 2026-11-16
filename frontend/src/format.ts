const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function partes(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function fechaCorta(iso: string) {
  const date = partes(iso)
  return `${date.getDate()} ${MESES[date.getMonth()]} ${date.getFullYear()}`
}

export function fechaDia(iso: string) {
  const date = partes(iso)
  return `${DIAS_CORTOS[date.getDay()]} ${date.getDate()} ${MESES[date.getMonth()]}`
}

export function fechaLarga(iso: string) {
  const date = partes(iso)
  return `${DIAS[date.getDay()]} ${date.getDate()} de ${MESES[date.getMonth()]} de ${date.getFullYear()}`
}

export function fechaHora(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

export function horaDe(value: string) {
  if (value.includes('T')) return value.slice(11, 16)
  return value.slice(0, 5)
}

export function ahoraLocal() {
  const date = new Date()
  const p = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

export function normalizar(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

export function incluye(texto: string, busqueda: string) {
  const needle = normalizar(busqueda)
  if (!needle) return true
  return normalizar(texto).includes(needle)
}

export function iniciales(nombre: string) {
  const partesNombre = nombre.split(' ').filter(Boolean)
  return `${partesNombre[0]?.[0] ?? ''}${partesNombre[1]?.[0] ?? ''}`.toUpperCase()
}
