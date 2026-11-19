import { relojMexico } from '@shared/reloj'
import type { DemoData } from '@shared/types'
import { fechaDia } from './format'

function parse(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function iso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

export function picoPorcentaje(data: DemoData, fecha: string, laboratorioId: string) {
  const laboratorio = data.laboratorios.find((item) => item.id === laboratorioId)
  if (!laboratorio?.capacidad) return 0
  const sesiones = data.sesiones.filter((sesion) => sesion.fecha === fecha && sesion.laboratorioId === laboratorioId && sesion.estado !== 'programada')
  let pico = 0
  for (const sesion of sesiones) {
    const asistencia = data.ingresos.filter((ingreso) => ingreso.sesionId === sesion.id).length
    if (asistencia > pico) pico = asistencia
  }
  return Math.min(100, Math.round((pico / laboratorio.capacidad) * 100))
}

export function serieDiaria(data: DemoData, dias: number) {
  const fin = parse(relojMexico().fecha)
  const labels: string[] = []
  const lab1: number[] = []
  const lab2: number[] = []
  for (let offset = dias - 1; offset >= 0; offset -= 1) {
    const fecha = iso(addDays(fin, -offset))
    labels.push(fechaDia(fecha))
    lab1.push(picoPorcentaje(data, fecha, 'lab-1'))
    lab2.push(picoPorcentaje(data, fecha, 'lab-2'))
  }
  return { labels, lab1, lab2 }
}

export function serieSemanal(data: DemoData, semanas: number) {
  const fin = parse(relojMexico().fecha)
  const mondayOffset = fin.getDay() === 0 ? -6 : 1 - fin.getDay()
  const lunesActual = addDays(fin, mondayOffset)
  const labels: string[] = []
  const lab1: number[] = []
  const lab2: number[] = []

  for (let index = semanas - 1; index >= 0; index -= 1) {
    const start = addDays(lunesActual, -7 * index)
    const dias: string[] = []
    for (let day = 0; day < 5; day += 1) {
      const fecha = addDays(start, day)
      if (fecha <= fin) dias.push(iso(fecha))
    }
    const promedio = (laboratorioId: string) => {
      if (!dias.length) return 0
      const total = dias.reduce((sum, fecha) => sum + picoPorcentaje(data, fecha, laboratorioId), 0)
      return Math.round(total / dias.length)
    }
    labels.push(fechaDia(iso(start)))
    lab1.push(promedio('lab-1'))
    lab2.push(promedio('lab-2'))
  }
  return { labels, lab1, lab2 }
}

export function serieMensual(data: DemoData) {
  const fin = parse(relojMexico().fecha)
  const labels: string[] = []
  const lab1: number[] = []
  const lab2: number[] = []
  const cursor = new Date(fin.getFullYear(), fin.getMonth() - 3, 1)

  for (let index = 0; index < 4; index += 1) {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const dias: string[] = []
    for (let day = 1; day <= 31; day += 1) {
      const fecha = new Date(year, month, day)
      if (fecha.getMonth() !== month || fecha > fin) continue
      const weekday = fecha.getDay()
      if (weekday !== 0 && weekday !== 6) dias.push(iso(fecha))
    }
    const promedio = (laboratorioId: string) => {
      if (!dias.length) return 0
      const total = dias.reduce((sum, fecha) => sum + picoPorcentaje(data, fecha, laboratorioId), 0)
      return Math.round(total / dias.length)
    }
    labels.push(`${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][month]} ${year}`)
    lab1.push(promedio('lab-1'))
    lab2.push(promedio('lab-2'))
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return { labels, lab1, lab2 }
}

export function rangoDe(periodo: 'dia' | 'semana' | 'mes') {
  const hasta = relojMexico().fecha
  const fin = parse(hasta)
  if (periodo === 'dia') return { desde: iso(addDays(fin, -9)), hasta }
  if (periodo === 'semana') return { desde: iso(addDays(fin, -41)), hasta }
  return { desde: iso(new Date(fin.getFullYear(), fin.getMonth() - 3, 1)), hasta }
}

export function ingresosEnRango(data: DemoData, desde: string, hasta: string) {
  return data.ingresos.filter((ingreso) => ingreso.fecha >= desde && ingreso.fecha <= hasta)
}
