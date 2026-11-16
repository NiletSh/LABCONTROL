import { nombreTurno } from './academico.ts'
import { desdeMinutos, fechaIso, inicioDeSemana, rangosSeCruzan, sumarDias, toMinutes } from './schedule.ts'
import type { DemoData, EstadoEquipo, EstadoIncidencia, EstadoSesion, TurnoId } from './types.ts'

export const NOTA_FUENTE = 'No hay una base de datos institucional conectada. Las cifras salen del escenario cargado en el servidor de LAB CONTROL y no forman un informe oficial de la preparatoria.'
export const AVISO_ALUMNOS = 'Incluye matrícula y nombre solo para el control de asistencia del laboratorio. Quien descarga el archivo es responsable de no difundirlo.'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export type CategoriaInforme = 'asistencia' | 'utilizacion' | 'equipos' | 'incidencias' | 'sesiones' | 'generales'
export type FormatoInforme = 'xlsx' | 'pdf' | 'docx' | 'csv'

export interface FiltrosInforme {
  desde: string
  hasta: string
  alumno: string
  matricula: string
  semestre: string
  grupo: string
  maestroId: string
  materiaId: string
  laboratorioId: string
  turnoId: string
  estadoSesion: string
  estadoIncidencia: string
  estadoEquipo: string
}

export interface Membrete {
  institucion: string
  encargado: string
  titulo: string
  fecha: string
  departamento: string
  reviso: string
  autorizo: string
}

export interface HechosLaboratorio {
  periodo: string
  filtros: string[]
  laboratorios: { nombre: string; ubicacion: string; estado: string; capacidad: number; equipos: number }[]
  ingresos: number
  alumnosDistintos: number
  sesionesTotal: number
  sesiones: { estado: string; total: number }[]
  porTurno: { turno: string; ingresos: number }[]
  porLaboratorioUso: { laboratorio: string; ingresos: number; alumnos: number }[]
  maestros: { nombre: string; sesiones: number; ingresos: number }[]
  equipos: { id: string; laboratorio: string; estado: string; descripcion: string }[]
  mantenimientos: { fecha: string; equipo: string; laboratorio: string; estadoActual: string; descripcion: string; responsable: string }[]
  incidencias: { fecha: string; hora: string; laboratorio: string; equipo: string; estado: string; reporta: string; descripcion: string }[]
  reservacionesPendientes: number
  bitacora: { fecha: string; hora: string; usuario: string; accion: string }[]
  sesionesDetalle: { fecha: string; horario: string; grupo: string; docente: string; asignatura: string; alumnos: number; laboratorio: string }[]
}

export interface ColumnaInforme {
  key: string
  header: string
  ancho: number
}

export interface ParInforme {
  etiqueta: string
  valor: string
}

export type FilaInforme = Record<string, string | number>

export interface DefinicionInforme {
  id: string
  categoria: CategoriaInforme
  nombre: string
  descripcion: string
  incluyeAlumnos: boolean
  usaPeriodo: boolean
  aplicaAlumno: boolean
  estadoSesion: string
  estadoIncidencia: string
  estadoEquipo: string
}

export interface Informe {
  id: string
  categoria: CategoriaInforme
  nombre: string
  descripcion: string
  titulo: string
  incluyeAlumnos: boolean
  columnas: ColumnaInforme[]
  filas: FilaInforme[]
  totales: ParInforme[]
  resumen: ParInforme[]
  periodo: string
  filtros: string[]
  notaFuente: string
  avisoPrivacidad: string
  advertencia: string
}

export interface VistaInforme {
  id: string
  nombre: string
  descripcion: string
  periodo: string
  filtros: string[]
  notaFuente: string
  avisoPrivacidad: string
  advertencia: string
  columnas: { key: string; header: string }[]
  total: number
  muestra: FilaInforme[]
  totales: ParInforme[]
  resumen: ParInforme[]
  fuente: 'demostracion'
  persistido: false
}

export interface TableroInformes {
  ingresos: number
  alumnosDistintos: number
  labMayor: string
  alumnosTop: { label: string; value: number }[]
  porTurno: { label: string; value: number }[]
  porLaboratorio: { label: string; value: number }[]
  materiasTop: { label: string; value: number }[]
  incidencias: number
  incidenciasPendientes: number
  equipos: { label: string; value: number }[]
}

type Kind =
  | 'detalle' | 'por-dia' | 'por-semana' | 'por-mes' | 'por-alumno' | 'por-grupo' | 'por-materia'
  | 'labs' | 'alumnos-lab' | 'horas' | 'turnos' | 'maestros' | 'materias-uso' | 'comparacion'
  | 'equipos' | 'reparaciones' | 'incidencias' | 'incidencias-lab' | 'incidencias-equipo'
  | 'sesiones' | 'reservaciones' | 'horarios' | 'resumen-dia' | 'resumen-semana' | 'resumen-mes'
  | 'resumen-semestre' | 'estadisticas'

interface Spec extends DefinicionInforme {
  kind: Kind
  orden: 'fecha' | 'matricula' | 'laboratorio'
}

const DETALLE: ColumnaInforme[] = [
  { key: 'fecha', header: 'Fecha', ancho: 14 },
  { key: 'hora', header: 'Hora', ancho: 10 },
  { key: 'matricula', header: 'Matrícula', ancho: 14 },
  { key: 'alumno', header: 'Alumno', ancho: 28 },
  { key: 'semestre', header: 'Semestre', ancho: 12 },
  { key: 'grupo', header: 'Grupo', ancho: 10 },
  { key: 'turno', header: 'Turno', ancho: 14 },
  { key: 'laboratorio', header: 'Laboratorio', ancho: 16 },
  { key: 'maestro', header: 'Maestro', ancho: 26 },
  { key: 'materia', header: 'Materia', ancho: 22 },
  { key: 'clave', header: 'Clave', ancho: 12 },
  { key: 'horario', header: 'Horario', ancho: 14 },
]

const SESION_COLS: ColumnaInforme[] = [
  { key: 'fecha', header: 'Fecha', ancho: 14 },
  { key: 'horario', header: 'Horario', ancho: 14 },
  { key: 'laboratorio', header: 'Laboratorio', ancho: 16 },
  { key: 'turno', header: 'Turno', ancho: 14 },
  { key: 'maestro', header: 'Maestro', ancho: 26 },
  { key: 'materia', header: 'Materia', ancho: 22 },
  { key: 'semestre', header: 'Semestre', ancho: 12 },
  { key: 'grupo', header: 'Grupo', ancho: 10 },
  { key: 'estado', header: 'Estado', ancho: 14 },
  { key: 'ingresos', header: 'Ingresos', ancho: 12 },
]

export const CATALOGO: Spec[] = [
  spec('asistencia-diaria', 'asistencia', 'Asistencia diaria', 'Ingresos agrupados por día.', false, 'por-dia'),
  spec('asistencia-semanal', 'asistencia', 'Asistencia semanal', 'Ingresos agrupados por semana.', false, 'por-semana'),
  spec('asistencia-mensual', 'asistencia', 'Asistencia mensual', 'Ingresos agrupados por mes.', false, 'por-mes'),
  spec('asistencia-alumno', 'asistencia', 'Asistencia por alumno', 'Total de entradas de cada alumno.', true, 'por-alumno'),
  spec('asistencia-matricula', 'asistencia', 'Asistencia por matrícula', 'Cada entrada, identificada por matrícula.', true, 'detalle', 'matricula'),
  spec('asistencia-grupo', 'asistencia', 'Asistencia por semestre y grupo', 'Entradas de cada semestre, grupo y turno.', false, 'por-grupo'),
  spec('asistencia-materia', 'asistencia', 'Asistencia por maestro y materia', 'Entradas de cada materia y su maestro.', false, 'por-materia'),
  spec('historial-laboratorio', 'asistencia', 'Historial de entradas por laboratorio', 'Detalle de quién entró, a qué hora y en qué laboratorio.', true, 'detalle', 'laboratorio'),
  spec('lab-mas-usado', 'utilizacion', 'Laboratorio más utilizado', 'Compara los ingresos de los dos laboratorios.', false, 'labs'),
  spec('alumnos-por-lab', 'utilizacion', 'Alumnos por laboratorio', 'Alumnos distintos y entradas en cada laboratorio.', false, 'alumnos-lab'),
  spec('horarios-ocupacion', 'utilizacion', 'Horarios de mayor ocupación', 'Entradas por hora del día.', false, 'horas'),
  spec('uso-turno', 'utilizacion', 'Uso por turno', 'Actividad del turno matutino y del vespertino.', false, 'turnos'),
  spec('uso-maestro', 'utilizacion', 'Uso por maestro', 'Sesiones e ingresos de cada maestro.', false, 'maestros'),
  spec('uso-materia', 'utilizacion', 'Uso por materia', 'Sesiones e ingresos de cada materia.', false, 'materias-uso'),
  spec('comparacion-labs', 'utilizacion', 'Comparación de laboratorios', 'Ingresos, alumnos y sesiones de Laboratorio 1 y Laboratorio 2.', false, 'comparacion'),
  spec('inventario', 'equipos', 'Inventario de computadoras', 'Lista actual de equipos de ambos laboratorios.', false, 'equipos', 'fecha', false, false),
  spec('equipos-disponibles', 'equipos', 'Equipos disponibles', 'Equipos que hoy están disponibles.', false, 'equipos', 'fecha', false, false, '', '', 'disponible'),
  spec('equipos-ocupados', 'equipos', 'Equipos ocupados', 'Equipos marcados como ocupados en el escenario.', false, 'equipos', 'fecha', false, false, '', '', 'ocupada'),
  spec('equipos-mantenimiento', 'equipos', 'Equipos en mantenimiento', 'Equipos que están en mantenimiento.', false, 'equipos', 'fecha', false, false, '', '', 'mantenimiento'),
  spec('equipos-fuera', 'equipos', 'Equipos fuera de servicio', 'Equipos que no se pueden usar.', false, 'equipos', 'fecha', false, false, '', '', 'fuera_de_servicio'),
  spec('historial-reparaciones', 'equipos', 'Historial de reparaciones', 'Mantenimientos registrados, con responsable y descripción.', false, 'reparaciones', 'fecha', false, true),
  spec('incidencias-registradas', 'incidencias', 'Incidencias registradas', 'Todas las incidencias del periodo.', false, 'incidencias', 'fecha', false),
  spec('incidencias-pendientes', 'incidencias', 'Incidencias pendientes', 'Incidencias que siguen pendientes.', false, 'incidencias', 'fecha', false, true, '', 'pendiente'),
  spec('incidencias-resueltas', 'incidencias', 'Incidencias resueltas', 'Incidencias ya cerradas.', false, 'incidencias', 'fecha', false, true, '', 'resuelta'),
  spec('incidencias-laboratorio', 'incidencias', 'Incidencias por laboratorio', 'Cantidad de incidencias en cada laboratorio.', false, 'incidencias-lab', 'fecha', false),
  spec('incidencias-equipo', 'incidencias', 'Incidencias por equipo', 'Cantidad de incidencias de cada equipo.', false, 'incidencias-equipo', 'fecha', false),
  spec('historial-atencion', 'incidencias', 'Historial de atención', 'Incidencias en orden cronológico, con su estado.', false, 'incidencias', 'fecha', false),
  spec('sesiones-programadas', 'sesiones', 'Sesiones programadas', 'Clases que siguen programadas.', false, 'sesiones', 'fecha', true, true, 'programada'),
  spec('sesiones-finalizadas', 'sesiones', 'Sesiones finalizadas', 'Clases que ya terminaron.', false, 'sesiones', 'fecha', true, true, 'finalizada'),
  spec('sesiones-canceladas', 'sesiones', 'Sesiones canceladas', 'Clases canceladas. Esos horarios quedan libres.', false, 'sesiones', 'fecha', true, true, 'cancelada'),
  spec('reservaciones-maestro', 'sesiones', 'Reservaciones por maestro', 'Solicitudes de cada maestro y su estado.', false, 'reservaciones', 'fecha', false),
  spec('horarios-solicitados', 'sesiones', 'Horarios más solicitados', 'Bloques con más sesiones y reservaciones.', false, 'horarios', 'fecha', false),
  spec('historial-utilizacion', 'sesiones', 'Historial de utilización', 'Cada sesión, con los alumnos que realmente ingresaron.', false, 'sesiones'),
  spec('resumen-diario', 'generales', 'Resumen diario', 'Ingresos, sesiones, incidencias y reservaciones por día.', false, 'resumen-dia'),
  spec('resumen-semanal', 'generales', 'Resumen semanal', 'Actividad agrupada por semana.', false, 'resumen-semana'),
  spec('resumen-mensual', 'generales', 'Resumen mensual', 'Actividad agrupada por mes.', false, 'resumen-mes'),
  spec('resumen-semestral', 'generales', 'Resumen semestral', 'Uso de los laboratorios por semestre escolar, del 1° al 6°.', false, 'resumen-semestre'),
  spec('estadisticas-generales', 'generales', 'Estadísticas generales', 'Indicadores del periodo para la administración de los laboratorios.', false, 'estadisticas'),
]

export const CATEGORIAS: { id: CategoriaInforme; nombre: string }[] = [
  { id: 'asistencia', nombre: 'Asistencia' },
  { id: 'utilizacion', nombre: 'Utilización' },
  { id: 'equipos', nombre: 'Equipos' },
  { id: 'incidencias', nombre: 'Incidencias' },
  { id: 'sesiones', nombre: 'Sesiones' },
  { id: 'generales', nombre: 'Generales' },
]

export function definicionInforme(id: string) {
  return CATALOGO.find((item) => item.id === id) ?? null
}

export function filtrosIniciales(fecha: string): FiltrosInforme {
  return {
    desde: fecha,
    hasta: fecha,
    alumno: '',
    matricula: '',
    semestre: '',
    grupo: '',
    maestroId: '',
    materiaId: '',
    laboratorioId: '',
    turnoId: '',
    estadoSesion: '',
    estadoIncidencia: '',
    estadoEquipo: '',
  }
}

export function leerFiltros(input: unknown, fechaDefecto: string): FiltrosInforme {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const texto = (key: string, max = 80) => typeof source[key] === 'string' ? source[key].trim().slice(0, max) : ''
  const fecha = (key: string) => {
    const value = texto(key, 10)
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
  }
  let desde = fecha('desde') || fechaDefecto
  let hasta = fecha('hasta') || fechaDefecto
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  const semestre = texto('semestre', 1)
  const grupo = texto('grupo', 1).toUpperCase()
  const turno = texto('turnoId', 12)
  const estadoSesion = texto('estadoSesion', 20)
  const estadoIncidencia = texto('estadoIncidencia', 20)
  const estadoEquipo = texto('estadoEquipo', 24)
  const id = (key: string) => {
    const value = texto(key, 40)
    return /^[a-z0-9-]*$/i.test(value) ? value : ''
  }
  return {
    desde,
    hasta,
    alumno: texto('alumno'),
    matricula: texto('matricula', 16),
    semestre: /^[1-6]$/.test(semestre) ? semestre : '',
    grupo: /^[A-Z]$/.test(grupo) ? grupo : '',
    maestroId: id('maestroId'),
    materiaId: id('materiaId'),
    laboratorioId: id('laboratorioId'),
    turnoId: turno === 'matutino' || turno === 'vespertino' ? turno : '',
    estadoSesion: estadoValido(estadoSesion, ['programada', 'activa', 'finalizada', 'cancelada']),
    estadoIncidencia: estadoValido(estadoIncidencia, ['pendiente', 'en_atencion', 'resuelta']),
    estadoEquipo: estadoValido(estadoEquipo, ['disponible', 'ocupada', 'mantenimiento', 'fuera_de_servicio']),
  }
}

export function leerMembrete(input: unknown, tituloDefecto: string): Membrete {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const texto = (key: string, max: number) => typeof source[key] === 'string' ? source[key].replace(/\s+/g, ' ').trim().slice(0, max) : ''
  const fecha = texto('fecha', 10)
  return {
    institucion: texto('institucion', 120),
    encargado: texto('encargado', 120),
    titulo: texto('titulo', 160) || tituloDefecto,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : fechaIso(new Date()),
    departamento: texto('departamento', 120),
    reviso: texto('reviso', 120),
    autorizo: texto('autorizo', 120),
  }
}

export function hechosLaboratorio(data: DemoData, filtros: FiltrosInforme): HechosLaboratorio {
  const definicion = CATALOGO.find((item) => item.id === 'estadisticas-generales')
  if (!definicion) throw new Error('No se pudo armar el informe del laboratorio.')
  const consulta = consultar(data, filtros, definicion)
  const laboratorio = filtros.laboratorioId
    ? data.laboratorios.filter((item) => item.id === filtros.laboratorioId)
    : data.laboratorios
  const entradasTurno = filtros.turnoId ? [nombreTurno(filtros.turnoId as TurnoId)] : ['Matutino', 'Vespertino']
  const porMaestro = new Map<string, { nombre: string; sesiones: number; ingresos: number }>()
  for (const sesion of consulta.sesiones) {
    const actual = porMaestro.get(sesion.maestro) ?? { nombre: sesion.maestro, sesiones: 0, ingresos: 0 }
    actual.sesiones += 1
    actual.ingresos += sesion.ingresos
    porMaestro.set(sesion.maestro, actual)
  }
  const estados = ['Programada', 'En curso', 'Finalizada', 'Cancelada']
  const nombreLab = laboratorio.length === 1 ? laboratorio[0].nombre : ''
  return {
    periodo: `Del ${fechaLegible(filtros.desde)} al ${fechaLegible(filtros.hasta)}`,
    filtros: consulta.filtros,
    laboratorios: laboratorio.map((item) => ({
      nombre: item.nombre,
      ubicacion: item.ubicacion,
      estado: item.estado === 'operativo' ? 'Operativo' : item.estado === 'parcial' ? 'Parcial' : 'Cerrado',
      capacidad: item.capacidad,
      equipos: item.cantidadEquipos,
    })),
    ingresos: consulta.entradas.length,
    alumnosDistintos: new Set(consulta.entradas.map((item) => item.alumnoId)).size,
    sesionesTotal: consulta.sesiones.length,
    sesiones: estados.map((estado) => ({ estado, total: consulta.sesiones.filter((item) => item.estadoTexto === estado).length })),
    porTurno: entradasTurno.map((turno) => ({ turno, ingresos: consulta.entradas.filter((item) => item.turno === turno).length })),
    porLaboratorioUso: laboratorio.map((item) => {
      const lista = consulta.entradas.filter((entrada) => entrada.laboratorioId === item.id)
      return {
        laboratorio: item.nombre,
        ingresos: lista.length,
        alumnos: new Set(lista.map((entrada) => entrada.alumnoId)).size,
      }
    }),
    maestros: [...porMaestro.values()].sort((a, b) => b.ingresos - a.ingresos || a.nombre.localeCompare(b.nombre, 'es')),
    equipos: consulta.equipos.map((item) => ({ id: item.id, laboratorio: item.laboratorio, estado: item.estadoTexto, descripcion: item.descripcion })),
    mantenimientos: consulta.reparaciones.map((item) => ({
      fecha: item.fecha,
      equipo: item.equipo,
      laboratorio: item.laboratorio,
      estadoActual: item.estado,
      descripcion: item.descripcion,
      responsable: item.responsable,
    })),
    incidencias: consulta.incidencias.map((item) => ({
      fecha: item.fecha,
      hora: item.hora,
      laboratorio: item.laboratorio,
      equipo: item.equipo,
      estado: item.estadoTexto,
      reporta: item.reporta,
      descripcion: item.descripcion,
    })),
    reservacionesPendientes: consulta.reservaciones.filter((item) => item.estado === 'Pendiente').length,
    sesionesDetalle: consulta.sesiones.map((item) => ({
      fecha: item.fecha,
      horario: item.horario,
      grupo: `${item.semestre}° ${item.grupo}`,
      docente: item.maestro,
      asignatura: item.materia,
      alumnos: item.ingresos,
      laboratorio: item.laboratorio,
    })),
    bitacora: data.bitacora.filter((item) => {
      const dia = item.fechaHora.slice(0, 10)
      if (!enFecha(dia, filtros)) return false
      if (nombreLab && !item.accion.toLocaleLowerCase('es').includes(nombreLab.toLocaleLowerCase('es'))) return false
      return true
    }).sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)).map((item) => ({
      fecha: item.fechaHora.slice(0, 10),
      hora: item.fechaHora.slice(11, 16),
      usuario: item.usuario,
      accion: item.accion,
    })),
  }
}

export function construirInforme(data: DemoData, id: string, filtros: FiltrosInforme): Informe {
  const definicion = definicionInforme(id)
  if (!definicion) throw new Error('Ese reporte no está disponible.')
  const consulta = consultar(data, filtros, definicion)
  const cuerpo = armar(definicion, consulta)
  return {
    id: definicion.id,
    categoria: definicion.categoria,
    nombre: definicion.nombre,
    descripcion: definicion.descripcion,
    titulo: definicion.nombre,
    incluyeAlumnos: definicion.incluyeAlumnos,
    columnas: cuerpo.columnas,
    filas: cuerpo.filas,
    totales: cuerpo.totales,
    resumen: cuerpo.resumen,
    periodo: definicion.usaPeriodo ? `Del ${fechaLegible(filtros.desde)} al ${fechaLegible(filtros.hasta)}` : 'Estado actual de los equipos en el escenario',
    filtros: consulta.filtros,
    notaFuente: NOTA_FUENTE,
    avisoPrivacidad: definicion.incluyeAlumnos ? AVISO_ALUMNOS : '',
    advertencia: [consulta.advertencia, cuerpo.extra].filter(Boolean).join(' '),
  }
}

export function vistaDe(informe: Informe): VistaInforme {
  return {
    id: informe.id,
    nombre: informe.nombre,
    descripcion: informe.descripcion,
    periodo: informe.periodo,
    filtros: informe.filtros,
    notaFuente: informe.notaFuente,
    avisoPrivacidad: informe.avisoPrivacidad,
    advertencia: informe.advertencia,
    columnas: informe.columnas.map((columna) => ({ key: columna.key, header: columna.header })),
    total: informe.filas.length,
    muestra: informe.filas.slice(0, 12),
    totales: informe.totales,
    resumen: informe.resumen,
    fuente: 'demostracion',
    persistido: false,
  }
}

export function tableroReportes(data: DemoData, filtros: FiltrosInforme): TableroInformes {
  const base = CATALOGO.find((item) => item.id === 'estadisticas-generales')
  if (!base) {
    return vacioTablero()
  }
  const consulta = consultar(data, filtros, base)
  const porAlumno = new Map<string, { label: string; value: number }>()
  const porTurno = new Map<string, number>([['Matutino', 0], ['Vespertino', 0]])
  const porLab = new Map<string, number>()
  const porMateria = new Map<string, number>()
  for (const entrada of consulta.entradas) {
    const actual = porAlumno.get(entrada.alumnoId)
    if (actual) actual.value += 1
    else porAlumno.set(entrada.alumnoId, { label: `${entrada.alumno} · ${entrada.matricula}`, value: 1 })
    porTurno.set(entrada.turno, (porTurno.get(entrada.turno) ?? 0) + 1)
    porLab.set(entrada.laboratorio, (porLab.get(entrada.laboratorio) ?? 0) + 1)
    porMateria.set(entrada.materia, (porMateria.get(entrada.materia) ?? 0) + 1)
  }
  const labs = [...porLab.entries()].sort((a, b) => b[1] - a[1])
  const incidencias = consulta.incidencias
  const equipos = consulta.equiposEstado
  return {
    ingresos: consulta.entradas.length,
    alumnosDistintos: new Set(consulta.entradas.map((item) => item.alumnoId)).size,
    labMayor: labs[0] ? `${labs[0][0]} · ${labs[0][1]} ingresos` : 'Sin ingresos en el periodo',
    alumnosTop: [...porAlumno.values()].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es')).slice(0, 5),
    porTurno: [...porTurno.entries()].map(([label, value]) => ({ label, value })),
    porLaboratorio: labs.map(([label, value]) => ({ label, value })),
    materiasTop: [...porMateria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })),
    incidencias: incidencias.length,
    incidenciasPendientes: incidencias.filter((item) => item.estado === 'pendiente' || item.estado === 'en_atencion').length,
    equipos: [
      { label: 'Disponibles', value: equipos.filter((item) => item.estado === 'disponible').length },
      { label: 'Ocupados', value: equipos.filter((item) => item.estado === 'ocupada').length },
      { label: 'Mantenimiento', value: equipos.filter((item) => item.estado === 'mantenimiento').length },
      { label: 'Fuera de servicio', value: equipos.filter((item) => item.estado === 'fuera_de_servicio').length },
    ],
  }
}

interface Entrada {
  alumnoId: string
  sesionId: string
  fecha: string
  hora: string
  matricula: string
  alumno: string
  semestre: number
  grupo: string
  turno: string
  turnoId: TurnoId
  laboratorio: string
  laboratorioId: string
  maestro: string
  maestroId: string
  materia: string
  materiaId: string
  clave: string
  horario: string
}

interface SesionVista {
  id: string
  fecha: string
  horario: string
  horaInicio: string
  horaFin: string
  laboratorio: string
  laboratorioId: string
  turno: string
  turnoId: TurnoId
  maestro: string
  maestroId: string
  materia: string
  materiaId: string
  semestre: number
  grupo: string
  estado: EstadoSesion
  estadoTexto: string
  ingresos: number
}

interface IncidenciaVista {
  fecha: string
  hora: string
  orden: string
  laboratorio: string
  laboratorioId: string
  equipo: string
  estado: EstadoIncidencia
  estadoTexto: string
  reporta: string
  descripcion: string
}

interface EquipoVista {
  id: string
  laboratorio: string
  laboratorioId: string
  estado: EstadoEquipo
  estadoTexto: string
  descripcion: string
}

interface ReparacionVista {
  fecha: string
  equipo: string
  laboratorio: string
  estado: string
  descripcion: string
  responsable: string
}

interface ReservaVista {
  fecha: string
  horario: string
  horaInicio: string
  horaFin: string
  laboratorio: string
  laboratorioId: string
  maestro: string
  materia: string
  semestre: string
  grupo: string
  turno: string
  estado: string
  motivo: string
}

interface Consulta {
  entradas: Entrada[]
  sesiones: SesionVista[]
  incidencias: IncidenciaVista[]
  equipos: EquipoVista[]
  equiposEstado: EquipoVista[]
  reparaciones: ReparacionVista[]
  reservaciones: ReservaVista[]
  filtros: string[]
  advertencia: string
}

interface Cuerpo {
  columnas: ColumnaInforme[]
  filas: FilaInforme[]
  totales: ParInforme[]
  resumen: ParInforme[]
  extra: string
}

function spec(
  id: string,
  categoria: CategoriaInforme,
  nombre: string,
  descripcion: string,
  incluyeAlumnos: boolean,
  kind: Kind,
  orden: Spec['orden'] = 'fecha',
  aplicaAlumno = true,
  usaPeriodo = true,
  estadoSesion = '',
  estadoIncidencia = '',
  estadoEquipo = '',
): Spec {
  return {
    id, categoria, nombre, descripcion, incluyeAlumnos, usaPeriodo, aplicaAlumno,
    estadoSesion, estadoIncidencia, estadoEquipo, kind, orden,
  }
}

function consultar(data: DemoData, filtros: FiltrosInforme, definicion: Spec): Consulta {
  const advertencias: string[] = []
  const alumnos = new Map(data.alumnos.map((item) => [item.id, item]))
  const maestros = new Map(data.maestros.map((item) => [item.id, item]))
  const materias = new Map(data.materias.map((item) => [item.id, item]))
  const labs = new Map(data.laboratorios.map((item) => [item.id, item.nombre]))
  const estadoSesion = definicion.estadoSesion || filtros.estadoSesion
  if (definicion.estadoSesion && filtros.estadoSesion && filtros.estadoSesion !== definicion.estadoSesion) {
    advertencias.push(`Este reporte ya está limitado a sesiones ${etiquetaSesion(definicion.estadoSesion as EstadoSesion).toLowerCase()}.`)
  }
  const estadoIncidencia = definicion.estadoIncidencia || filtros.estadoIncidencia
  if (definicion.estadoIncidencia && filtros.estadoIncidencia && filtros.estadoIncidencia !== definicion.estadoIncidencia) {
    advertencias.push('El filtro de estado de incidencia no amplía este reporte.')
  }
  const estadoEquipo = definicion.estadoEquipo || filtros.estadoEquipo
  if (definicion.estadoEquipo && filtros.estadoEquipo && filtros.estadoEquipo !== definicion.estadoEquipo) {
    advertencias.push('El filtro de estado del equipo no amplía este reporte.')
  }
  if (!definicion.aplicaAlumno && (filtros.alumno || filtros.matricula)) {
    advertencias.push('El nombre y la matrícula no se usan en este reporte.')
  }
  if (!definicion.usaPeriodo) {
    advertencias.push('Las fechas no recortan el inventario: se muestra el estado actual.')
  }

  const sesionesBase = data.sesiones.filter((sesion) => {
    if (definicion.usaPeriodo && !enFecha(sesion.fecha, filtros)) return false
    if (!definicion.usaPeriodo && !enFecha(sesion.fecha, filtros)) return false
    if (filtros.laboratorioId && sesion.laboratorioId !== filtros.laboratorioId) return false
    if (filtros.turnoId && sesion.turnoId !== filtros.turnoId) return false
    if (filtros.maestroId && sesion.maestroId !== filtros.maestroId) return false
    if (filtros.materiaId && sesion.materiaId !== filtros.materiaId) return false
    if (filtros.semestre && String(sesion.semestre) !== filtros.semestre) return false
    if (filtros.grupo && sesion.grupo !== filtros.grupo) return false
    if (estadoSesion && sesion.estado !== estadoSesion) return false
    return true
  })
  const sesionesValidas = new Set(sesionesBase.map((sesion) => sesion.id))
  const entradas: Entrada[] = []
  for (const ingreso of data.ingresos) {
    if (!sesionesValidas.has(ingreso.sesionId) || !enFecha(ingreso.fecha, filtros)) continue
    const sesion = data.sesiones.find((item) => item.id === ingreso.sesionId)
    const alumno = alumnos.get(ingreso.alumnoId)
    if (!sesion || !alumno) continue
    if (definicion.aplicaAlumno) {
      if (filtros.alumno && !contiene(alumno.nombre, filtros.alumno)) continue
      if (filtros.matricula && !contiene(alumno.matricula, filtros.matricula)) continue
    }
    const materia = materias.get(sesion.materiaId)
    entradas.push({
      alumnoId: alumno.id,
      sesionId: sesion.id,
      fecha: ingreso.fecha,
      hora: ingreso.hora,
      matricula: alumno.matricula,
      alumno: alumno.nombre,
      semestre: sesion.semestre,
      grupo: sesion.grupo,
      turno: nombreTurno(sesion.turnoId),
      turnoId: sesion.turnoId,
      laboratorio: labs.get(sesion.laboratorioId) ?? sesion.laboratorioId,
      laboratorioId: sesion.laboratorioId,
      maestro: maestros.get(sesion.maestroId)?.nombre ?? 'Sin maestro',
      maestroId: sesion.maestroId,
      materia: materia?.nombre ?? 'Sin materia',
      materiaId: sesion.materiaId,
      clave: materia?.clave ?? '',
      horario: `${sesion.horaInicio}–${sesion.horaFin}`,
    })
  }
  const conteo = new Map<string, number>()
  for (const entrada of entradas) conteo.set(entrada.sesionId, (conteo.get(entrada.sesionId) ?? 0) + 1)
  let sesionesVista = sesionesBase.map((sesion) => {
    const materia = materias.get(sesion.materiaId)
    return {
      id: sesion.id,
      fecha: sesion.fecha,
      horario: `${sesion.horaInicio}–${sesion.horaFin}`,
      horaInicio: sesion.horaInicio,
      horaFin: sesion.horaFin,
      laboratorio: labs.get(sesion.laboratorioId) ?? sesion.laboratorioId,
      laboratorioId: sesion.laboratorioId,
      turno: nombreTurno(sesion.turnoId),
      turnoId: sesion.turnoId,
      maestro: maestros.get(sesion.maestroId)?.nombre ?? 'Sin maestro',
      maestroId: sesion.maestroId,
      materia: materia?.nombre ?? 'Sin materia',
      materiaId: sesion.materiaId,
      semestre: sesion.semestre,
      grupo: sesion.grupo,
      estado: sesion.estado,
      estadoTexto: etiquetaSesion(sesion.estado),
      ingresos: conteo.get(sesion.id) ?? 0,
    }
  })
  if (definicion.aplicaAlumno && (filtros.alumno || filtros.matricula)) {
    const usadas = new Set(entradas.map((item) => item.sesionId))
    sesionesVista = sesionesVista.filter((sesion) => usadas.has(sesion.id))
    advertencias.push('La matrícula y el nombre limitan las sesiones a aquellas con un ingreso de ese alumno.')
  }

  const incidencias = data.incidencias.filter((item) => {
    const dia = item.fechaHora.slice(0, 10)
    if (definicion.usaPeriodo && !enFecha(dia, filtros)) return false
    if (filtros.laboratorioId && item.laboratorioId !== filtros.laboratorioId) return false
    if (estadoIncidencia && item.estado !== estadoIncidencia) return false
    return true
  }).map((item) => ({
    fecha: item.fechaHora.slice(0, 10),
    hora: item.fechaHora.slice(11, 16),
    orden: item.fechaHora,
    laboratorio: labs.get(item.laboratorioId) ?? item.laboratorioId,
    laboratorioId: item.laboratorioId,
    equipo: item.equipoId ?? 'General del laboratorio',
    estado: item.estado,
    estadoTexto: etiquetaIncidencia(item.estado),
    reporta: item.reporta,
    descripcion: item.descripcion,
  })).sort((a, b) => a.orden.localeCompare(b.orden))

  const equiposTodos = data.equipos.filter((item) => !filtros.laboratorioId || item.laboratorioId === filtros.laboratorioId).map((item) => ({
    id: item.id,
    laboratorio: labs.get(item.laboratorioId) ?? item.laboratorioId,
    laboratorioId: item.laboratorioId,
    estado: item.estado,
    estadoTexto: etiquetaEquipo(item.estado),
    descripcion: item.descripcion,
  }))
  const equipos = estadoEquipo ? equiposTodos.filter((item) => item.estado === estadoEquipo) : equiposTodos
  const reparaciones = data.mantenimientos.filter((item) => definicion.usaPeriodo ? enFecha(item.fecha, filtros) : true).flatMap((item) => {
    const equipo = data.equipos.find((equipoItem) => equipoItem.id === item.equipoId)
    if (!equipo) return []
    if (filtros.laboratorioId && equipo.laboratorioId !== filtros.laboratorioId) return []
    if (estadoEquipo && equipo.estado !== estadoEquipo) return []
    return [{
      fecha: item.fecha,
      equipo: equipo.id,
      laboratorio: labs.get(equipo.laboratorioId) ?? equipo.laboratorioId,
      estado: etiquetaEquipo(equipo.estado),
      descripcion: item.descripcion,
      responsable: item.responsable,
    }]
  }).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.equipo.localeCompare(b.equipo))

  const reservaciones = data.reservaciones.filter((item) => {
    if (!enFecha(item.fecha, filtros)) return false
    if (filtros.laboratorioId && item.laboratorioId !== filtros.laboratorioId) return false
    if (filtros.maestroId && item.maestroId !== filtros.maestroId) return false
    if (filtros.materiaId && item.materiaId !== filtros.materiaId) return false
    const materia = materias.get(item.materiaId)
    if (filtros.grupo && item.grupo !== filtros.grupo) return false
    if (filtros.semestre && String(materia?.semestre ?? '') !== filtros.semestre) return false
    if (filtros.turnoId && materia?.turnoId !== filtros.turnoId) return false
    return true
  }).map((item) => {
    const materia = materias.get(item.materiaId)
    return {
      fecha: item.fecha,
      horario: `${item.horaInicio}–${item.horaFin}`,
      horaInicio: item.horaInicio,
      horaFin: item.horaFin,
      laboratorio: labs.get(item.laboratorioId) ?? item.laboratorioId,
      laboratorioId: item.laboratorioId,
      maestro: maestros.get(item.maestroId)?.nombre ?? 'Sin maestro',
      materia: materia?.nombre ?? 'Sin materia',
      semestre: materia ? `${materia.semestre}°` : '',
      grupo: item.grupo,
      turno: materia ? nombreTurno(materia.turnoId) : '',
      estado: etiquetaReserva(item.estado),
      motivo: item.motivo ?? '',
    }
  }).sort((a, b) => a.maestro.localeCompare(b.maestro, 'es') || a.fecha.localeCompare(b.fecha))

  return {
    entradas,
    sesiones: sesionesVista.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horario.localeCompare(b.horario)),
    incidencias,
    equipos,
    equiposEstado: equiposTodos,
    reparaciones,
    reservaciones,
    filtros: describirFiltros(data, filtros),
    advertencia: advertencias.join(' '),
  }
}

function armar(definicion: Spec, consulta: Consulta): Cuerpo {
  switch (definicion.kind) {
    case 'detalle': return detalle(consulta.entradas, definicion.orden)
    case 'por-dia': return porDia(consulta.entradas)
    case 'por-semana': return porSemana(consulta.entradas)
    case 'por-mes': return porMes(consulta.entradas)
    case 'por-alumno': return porAlumno(consulta.entradas)
    case 'por-grupo': return porGrupo(consulta.entradas)
    case 'por-materia': return porMateria(consulta.entradas)
    case 'labs': return porLabs(consulta, true)
    case 'alumnos-lab': return porLabs(consulta, false)
    case 'horas': return porHoras(consulta)
    case 'turnos': return porTurnos(consulta)
    case 'maestros': return porMaestros(consulta)
    case 'materias-uso': return porMateriasUso(consulta)
    case 'comparacion': return comparacion(consulta)
    case 'equipos': return equipos(consulta.equipos)
    case 'reparaciones': return reparaciones(consulta.reparaciones)
    case 'incidencias': return incidencias(consulta.incidencias)
    case 'incidencias-lab': return incidenciasAgrupadas(consulta.incidencias, 'laboratorio', 'Laboratorio')
    case 'incidencias-equipo': return incidenciasAgrupadas(consulta.incidencias, 'equipo', 'Equipo')
    case 'sesiones': return sesiones(consulta.sesiones)
    case 'reservaciones': return reservaciones(consulta.reservaciones)
    case 'horarios': return horarios(consulta)
    case 'resumen-dia': return resumenPeriodo(consulta, 'dia')
    case 'resumen-semana': return resumenPeriodo(consulta, 'semana')
    case 'resumen-mes': return resumenPeriodo(consulta, 'mes')
    case 'resumen-semestre': return resumenSemestre(consulta)
    case 'estadisticas': return estadisticas(consulta)
    default: return vacio()
  }
}

function detalle(entradas: Entrada[], orden: Spec['orden']): Cuerpo {
  const filas = entradas.map(filaEntrada).sort((a, b) => {
    if (orden === 'matricula') return String(a.matricula).localeCompare(String(b.matricula)) || String(a.fecha).localeCompare(String(b.fecha))
    if (orden === 'laboratorio') return String(a.laboratorio).localeCompare(String(b.laboratorio), 'es') || String(a.fecha).localeCompare(String(b.fecha)) || String(a.hora).localeCompare(String(b.hora))
    return String(a.fecha).localeCompare(String(b.fecha)) || String(a.hora).localeCompare(String(b.hora))
  })
  return cuerpo(DETALLE, filas, [{ etiqueta: 'Entradas', valor: String(filas.length) }, { etiqueta: 'Alumnos distintos', valor: String(new Set(entradas.map((item) => item.alumnoId)).size) }], [])
}

function porDia(entradas: Entrada[]): Cuerpo {
  return conteoTemporal(entradas, (item) => item.fecha, 'fecha', 'Fecha', (clave) => clave)
}

function porSemana(entradas: Entrada[]): Cuerpo {
  return conteoTemporal(entradas, (item) => inicioDeSemana(item.fecha), 'semana', 'Semana', (clave) => `${fechaLegible(clave)} al ${fechaLegible(sumarDias(clave, 6))}`)
}

function porMes(entradas: Entrada[]): Cuerpo {
  return conteoTemporal(entradas, (item) => item.fecha.slice(0, 7), 'mes', 'Mes', (clave) => {
    const [year, month] = clave.split('-')
    return `${MESES[Number(month) - 1]} ${year}`
  })
}

function conteoTemporal(entradas: Entrada[], clave: (item: Entrada) => string, key: string, header: string, etiqueta: (value: string) => string): Cuerpo {
  const grupos = agrupar(entradas, clave)
  const filas = [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, lista]) => ({
    [key]: etiqueta(id),
    ingresos: lista.length,
    alumnos: new Set(lista.map((item) => item.alumnoId)).size,
    laboratorio1: lista.filter((item) => item.laboratorioId === 'lab-1').length,
    laboratorio2: lista.filter((item) => item.laboratorioId === 'lab-2').length,
  }))
  return cuerpo([
    { key, header, ancho: 32 },
    { key: 'ingresos', header: 'Ingresos', ancho: 12 },
    { key: 'alumnos', header: 'Alumnos distintos', ancho: 18 },
    { key: 'laboratorio1', header: 'Laboratorio 1', ancho: 16 },
    { key: 'laboratorio2', header: 'Laboratorio 2', ancho: 16 },
  ], filas, [{ etiqueta: 'Entradas', valor: String(entradas.length) }], [])
}

function porAlumno(entradas: Entrada[]): Cuerpo {
  const grupos = agrupar(entradas, (item) => item.alumnoId)
  const filas = [...grupos.values()].map((lista) => {
    const primero = lista[0]
    const ultima = [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora)).at(-1)
    return {
      matricula: primero.matricula,
      alumno: primero.alumno,
      semestre: primero.semestre,
      grupo: primero.grupo,
      turno: primero.turno,
      ingresos: lista.length,
      ultima: ultima?.fecha ?? '',
    }
  }).sort((a, b) => b.ingresos - a.ingresos || String(a.alumno).localeCompare(String(b.alumno), 'es'))
  return cuerpo([
    { key: 'matricula', header: 'Matrícula', ancho: 14 },
    { key: 'alumno', header: 'Alumno', ancho: 28 },
    { key: 'semestre', header: 'Semestre', ancho: 12 },
    { key: 'grupo', header: 'Grupo', ancho: 10 },
    { key: 'turno', header: 'Turno', ancho: 14 },
    { key: 'ingresos', header: 'Ingresos', ancho: 12 },
    { key: 'ultima', header: 'Última entrada', ancho: 16 },
  ], filas, [{ etiqueta: 'Alumnos', valor: String(filas.length) }, { etiqueta: 'Entradas', valor: String(entradas.length) }], [])
}

function porGrupo(entradas: Entrada[]): Cuerpo {
  const grupos = agrupar(entradas, (item) => `${item.semestre}|${item.grupo}|${item.turnoId}`)
  const filas = [...grupos.values()].map((lista) => ({
    semestre: `${lista[0].semestre}°`,
    grupo: lista[0].grupo,
    turno: lista[0].turno,
    alumnos: new Set(lista.map((item) => item.alumnoId)).size,
    ingresos: lista.length,
  })).sort((a, b) => String(a.semestre).localeCompare(String(b.semestre)) || String(a.grupo).localeCompare(String(b.grupo)))
  return cuerpo([
    { key: 'semestre', header: 'Semestre', ancho: 12 },
    { key: 'grupo', header: 'Grupo', ancho: 10 },
    { key: 'turno', header: 'Turno', ancho: 14 },
    { key: 'alumnos', header: 'Alumnos distintos', ancho: 18 },
    { key: 'ingresos', header: 'Ingresos', ancho: 12 },
  ], filas, [{ etiqueta: 'Grupos', valor: String(filas.length) }], [])
}

function porMateria(entradas: Entrada[]): Cuerpo {
  const grupos = agrupar(entradas, (item) => `${item.maestroId}|${item.materiaId}|${item.grupo}|${item.semestre}`)
  const filas = [...grupos.values()].map((lista) => ({
    maestro: lista[0].maestro,
    materia: lista[0].materia,
    semestre: `${lista[0].semestre}°`,
    grupo: lista[0].grupo,
    turno: lista[0].turno,
    ingresos: lista.length,
  })).sort((a, b) => b.ingresos - a.ingresos)
  return cuerpo([
    { key: 'maestro', header: 'Maestro', ancho: 26 },
    { key: 'materia', header: 'Materia', ancho: 22 },
    { key: 'semestre', header: 'Semestre', ancho: 12 },
    { key: 'grupo', header: 'Grupo', ancho: 10 },
    { key: 'turno', header: 'Turno', ancho: 14 },
    { key: 'ingresos', header: 'Ingresos', ancho: 12 },
  ], filas, [{ etiqueta: 'Entradas', valor: String(entradas.length) }], [])
}

function porLabs(consulta: Consulta, conLugar: boolean): Cuerpo {
  const filas = laboratoriosDe(consulta).map((item) => ({
    laboratorio: item.laboratorio,
    ingresos: item.ingresos,
    alumnos: item.alumnos,
    sesiones: item.sesiones,
  })).sort((a, b) => b.ingresos - a.ingresos || b.alumnos - a.alumnos)
  const ranked = filas.map((fila, index) => ({ lugar: index + 1, ...fila }))
  const lider = ranked[0]
  const resumen = lider && lider.ingresos > 0
    ? [{ etiqueta: 'Mayor actividad', valor: ranked.filter((item) => item.ingresos === lider.ingresos).map((item) => item.laboratorio).join(', ') }]
    : []
  const columnas: ColumnaInforme[] = [
    ...(conLugar ? [{ key: 'lugar', header: 'Lugar', ancho: 10 }] : []),
    { key: 'laboratorio', header: 'Laboratorio', ancho: 18 },
    { key: 'ingresos', header: 'Ingresos', ancho: 12 },
    { key: 'alumnos', header: 'Alumnos distintos', ancho: 18 },
    { key: 'sesiones', header: 'Sesiones', ancho: 12 },
  ]
  return cuerpo(columnas, conLugar ? ranked : filas, [{ etiqueta: 'Entradas', valor: String(consulta.entradas.length) }], resumen)
}

function porHoras(consulta: Consulta): Cuerpo {
  const mapa = new Map<string, number>()
  for (const entrada of consulta.entradas) {
    const hora = `${entrada.hora.slice(0, 2)}:00`
    mapa.set(hora, (mapa.get(hora) ?? 0) + 1)
  }
  const filas = [...mapa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([hora, ingresos]) => {
    const inicio = toMinutes(hora)
    const sesiones = consulta.sesiones.filter((sesion) => rangosSeCruzan(sesion.horaInicio, sesion.horaFin, hora, desdeMinutos(inicio + 60))).length
    return { hora, ingresos, sesiones }
  })
  return cuerpo([
    { key: 'hora', header: 'Hora', ancho: 12 },
    { key: 'ingresos', header: 'Ingresos', ancho: 12 },
    { key: 'sesiones', header: 'Sesiones que cubren la hora', ancho: 28 },
  ], filas, [{ etiqueta: 'Entradas', valor: String(consulta.entradas.length) }], filas[0] ? [{ etiqueta: 'Hora con más entradas', valor: `${filas[0].hora} (${filas[0].ingresos})` }] : [], 'Cada fila usa la hora en que el alumno ingresó.')
}

function porTurnos(consulta: Consulta): Cuerpo {
  const filas = (['matutino', 'vespertino'] as TurnoId[]).map((turno) => ({
    turno: nombreTurno(turno),
    ingresos: consulta.entradas.filter((item) => item.turnoId === turno).length,
    alumnos: new Set(consulta.entradas.filter((item) => item.turnoId === turno).map((item) => item.alumnoId)).size,
    sesiones: consulta.sesiones.filter((item) => item.turnoId === turno).length,
  }))
  return cuerpo([
    { key: 'turno', header: 'Turno', ancho: 16 },
    { key: 'ingresos', header: 'Ingresos', ancho: 12 },
    { key: 'alumnos', header: 'Alumnos distintos', ancho: 18 },
    { key: 'sesiones', header: 'Sesiones', ancho: 12 },
  ], filas, [], [])
}

function porMaestros(consulta: Consulta): Cuerpo {
  const ids = new Set([...consulta.sesiones.map((item) => item.maestroId), ...consulta.entradas.map((item) => item.maestroId)])
  const filas = [...ids].map((id) => {
    const sesiones = consulta.sesiones.filter((item) => item.maestroId === id)
    const entradas = consulta.entradas.filter((item) => item.maestroId === id)
    return {
      maestro: sesiones[0]?.maestro ?? entradas[0]?.maestro ?? id,
      sesiones: sesiones.length,
      ingresos: entradas.length,
      alumnos: new Set(entradas.map((item) => item.alumnoId)).size,
    }
  }).sort((a, b) => b.ingresos - a.ingresos || a.maestro.localeCompare(b.maestro, 'es'))
  return cuerpo([
    { key: 'maestro', header: 'Maestro', ancho: 28 },
    { key: 'sesiones', header: 'Sesiones', ancho: 12 },
    { key: 'ingresos', header: 'Ingresos', ancho: 12 },
    { key: 'alumnos', header: 'Alumnos distintos', ancho: 18 },
  ], filas, [{ etiqueta: 'Maestros', valor: String(filas.length) }], [])
}

function porMateriasUso(consulta: Consulta): Cuerpo {
  const ids = new Set([...consulta.sesiones.map((item) => `${item.materiaId}|${item.grupo}|${item.semestre}`)])
  const filas = [...ids].map((id) => {
    const [materiaId, grupo, semestre] = id.split('|')
    const sesiones = consulta.sesiones.filter((item) => item.materiaId === materiaId && item.grupo === grupo && String(item.semestre) === semestre)
    const entradas = consulta.entradas.filter((item) => item.materiaId === materiaId && item.grupo === grupo && String(item.semestre) === semestre)
    return {
      materia: sesiones[0]?.materia ?? materiaId,
      semestre: `${semestre}°`,
      grupo,
      turno: sesiones[0]?.turno ?? '',
      maestro: sesiones[0]?.maestro ?? '',
      sesiones: sesiones.length,
      ingresos: entradas.length,
    }
  }).sort((a, b) => b.ingresos - a.ingresos)
  return cuerpo([
    { key: 'materia', header: 'Materia', ancho: 22 },
    { key: 'semestre', header: 'Semestre', ancho: 12 },
    { key: 'grupo', header: 'Grupo', ancho: 10 },
    { key: 'turno', header: 'Turno', ancho: 14 },
    { key: 'maestro', header: 'Maestro', ancho: 26 },
    { key: 'sesiones', header: 'Sesiones', ancho: 12 },
    { key: 'ingresos', header: 'Ingresos', ancho: 12 },
  ], filas, [], [])
}

function comparacion(consulta: Consulta): Cuerpo {
  const filas = laboratoriosDe(consulta)
  const total = filas.reduce((sum, item) => sum + item.ingresos, 0)
  const conPorcentaje = filas.map((item) => ({
    ...item,
    participacion: total ? `${Math.round((item.ingresos / total) * 100)}%` : '0%',
  }))
  const ordenados = [...conPorcentaje].sort((a, b) => b.ingresos - a.ingresos)
  const diferencia = ordenados.length >= 2 ? Math.abs(ordenados[0].ingresos - ordenados[1].ingresos) : 0
  return cuerpo([
    { key: 'laboratorio', header: 'Laboratorio', ancho: 18 },
    { key: 'ingresos', header: 'Ingresos', ancho: 12 },
    { key: 'alumnos', header: 'Alumnos distintos', ancho: 18 },
    { key: 'sesiones', header: 'Sesiones', ancho: 12 },
    { key: 'participacion', header: 'Participación', ancho: 14 },
  ], conPorcentaje, [{ etiqueta: 'Entradas', valor: String(total) }], [{ etiqueta: 'Diferencia de ingresos', valor: String(diferencia) }])
}

function equipos(lista: EquipoVista[]): Cuerpo {
  const filas = lista.map((item) => ({
    identificador: item.id,
    laboratorio: item.laboratorio,
    estado: item.estadoTexto,
    descripcion: item.descripcion,
  })).sort((a, b) => a.identificador.localeCompare(b.identificador))
  return cuerpo([
    { key: 'identificador', header: 'Equipo', ancho: 14 },
    { key: 'laboratorio', header: 'Laboratorio', ancho: 16 },
    { key: 'estado', header: 'Estado', ancho: 18 },
    { key: 'descripcion', header: 'Descripción', ancho: 42 },
  ], filas, [{ etiqueta: 'Equipos', valor: String(filas.length) }], [])
}

function reparaciones(lista: ReparacionVista[]): Cuerpo {
  return cuerpo([
    { key: 'fecha', header: 'Fecha', ancho: 14 },
    { key: 'equipo', header: 'Equipo', ancho: 14 },
    { key: 'laboratorio', header: 'Laboratorio', ancho: 16 },
    { key: 'estado', header: 'Estado actual', ancho: 18 },
    { key: 'responsable', header: 'Responsable', ancho: 22 },
    { key: 'descripcion', header: 'Descripción', ancho: 46 },
  ], lista, [{ etiqueta: 'Reparaciones', valor: String(lista.length) }], [], 'La descripción puede editarse después en el documento de Word.')
}

function incidencias(lista: IncidenciaVista[]): Cuerpo {
  const filas = lista.map((item) => ({
    fecha: item.fecha,
    hora: item.hora,
    laboratorio: item.laboratorio,
    equipo: item.equipo,
    estado: item.estadoTexto,
    reporta: item.reporta,
    descripcion: item.descripcion,
  }))
  return cuerpo([
    { key: 'fecha', header: 'Fecha', ancho: 14 },
    { key: 'hora', header: 'Hora', ancho: 10 },
    { key: 'laboratorio', header: 'Laboratorio', ancho: 16 },
    { key: 'equipo', header: 'Equipo', ancho: 22 },
    { key: 'estado', header: 'Estado', ancho: 14 },
    { key: 'reporta', header: 'Reporta', ancho: 20 },
    { key: 'descripcion', header: 'Descripción', ancho: 46 },
  ], filas, [
    { etiqueta: 'Registros', valor: String(filas.length) },
    { etiqueta: 'Pendientes o en atención', valor: String(lista.filter((item) => item.estado !== 'resuelta').length) },
  ], [], 'Este documento sirve como informe de incidencias y puede completarse en Word.')
}

function incidenciasAgrupadas(lista: IncidenciaVista[], key: 'laboratorio' | 'equipo', header: string): Cuerpo {
  const grupos = agrupar(lista, (item) => item[key])
  const filas = [...grupos.entries()].map(([nombre, items]) => ({
    nombre,
    total: items.length,
    pendientes: items.filter((item) => item.estado === 'pendiente').length,
    atencion: items.filter((item) => item.estado === 'en_atencion').length,
    resueltas: items.filter((item) => item.estado === 'resuelta').length,
  })).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'))
  return cuerpo([
    { key: 'nombre', header, ancho: 24 },
    { key: 'total', header: 'Total', ancho: 10 },
    { key: 'pendientes', header: 'Pendientes', ancho: 12 },
    { key: 'atencion', header: 'En atención', ancho: 12 },
    { key: 'resueltas', header: 'Resueltas', ancho: 12 },
  ], filas, [{ etiqueta: 'Incidencias', valor: String(lista.length) }], [])
}

function sesiones(lista: SesionVista[]): Cuerpo {
  const filas = lista.map((item) => ({
    fecha: item.fecha,
    horario: item.horario,
    laboratorio: item.laboratorio,
    turno: item.turno,
    maestro: item.maestro,
    materia: item.materia,
    semestre: item.semestre,
    grupo: item.grupo,
    estado: item.estadoTexto,
    ingresos: item.ingresos,
  }))
  const ingresos = lista.reduce((sum, item) => sum + item.ingresos, 0)
  return cuerpo(SESION_COLS, filas, [{ etiqueta: 'Sesiones', valor: String(filas.length) }, { etiqueta: 'Ingresos registrados', valor: String(ingresos) }], [])
}

function reservaciones(lista: ReservaVista[]): Cuerpo {
  return cuerpo([
    { key: 'maestro', header: 'Maestro', ancho: 26 },
    { key: 'fecha', header: 'Fecha', ancho: 14 },
    { key: 'horario', header: 'Horario', ancho: 14 },
    { key: 'laboratorio', header: 'Laboratorio', ancho: 16 },
    { key: 'materia', header: 'Materia', ancho: 20 },
    { key: 'semestre', header: 'Semestre', ancho: 12 },
    { key: 'grupo', header: 'Grupo', ancho: 10 },
    { key: 'turno', header: 'Turno', ancho: 14 },
    { key: 'estado', header: 'Estado', ancho: 12 },
    { key: 'motivo', header: 'Motivo', ancho: 36 },
  ], lista, [{ etiqueta: 'Reservaciones', valor: String(lista.length) }], [])
}

function horarios(consulta: Consulta): Cuerpo {
  const mapa = new Map<string, { laboratorio: string; horario: string; sesiones: number; reservaciones: number }>()
  for (const sesion of consulta.sesiones.filter((item) => item.estado !== 'cancelada')) {
    const key = `${sesion.laboratorioId}|${sesion.horario}`
    const actual = mapa.get(key) ?? { laboratorio: sesion.laboratorio, horario: sesion.horario, sesiones: 0, reservaciones: 0 }
    actual.sesiones += 1
    mapa.set(key, actual)
  }
  for (const reserva of consulta.reservaciones.filter((item) => item.estado !== 'Rechazada')) {
    const key = `${reserva.laboratorioId}|${reserva.horario}`
    const actual = mapa.get(key) ?? { laboratorio: reserva.laboratorio, horario: reserva.horario, sesiones: 0, reservaciones: 0 }
    actual.reservaciones += 1
    mapa.set(key, actual)
  }
  const filas = [...mapa.values()].map((item) => ({ ...item, total: item.sesiones + item.reservaciones })).sort((a, b) => b.total - a.total || a.horario.localeCompare(b.horario))
  return cuerpo([
    { key: 'laboratorio', header: 'Laboratorio', ancho: 16 },
    { key: 'horario', header: 'Horario', ancho: 14 },
    { key: 'sesiones', header: 'Sesiones', ancho: 12 },
    { key: 'reservaciones', header: 'Reservaciones', ancho: 16 },
    { key: 'total', header: 'Total', ancho: 10 },
  ], filas, [], filas[0] ? [{ etiqueta: 'Horario más solicitado', valor: `${filas[0].laboratorio} ${filas[0].horario}` }] : [], 'No se cuentan las sesiones canceladas ni las reservaciones rechazadas.')
}

function resumenPeriodo(consulta: Consulta, modo: 'dia' | 'semana' | 'mes'): Cuerpo {
  const clave = (fecha: string) => modo === 'dia' ? fecha : modo === 'semana' ? inicioDeSemana(fecha) : fecha.slice(0, 7)
  const etiqueta = (id: string) => modo === 'dia' ? id : modo === 'semana' ? `${fechaLegible(id)} al ${fechaLegible(sumarDias(id, 6))}` : `${MESES[Number(id.slice(5)) - 1]} ${id.slice(0, 4)}`
  const fechas = new Set<string>()
  for (const item of consulta.entradas) fechas.add(clave(item.fecha))
  for (const item of consulta.sesiones) fechas.add(clave(item.fecha))
  for (const item of consulta.incidencias) fechas.add(clave(item.fecha))
  for (const item of consulta.reservaciones) fechas.add(clave(item.fecha))
  const filas = [...fechas].sort().map((id) => ({
    periodo: etiqueta(id),
    ingresos: consulta.entradas.filter((item) => clave(item.fecha) === id).length,
    alumnos: new Set(consulta.entradas.filter((item) => clave(item.fecha) === id).map((item) => item.alumnoId)).size,
    sesiones: consulta.sesiones.filter((item) => clave(item.fecha) === id).length,
    incidencias: consulta.incidencias.filter((item) => clave(item.fecha) === id).length,
    reservaciones: consulta.reservaciones.filter((item) => clave(item.fecha) === id).length,
  }))
  return cuerpo([
    { key: 'periodo', header: 'Periodo', ancho: 32 },
    { key: 'ingresos', header: 'Ingresos', ancho: 12 },
    { key: 'alumnos', header: 'Alumnos distintos', ancho: 18 },
    { key: 'sesiones', header: 'Sesiones', ancho: 12 },
    { key: 'incidencias', header: 'Incidencias', ancho: 14 },
    { key: 'reservaciones', header: 'Reservaciones', ancho: 16 },
  ], filas, [
    { etiqueta: 'Ingresos', valor: String(consulta.entradas.length) },
    { etiqueta: 'Sesiones', valor: String(consulta.sesiones.length) },
    { etiqueta: 'Incidencias', valor: String(consulta.incidencias.length) },
  ], [])
}

function resumenSemestre(consulta: Consulta): Cuerpo {
  const filas = [1, 2, 3, 4, 5, 6].map((semestre) => {
    const entradas = consulta.entradas.filter((item) => item.semestre === semestre)
    const sesiones = consulta.sesiones.filter((item) => item.semestre === semestre)
    return {
      semestre: `${semestre}°`,
      alumnos: new Set(entradas.map((item) => item.alumnoId)).size,
      ingresos: entradas.length,
      sesiones: sesiones.length,
      materias: new Set(sesiones.map((item) => item.materia)).size,
    }
  })
  return cuerpo([
    { key: 'semestre', header: 'Semestre', ancho: 12 },
    { key: 'alumnos', header: 'Alumnos distintos', ancho: 18 },
    { key: 'ingresos', header: 'Ingresos', ancho: 12 },
    { key: 'sesiones', header: 'Sesiones', ancho: 12 },
    { key: 'materias', header: 'Materias con sesión', ancho: 20 },
  ], filas, [{ etiqueta: 'Ingresos', valor: String(consulta.entradas.length) }], [], 'El semestre es el de la clase registrada en la sesión.')
}

function estadisticas(consulta: Consulta): Cuerpo {
  const labs = laboratoriosDe(consulta).sort((a, b) => b.ingresos - a.ingresos)
  const turnos = (['matutino', 'vespertino'] as TurnoId[]).map((turno) => ({
    nombre: nombreTurno(turno),
    ingresos: consulta.entradas.filter((item) => item.turnoId === turno).length,
  })).sort((a, b) => b.ingresos - a.ingresos)
  const materias = new Map<string, number>()
  for (const entrada of consulta.entradas) materias.set(entrada.materia, (materias.get(entrada.materia) ?? 0) + 1)
  const materiaTop = [...materias.entries()].sort((a, b) => b[1] - a[1])[0]
  const filas = [
    { indicador: 'Ingresos', valor: String(consulta.entradas.length) },
    { indicador: 'Alumnos distintos', valor: String(new Set(consulta.entradas.map((item) => item.alumnoId)).size) },
    { indicador: 'Sesiones', valor: String(consulta.sesiones.length) },
    { indicador: 'Sesiones finalizadas', valor: String(consulta.sesiones.filter((item) => item.estado === 'finalizada').length) },
    { indicador: 'Sesiones canceladas', valor: String(consulta.sesiones.filter((item) => item.estado === 'cancelada').length) },
    { indicador: 'Reservaciones', valor: String(consulta.reservaciones.length) },
    { indicador: 'Incidencias', valor: String(consulta.incidencias.length) },
    { indicador: 'Incidencias sin resolver', valor: String(consulta.incidencias.filter((item) => item.estado !== 'resuelta').length) },
    { indicador: 'Equipos disponibles', valor: String(consulta.equiposEstado.filter((item) => item.estado === 'disponible').length) },
    { indicador: 'Equipos fuera de servicio', valor: String(consulta.equiposEstado.filter((item) => item.estado === 'fuera_de_servicio').length) },
    { indicador: 'Laboratorio con más ingresos', valor: labs[0] ? `${labs[0].laboratorio} (${labs[0].ingresos})` : 'Sin ingresos' },
    { indicador: 'Turno con más ingresos', valor: turnos[0] ? `${turnos[0].nombre} (${turnos[0].ingresos})` : 'Sin ingresos' },
    { indicador: 'Materia con más ingresos', valor: materiaTop ? `${materiaTop[0]} (${materiaTop[1]})` : 'Sin ingresos' },
  ]
  return cuerpo([
    { key: 'indicador', header: 'Indicador', ancho: 36 },
    { key: 'valor', header: 'Valor', ancho: 36 },
  ], filas, [], [], 'Los equipos reflejan el estado actual del escenario, no un historial por fecha.')
}

function laboratoriosDe(consulta: Consulta) {
  const ids = [...new Set([...consulta.entradas.map((item) => item.laboratorioId), ...consulta.sesiones.map((item) => item.laboratorioId)])]
  const nombres = new Map<string, string>()
  for (const item of [...consulta.entradas, ...consulta.sesiones]) nombres.set(item.laboratorioId, item.laboratorio)
  return ids.map((id) => ({
    laboratorio: nombres.get(id) ?? id,
    ingresos: consulta.entradas.filter((item) => item.laboratorioId === id).length,
    alumnos: new Set(consulta.entradas.filter((item) => item.laboratorioId === id).map((item) => item.alumnoId)).size,
    sesiones: consulta.sesiones.filter((item) => item.laboratorioId === id).length,
  }))
}

function filaEntrada(item: Entrada): FilaInforme {
  return {
    fecha: item.fecha,
    hora: item.hora,
    matricula: item.matricula,
    alumno: item.alumno,
    semestre: item.semestre,
    grupo: item.grupo,
    turno: item.turno,
    laboratorio: item.laboratorio,
    maestro: item.maestro,
    materia: item.materia,
    clave: item.clave,
    horario: item.horario,
  }
}

function cuerpo(columnas: ColumnaInforme[], filas: object[], totales: ParInforme[], resumen: ParInforme[], extra = ''): Cuerpo {
  return {
    columnas,
    filas: filas.map((item) => {
      const fila: FilaInforme = {}
      for (const [key, value] of Object.entries(item)) {
        if (typeof value === 'string' || typeof value === 'number') fila[key] = value
      }
      return fila
    }),
    totales,
    resumen,
    extra,
  }
}

function vacio(): Cuerpo {
  return cuerpo([], [], [], [])
}

function vacioTablero(): TableroInformes {
  return { ingresos: 0, alumnosDistintos: 0, labMayor: 'Sin ingresos', alumnosTop: [], porTurno: [], porLaboratorio: [], materiasTop: [], incidencias: 0, incidenciasPendientes: 0, equipos: [] }
}

function agrupar<T>(items: T[], clave: (item: T) => string) {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = clave(item)
    const lista = map.get(key)
    if (lista) lista.push(item)
    else map.set(key, [item])
  }
  return map
}

function describirFiltros(data: DemoData, filtros: FiltrosInforme) {
  const lineas: string[] = []
  if (filtros.alumno) lineas.push(`Alumno: ${filtros.alumno}`)
  if (filtros.matricula) lineas.push(`Matrícula: ${filtros.matricula}`)
  if (filtros.semestre) lineas.push(`Semestre: ${filtros.semestre}°`)
  if (filtros.grupo) lineas.push(`Grupo: ${filtros.grupo}`)
  if (filtros.maestroId) lineas.push(`Maestro: ${data.maestros.find((item) => item.id === filtros.maestroId)?.nombre ?? filtros.maestroId}`)
  if (filtros.materiaId) lineas.push(`Materia: ${data.materias.find((item) => item.id === filtros.materiaId)?.nombre ?? filtros.materiaId}`)
  if (filtros.laboratorioId) lineas.push(`Laboratorio: ${data.laboratorios.find((item) => item.id === filtros.laboratorioId)?.nombre ?? filtros.laboratorioId}`)
  if (filtros.turnoId === 'matutino' || filtros.turnoId === 'vespertino') lineas.push(`Turno: ${nombreTurno(filtros.turnoId)}`)
  if (filtros.estadoSesion) lineas.push(`Estado de sesión: ${etiquetaSesion(filtros.estadoSesion as EstadoSesion)}`)
  if (filtros.estadoIncidencia) lineas.push(`Estado de incidencia: ${etiquetaIncidencia(filtros.estadoIncidencia as EstadoIncidencia)}`)
  if (filtros.estadoEquipo) lineas.push(`Estado del equipo: ${etiquetaEquipo(filtros.estadoEquipo as EstadoEquipo)}`)
  return lineas
}

function enFecha(fecha: string, filtros: FiltrosInforme) {
  return fecha >= filtros.desde && fecha <= filtros.hasta
}

function contiene(valor: string, busca: string) {
  return valor.toLocaleLowerCase('es').includes(busca.trim().toLocaleLowerCase('es'))
}

function fechaLegible(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return `${day} de ${MESES[month - 1]} de ${year}`
}

function estadoValido(value: string, permitidos: string[]) {
  return permitidos.includes(value) ? value : ''
}

function etiquetaSesion(estado: EstadoSesion) {
  if (estado === 'programada') return 'Programada'
  if (estado === 'activa') return 'En curso'
  if (estado === 'finalizada') return 'Finalizada'
  return 'Cancelada'
}

function etiquetaIncidencia(estado: EstadoIncidencia) {
  if (estado === 'pendiente') return 'Pendiente'
  if (estado === 'en_atencion') return 'En atención'
  return 'Resuelta'
}

function etiquetaEquipo(estado: EstadoEquipo) {
  if (estado === 'disponible') return 'Disponible'
  if (estado === 'ocupada') return 'Ocupada'
  if (estado === 'mantenimiento') return 'En mantenimiento'
  return 'Fuera de servicio'
}

function etiquetaReserva(estado: string) {
  if (estado === 'pendiente') return 'Pendiente'
  if (estado === 'aceptada') return 'Aceptada'
  return 'Rechazada'
}
