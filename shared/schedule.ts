import type { Reservacion, Sesion } from './types.ts'

export function toMinutes(hora: string) {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

export function fechaValida(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function horaValida(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false
  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

export function rangosSeCruzan(inicioA: string, finA: string, inicioB: string, finB: string) {
  return toMinutes(inicioA) < toMinutes(finB) && toMinutes(inicioB) < toMinutes(finA)
}

export interface SlotHorario {
  laboratorioId: string
  fecha: string
  horaInicio: string
  horaFin: string
}

export function conflictoDeHorario(
  sesiones: Sesion[],
  reservaciones: Reservacion[],
  slot: SlotHorario,
  ignore?: { sesionId?: string; reservacionId?: string },
) {
  if (!horaValida(slot.horaInicio) || !horaValida(slot.horaFin)) return null
  if (toMinutes(slot.horaFin) <= toMinutes(slot.horaInicio)) return null

  for (const sesion of sesiones) {
    if (sesion.id === ignore?.sesionId || sesion.estado === 'cancelada') continue
    if (sesion.laboratorioId !== slot.laboratorioId || sesion.fecha !== slot.fecha) continue
    if (rangosSeCruzan(slot.horaInicio, slot.horaFin, sesion.horaInicio, sesion.horaFin)) {
      return { tipo: 'sesion' as const, id: sesion.id }
    }
  }

  for (const reserva of reservaciones) {
    if (reserva.id === ignore?.reservacionId || reserva.estado === 'rechazada') continue
    if (reserva.laboratorioId !== slot.laboratorioId || reserva.fecha !== slot.fecha) continue
    if (rangosSeCruzan(slot.horaInicio, slot.horaFin, reserva.horaInicio, reserva.horaFin)) {
      return { tipo: 'reservacion' as const, id: reserva.id }
    }
  }

  return null
}

export function desdeMinutos(total: number) {
  const horas = Math.floor(total / 60)
  const minutos = total % 60
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`
}

export function dentroDeRango(inicio: string, fin: string, rangoInicio: string, rangoFin: string) {
  return toMinutes(inicio) >= toMinutes(rangoInicio) && toMinutes(fin) <= toMinutes(rangoFin)
}

export interface OcupacionAgenda {
  tipo: 'sesion' | 'reservacion'
  id: string
  horaInicio: string
  horaFin: string
}

export interface BloqueAgenda {
  horaInicio: string
  horaFin: string
  libre: boolean
  ocupaciones: OcupacionAgenda[]
}

/** Parte la jornada en huecos libres y bloques ocupados, sin inventar horas fuera del turno. */
export function bloquesDeJornada(inicio: string, fin: string, ocupaciones: OcupacionAgenda[]): BloqueAgenda[] {
  if (!horaValida(inicio) || !horaValida(fin) || toMinutes(fin) <= toMinutes(inicio)) return []
  const desde = toMinutes(inicio)
  const hasta = toMinutes(fin)
  const eventos = ocupaciones
    .map((item) => {
      const s = Math.max(desde, toMinutes(item.horaInicio))
      const e = Math.min(hasta, toMinutes(item.horaFin))
      if (e <= s) return null
      return { item, s, e }
    })
    .filter((item): item is { item: OcupacionAgenda; s: number; e: number } => item !== null)
    .sort((a, b) => a.s - b.s || a.e - b.e)

  const bloques: BloqueAgenda[] = []
  let cursor = desde
  for (const evento of eventos) {
    if (evento.s > cursor) {
      bloques.push({
        horaInicio: desdeMinutos(cursor),
        horaFin: desdeMinutos(evento.s),
        libre: true,
        ocupaciones: [],
      })
      cursor = evento.s
    }
    const start = Math.max(evento.s, cursor)
    const ref = { tipo: evento.item.tipo, id: evento.item.id, horaInicio: evento.item.horaInicio, horaFin: evento.item.horaFin }
    if (evento.e <= start) {
      const contenedor = bloques.at(-1)
      if (contenedor && !contenedor.libre) contenedor.ocupaciones.push(ref)
      continue
    }
    const previo = bloques.at(-1)
    if (previo && !previo.libre && toMinutes(previo.horaFin) === start) {
      previo.horaFin = desdeMinutos(evento.e)
      previo.ocupaciones.push(ref)
    } else {
      bloques.push({
        horaInicio: desdeMinutos(start),
        horaFin: desdeMinutos(evento.e),
        libre: false,
        ocupaciones: [ref],
      })
    }
    cursor = evento.e
  }
  if (cursor < hasta) {
    bloques.push({
      horaInicio: desdeMinutos(cursor),
      horaFin: desdeMinutos(hasta),
      libre: true,
      ocupaciones: [],
    })
  }
  return bloques
}

/**
 * Sesión a la que debe ligarse una lectura real.
 * El lector futuro llama esta función con la hora del escaneo; no registra nada por sí misma.
 */
export function sesionDestinoDeIngreso(sesiones: Sesion[], laboratorioId: string, fecha: string, hora: string) {
  if (!fechaValida(fecha) || !horaValida(hora)) return null
  const minuto = toMinutes(hora)
  return sesiones.find((sesion) => (
    sesion.laboratorioId === laboratorioId
    && sesion.fecha === fecha
    && sesion.estado === 'activa'
    && minuto >= toMinutes(sesion.horaInicio)
    && minuto < toMinutes(sesion.horaFin)
  )) ?? null
}

export function fechaIso(date: Date) {
  const p = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

export function fechaDesdeIso(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function sumarDias(iso: string, dias: number) {
  const date = fechaDesdeIso(iso)
  date.setDate(date.getDate() + dias)
  return fechaIso(date)
}

export function inicioDeSemana(iso: string) {
  const date = fechaDesdeIso(iso)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return fechaIso(date)
}

export function diasDeSemana(iso: string) {
  const inicio = inicioDeSemana(iso)
  return Array.from({ length: 7 }, (_, index) => sumarDias(inicio, index))
}

export function celdasDelMes(iso: string) {
  const date = fechaDesdeIso(iso)
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const start = new Date(first)
  start.setDate(1 - ((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, index) => {
    const cell = new Date(start)
    cell.setDate(start.getDate() + index)
    return {
      iso: fechaIso(cell),
      dia: cell.getDate(),
      enMes: cell.getMonth() === date.getMonth(),
    }
  })
}

export function tituloMes(iso: string) {
  const nombre = fechaDesdeIso(iso).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return nombre.charAt(0).toUpperCase() + nombre.slice(1)
}

/** Regla lista para el lector real: un alumno no se registra dos veces en la misma sesión. */
export function esIngresoDuplicado(
  ingresos: { alumnoId: string; sesionId: string }[],
  alumnoId: string,
  sesionId: string,
) {
  return ingresos.some((ingreso) => ingreso.alumnoId === alumnoId && ingreso.sesionId === sesionId)
}
