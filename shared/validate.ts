import { esExpedienteDePrueba, grupoValido, semestreValido, turnoValido } from './academico.ts'
import { matriculaValida } from './credencial.ts'
import { conflictoDeHorario, dentroDeRango, esIngresoDuplicado, fechaValida, horaValida, rangosSeCruzan, toMinutes } from './schedule.ts'
import type { DemoData, EstadoAlumno, EstadoEquipo, EstadoIncidencia, EstadoLaboratorio, EstadoPersona, EstadoReservacion, EstadoSesion, Rol } from './types.ts'

export interface FieldError {
  field: string
  message: string
}

export type Revision =
  | { ok: true; message: string }
  | { ok: false; errors: FieldError[]; message: string; conflict?: boolean }

const MENSAJE_OK = 'Datos válidos.'

const ESTADOS_ALUMNO = new Set<EstadoAlumno>(['activo', 'inactivo'])
const ESTADOS_PERSONA = new Set<EstadoPersona>(['activo', 'inactivo'])
const ESTADOS_LAB = new Set<EstadoLaboratorio>(['operativo', 'parcial', 'cerrado'])
const ESTADOS_EQUIPO = new Set<EstadoEquipo>(['disponible', 'ocupada', 'mantenimiento', 'fuera_de_servicio'])
const ESTADOS_SESION = new Set<EstadoSesion>(['programada', 'activa', 'finalizada', 'cancelada'])
const ESTADOS_INCIDENCIA = new Set<EstadoIncidencia>(['pendiente', 'en_atencion', 'resuelta'])
const ROLES = new Set<Rol>(['administrador', 'encargado'])

function fallo(errors: FieldError[], conflict = false): Revision {
  return { ok: false, errors, conflict, message: errors[0]?.message ?? 'Revisa los datos.' }
}

function texto(value: unknown) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()
}

function registro(datos: unknown) {
  return datos && typeof datos === 'object' ? (datos as Record<string, unknown>) : {}
}

function correoValido(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Revisa formato y reglas de negocio sobre el conjunto de datos recibido.
 * En esta etapa la interfaz envía el estado en pantalla. La API usa el mismo
 * código con los datos de demostración y responde que nada se persistió.
 */
export function revisar(tipo: string, datos: unknown, data: DemoData): Revision {
  const input = registro(datos)

  switch (tipo) {
    case 'alumno':
      return revisarAlumno(input, data, texto(input.id))
    case 'ingreso':
      return revisarIngreso(input, data)
    case 'ingreso.prueba':
      return { ok: true, message: MENSAJE_OK }
    case 'maestro':
      return revisarMaestro(input, data, texto(input.id))
    case 'materia':
      return revisarMateria(input, data, texto(input.id))
    case 'sesion':
      return revisarSesion(input, data)
    case 'sesion.estado':
      return revisarEstadoSesion(input, data)
    case 'turno':
      return revisarTurno(input, data)
    case 'laboratorio':
      return revisarLaboratorio(input, data)
    case 'equipo':
      return revisarEquipo(input, data, texto(input.id), Boolean(input.editando))
    case 'equipo.foto':
      return revisarFotoEquipo(input, data)
    case 'equipo.estado':
      return revisarEstadoEquipo(input, data)
    case 'mantenimiento':
      return revisarMantenimiento(input, data)
    case 'incidencia':
      return revisarIncidencia(input, data)
    case 'incidencia.foto':
      return revisarFotoIncidencia(input, data)
    case 'incidencia.estado':
      return revisarEstadoIncidencia(input, data)
    case 'reservacion':
      return revisarReservacion(input, data)
    case 'reservacion.estado':
      return revisarEstadoReservacion(input, data)
    case 'usuario':
      return revisarUsuario(input, data, texto(input.id))
    default:
      return fallo([{ field: 'tipo', message: 'Operación no reconocida.' }])
  }
}

function revisarAlumno(input: Record<string, unknown>, data: DemoData, ignoreId: string): Revision {
  const errors: FieldError[] = []
  const matricula = texto(input.matricula)
  const nombre = texto(input.nombre)
  const grupo = texto(input.grupo).toUpperCase()
  const turnoId = texto(input.turnoId)
  const estado = texto(input.estado) as EstadoAlumno
  const semestre = Number(input.semestre)

  if (!matriculaValida(matricula.toUpperCase())) errors.push({ field: 'matricula', message: 'La matrícula debe tener entre 6 y 14 caracteres y al menos un dígito.' })
  if (nombre.length < 5 || !nombre.includes(' ')) errors.push({ field: 'nombre', message: 'Escribe el nombre completo.' })
  if (!semestreValido(semestre)) errors.push({ field: 'semestre', message: 'El semestre debe estar entre 1° y 6°.' })
  if (!grupoValido(grupo)) errors.push({ field: 'grupo', message: 'El grupo debe ser una letra, como A o B.' })
  if (!turnoValido(turnoId)) errors.push({ field: 'turnoId', message: 'Selecciona el turno.' })
  if (!ESTADOS_ALUMNO.has(estado)) errors.push({ field: 'estado', message: 'Selecciona el estado del alumno.' })
  if (data.alumnos.some((alumno) => alumno.matricula.toUpperCase() === matricula.toUpperCase() && alumno.id !== ignoreId)) {
    errors.push({ field: 'matricula', message: 'Esa matrícula ya está registrada.' })
  }
  return errors.length ? fallo(errors) : { ok: true, message: MENSAJE_OK }
}

function revisarIngreso(input: Record<string, unknown>, data: DemoData): Revision {
  const matricula = texto(input.matricula).toUpperCase()
  const sesion = data.sesiones.find((item) => item.id === texto(input.sesionId))
  const fecha = texto(input.fecha)
  const hora = texto(input.hora).slice(0, 5)

  if (!matriculaValida(matricula)) {
    return fallo([{ field: 'matricula', message: 'El código no trae un expediente válido.' }])
  }
  if (!sesion || (sesion.estado !== 'activa' && sesion.estado !== 'programada')) {
    return fallo([{ field: 'sesionId', message: 'No hay una sesión en curso para registrar el ingreso.' }])
  }
  if (sesion.laboratorioId !== texto(input.laboratorioId)) {
    return fallo([{ field: 'laboratorioId', message: 'La sesión no corresponde al laboratorio seleccionado.' }])
  }
  if (sesion.fecha !== fecha || !horaValida(hora)) {
    return fallo([{ field: 'fecha', message: 'La fecha o la hora del ingreso no coinciden con la sesión.' }])
  }
  if (toMinutes(hora) < toMinutes(sesion.horaInicio) || toMinutes(hora) >= toMinutes(sesion.horaFin)) {
    return fallo([{ field: 'hora', message: 'Esa hora queda fuera de la sesión en curso.' }])
  }

  const alumno = data.alumnos.find((item) => item.matricula.toUpperCase() === matricula)
  if (alumno) {
    if (alumno.estado !== 'activo' && !esExpedienteDePrueba(matricula)) {
      return fallo([{ field: 'estado', message: `${alumno.nombre} está inactivo y no puede ingresar.` }])
    }
    if (esIngresoDuplicado(data.ingresos, alumno.id, sesion.id)) {
      return fallo([{ field: 'matricula', message: `${alumno.nombre} ya tiene un ingreso en esta sesión.` }], true)
    }
    return { ok: true, message: MENSAJE_OK }
  }

  const nombre = texto(input.nombre)
  const semestre = input.semestre == null || input.semestre === '' ? sesion.semestre : Number(input.semestre)
  const grupo = (texto(input.grupo) || sesion.grupo).toUpperCase()
  const turnoId = texto(input.turnoId) || sesion.turnoId
  const errors: FieldError[] = []
  const soloExpediente = !nombre || nombre.toUpperCase() === matricula
  if (!soloExpediente && (nombre.length < 5 || !nombre.includes(' '))) errors.push({ field: 'nombre', message: 'El código no incluye el nombre completo del alumno.' })
  if (!semestreValido(semestre)) errors.push({ field: 'semestre', message: 'El QR no incluye un semestre válido.' })
  if (!grupoValido(grupo)) errors.push({ field: 'grupo', message: 'El QR no incluye un grupo válido.' })
  if (!turnoValido(turnoId)) errors.push({ field: 'turnoId', message: 'El QR no incluye un turno válido.' })
  return errors.length ? fallo(errors) : { ok: true, message: MENSAJE_OK }
}

function revisarMaestro(input: Record<string, unknown>, data: DemoData, ignoreId: string): Revision {
  const errors: FieldError[] = []
  const numeroEmpleado = texto(input.numeroEmpleado).toUpperCase()
  const nombre = texto(input.nombre)
  const correo = texto(input.correo).toLowerCase()
  const turnoId = texto(input.turnoId)
  const estado = texto(input.estado) as EstadoPersona

  if (!/^EMP-\d{3,6}$/.test(numeroEmpleado)) {
    errors.push({ field: 'numeroEmpleado', message: 'Usa el formato EMP-0000.' })
  }
  if (nombre.length < 5 || !nombre.includes(' ')) errors.push({ field: 'nombre', message: 'Escribe el nombre completo.' })
  if (!correoValido(correo)) errors.push({ field: 'correo', message: 'Escribe un correo válido.' })
  if (!turnoValido(turnoId)) errors.push({ field: 'turnoId', message: 'Selecciona el turno en el que trabaja.' })
  if (!ESTADOS_PERSONA.has(estado)) errors.push({ field: 'estado', message: 'Selecciona el estado.' })
  if (turnoValido(turnoId) && data.materias.some((materia) => materia.maestroId === ignoreId && materia.turnoId !== turnoId)) {
    errors.push({ field: 'turnoId', message: 'Este maestro tiene materias en el otro turno. Actualízalas primero.' })
  }
  if (data.maestros.some((maestro) => maestro.numeroEmpleado.toUpperCase() === numeroEmpleado && maestro.id !== ignoreId)) {
    errors.push({ field: 'numeroEmpleado', message: 'Ese número de empleado ya existe.' })
  }
  if (data.maestros.some((maestro) => maestro.correo.toLowerCase() === correo && maestro.id !== ignoreId)) {
    errors.push({ field: 'correo', message: 'Ese correo ya está registrado.' })
  }
  return errors.length ? fallo(errors) : { ok: true, message: MENSAJE_OK }
}

function revisarMateria(input: Record<string, unknown>, data: DemoData, ignoreId: string): Revision {
  const errors: FieldError[] = []
  const clave = texto(input.clave).toUpperCase()
  const nombre = texto(input.nombre)
  const grupo = texto(input.grupo).toUpperCase()
  const turnoId = texto(input.turnoId)
  const maestroId = texto(input.maestroId)
  const semestre = Number(input.semestre)
  const maestro = data.maestros.find((item) => item.id === maestroId)

  if (!/^[A-Z]{2,5}-\d{3}$/.test(clave)) errors.push({ field: 'clave', message: 'Usa una clave como INF-101.' })
  if (nombre.length < 3) errors.push({ field: 'nombre', message: 'Escribe el nombre de la materia.' })
  if (!semestreValido(semestre)) errors.push({ field: 'semestre', message: 'El semestre debe estar entre 1° y 6°.' })
  if (!grupoValido(grupo)) errors.push({ field: 'grupo', message: 'El grupo debe ser una letra, como A o B.' })
  if (!turnoValido(turnoId)) errors.push({ field: 'turnoId', message: 'Selecciona el turno.' })
  if (!maestro) errors.push({ field: 'maestroId', message: 'Selecciona el maestro asignado.' })
  else if (turnoValido(turnoId) && maestro.turnoId !== turnoId) {
    errors.push({ field: 'maestroId', message: 'El maestro trabaja en otro turno.' })
  }
  if (data.materias.some((materia) => materia.clave === clave && materia.semestre === semestre && materia.grupo === grupo && materia.turnoId === turnoId && materia.id !== ignoreId)) {
    errors.push({ field: 'clave', message: 'Esa materia ya está asignada a ese semestre, grupo y turno.' })
  }
  return errors.length ? fallo(errors) : { ok: true, message: MENSAJE_OK }
}

function revisarHorarioBase(input: Record<string, unknown>, data: DemoData) {
  const errors: FieldError[] = []
  const laboratorioId = texto(input.laboratorioId)
  const maestroId = texto(input.maestroId)
  const materiaId = texto(input.materiaId)
  const grupo = texto(input.grupo).toUpperCase()
  const fecha = texto(input.fecha)
  const horaInicio = texto(input.horaInicio)
  const horaFin = texto(input.horaFin)

  if (!data.laboratorios.some((laboratorio) => laboratorio.id === laboratorioId)) {
    errors.push({ field: 'laboratorioId', message: 'Selecciona el laboratorio.' })
  }
  const maestro = data.maestros.find((item) => item.id === maestroId)
  if (!maestro) errors.push({ field: 'maestroId', message: 'Selecciona el maestro.' })
  else if (maestro.estado !== 'activo') errors.push({ field: 'maestroId', message: 'El maestro seleccionado no está activo.' })
  if (!data.materias.some((materia) => materia.id === materiaId)) {
    errors.push({ field: 'materiaId', message: 'Selecciona la materia.' })
  }
  if (!grupoValido(grupo)) errors.push({ field: 'grupo', message: 'Selecciona el grupo.' })
  if (!fechaValida(fecha)) errors.push({ field: 'fecha', message: 'Selecciona una fecha válida.' })
  if (!horaValida(horaInicio)) errors.push({ field: 'horaInicio', message: 'Selecciona la hora de inicio.' })
  if (!horaValida(horaFin)) errors.push({ field: 'horaFin', message: 'Selecciona la hora de fin.' })
  if (horaValida(horaInicio) && horaValida(horaFin) && toMinutes(horaFin) <= toMinutes(horaInicio)) {
    errors.push({ field: 'horaFin', message: 'La hora de fin debe ser posterior a la de inicio.' })
  }

  return { errors, slot: { laboratorioId, maestroId, materiaId, grupo, fecha, horaInicio, horaFin } }
}

function describirConflicto(data: DemoData, conflicto: { tipo: 'sesion' | 'reservacion'; id: string }) {
  if (conflicto.tipo === 'sesion') {
    const sesion = data.sesiones.find((item) => item.id === conflicto.id)
    if (!sesion) return 'Ese horario se cruza con otra sesión del laboratorio.'
    const lab = data.laboratorios.find((item) => item.id === sesion.laboratorioId)?.nombre ?? 'el laboratorio'
    const materia = data.materias.find((item) => item.id === sesion.materiaId)
    const maestro = data.maestros.find((item) => item.id === sesion.maestroId)?.nombre ?? 'un maestro'
    return `Ese horario está ocupado en ${lab} por ${materia?.nombre ?? 'una materia'}, ${sesion.semestre}° ${sesion.grupo}, con ${maestro} (${sesion.horaInicio}–${sesion.horaFin}).`
  }
  const reserva = data.reservaciones.find((item) => item.id === conflicto.id)
  if (!reserva) return 'Ese horario se cruza con una reservación.'
  const lab = data.laboratorios.find((item) => item.id === reserva.laboratorioId)?.nombre ?? 'el laboratorio'
  const materia = data.materias.find((item) => item.id === reserva.materiaId)
  const maestro = data.maestros.find((item) => item.id === reserva.maestroId)?.nombre ?? 'un maestro'
  const clase = materia ? `${materia.nombre}, ${materia.semestre}° ${materia.grupo}` : `grupo ${reserva.grupo}`
  return `Ese horario está ocupado en ${lab} por una reservación de ${clase}, con ${maestro} (${reserva.horaInicio}–${reserva.horaFin}).`
}

function revisarSesion(input: Record<string, unknown>, data: DemoData): Revision {
  const { errors, slot } = revisarHorarioBase(input, data)
  const turnoId = texto(input.turnoId)
  const turno = data.turnos.find((item) => item.id === turnoId)
  const materia = data.materias.find((item) => item.id === slot.materiaId)
  const semestre = Number(input.semestre)
  if (turnoId !== 'matutino' && turnoId !== 'vespertino') {
    errors.push({ field: 'turnoId', message: 'Selecciona el turno.' })
  } else if (!turno?.configurado || !turno.horaInicio || !turno.horaFin) {
    errors.push({ field: 'turnoId', message: 'Configura el horario de ese turno antes de crear la sesión.' })
  } else if (
    horaValida(slot.horaInicio)
    && horaValida(slot.horaFin)
    && toMinutes(slot.horaFin) > toMinutes(slot.horaInicio)
    && !dentroDeRango(slot.horaInicio, slot.horaFin, turno.horaInicio, turno.horaFin)
  ) {
    errors.push({
      field: 'horaInicio',
      message: `El horario debe quedar dentro del ${turno.nombre} (${turno.horaInicio}–${turno.horaFin}).`,
    })
  }
  if (materia && slot.grupo && slot.grupo !== materia.grupo) {
    errors.push({ field: 'grupo', message: 'El grupo debe ser el registrado en la materia.' })
  }
  if (materia && semestre !== materia.semestre) {
    errors.push({ field: 'semestre', message: 'El semestre debe ser el registrado en la materia.' })
  }
  if (materia && turnoValido(turnoId) && materia.turnoId !== turnoId) {
    errors.push({ field: 'turnoId', message: 'La materia pertenece a otro turno.' })
  }
  if (!errors.length) {
    const conflicto = conflictoDeHorario(data.sesiones, data.reservaciones, slot)
    if (conflicto) {
      errors.push({ field: 'horaInicio', message: describirConflicto(data, conflicto) })
      return fallo(errors, true)
    }
  }
  return errors.length ? fallo(errors) : { ok: true, message: MENSAJE_OK }
}

function revisarTurno(input: Record<string, unknown>, data: DemoData): Revision {
  const id = texto(input.id)
  const turno = data.turnos.find((item) => item.id === id)
  if (!turno) return fallo([{ field: 'id', message: 'No se encontró el turno.' }])
  const configurado = input.configurado === true
  if (!configurado) return { ok: true, message: MENSAJE_OK }
  const errors: FieldError[] = []
  const horaInicio = texto(input.horaInicio)
  const horaFin = texto(input.horaFin)
  if (!horaValida(horaInicio)) errors.push({ field: 'horaInicio', message: 'Selecciona la hora de inicio.' })
  if (!horaValida(horaFin)) errors.push({ field: 'horaFin', message: 'Selecciona la hora de fin.' })
  if (horaValida(horaInicio) && horaValida(horaFin) && toMinutes(horaFin) <= toMinutes(horaInicio)) {
    errors.push({ field: 'horaFin', message: 'La hora de fin debe ser posterior a la de inicio.' })
  }
  const otro = data.turnos.find((item) => item.id !== id && item.configurado && item.horaInicio && item.horaFin)
  if (otro?.horaInicio && otro.horaFin && horaValida(horaInicio) && horaValida(horaFin) && toMinutes(horaFin) > toMinutes(horaInicio)) {
    if (rangosSeCruzan(horaInicio, horaFin, otro.horaInicio, otro.horaFin)) {
      errors.push({ field: 'horaInicio', message: `Ese horario se cruza con el ${otro.nombre}.` })
    }
  }
  return errors.length ? fallo(errors) : { ok: true, message: MENSAJE_OK }
}

function revisarEstadoSesion(input: Record<string, unknown>, data: DemoData): Revision {
  const sesion = data.sesiones.find((item) => item.id === texto(input.id))
  const estado = texto(input.estado)
  if (!sesion) return fallo([{ field: 'estado', message: 'No se encontró la sesión.' }])
  const permitidas: Record<EstadoSesion, string[]> = {
    programada: ['activa', 'cancelada'],
    activa: ['finalizada', 'cancelada'],
    finalizada: [],
    cancelada: [],
  }
  if (!ESTADOS_SESION.has(estado as EstadoSesion) || !permitidas[sesion.estado].includes(estado)) {
    return fallo([{ field: 'estado', message: 'Esa transición de estado no está permitida.' }])
  }
  return { ok: true, message: MENSAJE_OK }
}

function revisarLaboratorio(input: Record<string, unknown>, data: DemoData): Revision {
  const errors: FieldError[] = []
  const id = texto(input.id)
  const descripcion = texto(input.descripcion)
  const ubicacion = texto(input.ubicacion)
  const estado = texto(input.estado) as EstadoLaboratorio
  const capacidad = Number(input.capacidad)
  if (!data.laboratorios.some((laboratorio) => laboratorio.id === id)) {
    errors.push({ field: 'id', message: 'No se encontró el laboratorio.' })
  }
  if (descripcion.length < 10) errors.push({ field: 'descripcion', message: 'Describe el laboratorio con un poco más de detalle.' })
  if (ubicacion.length < 5) errors.push({ field: 'ubicacion', message: 'Escribe la ubicación.' })
  if (!ESTADOS_LAB.has(estado)) errors.push({ field: 'estado', message: 'Selecciona el estado general.' })
  if (!Number.isInteger(capacidad) || capacidad < 1 || capacidad > 80) {
    errors.push({ field: 'capacidad', message: 'La capacidad debe estar entre 1 y 80.' })
  }
  return errors.length ? fallo(errors) : { ok: true, message: MENSAJE_OK }
}

function revisarEquipo(input: Record<string, unknown>, data: DemoData, ignoreId: string, editando: boolean): Revision {
  const errors: FieldError[] = []
  const id = texto(input.id).toUpperCase()
  const laboratorioId = texto(input.laboratorioId)
  const estado = texto(input.estado) as EstadoEquipo
  const descripcion = texto(input.descripcion)
  if (!/^LAB[12]-PC\d{2}$/.test(id)) errors.push({ field: 'id', message: 'Usa un identificador como LAB1-PC01.' })
  if ((id.startsWith('LAB1') && laboratorioId !== 'lab-1') || (id.startsWith('LAB2') && laboratorioId !== 'lab-2')) {
    errors.push({ field: 'laboratorioId', message: 'El identificador no corresponde al laboratorio seleccionado.' })
  }
  if (!data.laboratorios.some((laboratorio) => laboratorio.id === laboratorioId)) {
    errors.push({ field: 'laboratorioId', message: 'Selecciona el laboratorio.' })
  }
  if (!ESTADOS_EQUIPO.has(estado)) errors.push({ field: 'estado', message: 'Selecciona el estado del equipo.' })
  if (descripcion.length < 10) errors.push({ field: 'descripcion', message: 'Describe el equipo.' })
  const foto = mensajeFoto(input.foto)
  if (foto) errors.push({ field: 'foto', message: foto })
  if (data.equipos.some((equipo) => equipo.id === id && equipo.id !== ignoreId)) {
    errors.push({ field: 'id', message: 'Ese identificador ya existe.' })
  }
  if (editando && ignoreId && !data.equipos.some((equipo) => equipo.id === ignoreId)) {
    errors.push({ field: 'id', message: 'No se encontró el equipo.' })
  }
  return errors.length ? fallo(errors) : { ok: true, message: MENSAJE_OK }
}

function mensajeFoto(valor: unknown) {
  if (valor == null || valor === '') return ''
  if (typeof valor !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(valor)) {
    return 'La foto debe ser una imagen JPG, PNG o WebP.'
  }
  if (valor.length > 220_000) return 'La foto es demasiado pesada. Usa una más pequeña.'
  return ''
}

function revisarFotoEquipo(input: Record<string, unknown>, data: DemoData): Revision {
  const equipo = data.equipos.find((item) => item.id === texto(input.id))
  if (!equipo) return fallo([{ field: 'foto', message: 'No se encontró el equipo.' }])
  const foto = mensajeFoto(input.foto)
  return foto ? fallo([{ field: 'foto', message: foto }]) : { ok: true, message: MENSAJE_OK }
}

function revisarEstadoEquipo(input: Record<string, unknown>, data: DemoData): Revision {
  const equipo = data.equipos.find((item) => item.id === texto(input.id))
  const estado = texto(input.estado) as EstadoEquipo
  if (!equipo) return fallo([{ field: 'estado', message: 'No se encontró el equipo.' }])
  if (!ESTADOS_EQUIPO.has(estado)) return fallo([{ field: 'estado', message: 'Selecciona un estado válido.' }])
  return { ok: true, message: MENSAJE_OK }
}

function revisarMantenimiento(input: Record<string, unknown>, data: DemoData): Revision {
  const errors: FieldError[] = []
  const equipoId = texto(input.equipoId)
  const fecha = texto(input.fecha)
  const descripcion = texto(input.descripcion)
  if (!data.equipos.some((equipo) => equipo.id === equipoId)) errors.push({ field: 'equipoId', message: 'Selecciona el equipo.' })
  if (!fechaValida(fecha)) errors.push({ field: 'fecha', message: 'Selecciona la fecha.' })
  if (descripcion.length < 8) errors.push({ field: 'descripcion', message: 'Describe el trabajo realizado.' })
  return errors.length ? fallo(errors) : { ok: true, message: MENSAJE_OK }
}

function revisarIncidencia(input: Record<string, unknown>, data: DemoData): Revision {
  const errors: FieldError[] = []
  const laboratorioId = texto(input.laboratorioId)
  const equipoId = texto(input.equipoId)
  const descripcion = texto(input.descripcion)
  if (!data.laboratorios.some((laboratorio) => laboratorio.id === laboratorioId)) {
    errors.push({ field: 'laboratorioId', message: 'Selecciona el laboratorio.' })
  }
  if (equipoId) {
    const equipo = data.equipos.find((item) => item.id === equipoId)
    if (!equipo || equipo.laboratorioId !== laboratorioId) {
      errors.push({ field: 'equipoId', message: 'El equipo no pertenece a ese laboratorio.' })
    }
  }
  if (descripcion.length < 10) errors.push({ field: 'descripcion', message: 'Describe el problema con más detalle.' })
  const foto = mensajeFoto(input.foto)
  if (foto) errors.push({ field: 'foto', message: foto })
  return errors.length ? fallo(errors) : { ok: true, message: MENSAJE_OK }
}

function revisarFotoIncidencia(input: Record<string, unknown>, data: DemoData): Revision {
  const incidencia = data.incidencias.find((item) => item.id === texto(input.id))
  if (!incidencia) return fallo([{ field: 'foto', message: 'No se encontró la incidencia.' }])
  const foto = mensajeFoto(input.foto)
  return foto ? fallo([{ field: 'foto', message: foto }]) : { ok: true, message: MENSAJE_OK }
}

function revisarEstadoIncidencia(input: Record<string, unknown>, data: DemoData): Revision {
  const incidencia = data.incidencias.find((item) => item.id === texto(input.id))
  const estado = texto(input.estado) as EstadoIncidencia
  if (!incidencia) return fallo([{ field: 'estado', message: 'No se encontró la incidencia.' }])
  if (!ESTADOS_INCIDENCIA.has(estado)) return fallo([{ field: 'estado', message: 'Selecciona un estado válido.' }])
  return { ok: true, message: MENSAJE_OK }
}

function revisarReservacion(input: Record<string, unknown>, data: DemoData): Revision {
  const { errors, slot } = revisarHorarioBase(input, data)
  const materia = data.materias.find((item) => item.id === slot.materiaId)
  if (materia && slot.grupo && slot.grupo !== materia.grupo) {
    errors.push({ field: 'grupo', message: 'El grupo debe ser el registrado en la materia.' })
  }
  if (!errors.length) {
    const conflicto = conflictoDeHorario(data.sesiones, data.reservaciones, slot)
    if (conflicto) {
      errors.push({ field: 'horaInicio', message: describirConflicto(data, conflicto) })
      return fallo(errors, true)
    }
  }
  return errors.length ? fallo(errors) : { ok: true, message: MENSAJE_OK }
}

function revisarEstadoReservacion(input: Record<string, unknown>, data: DemoData): Revision {
  const reserva = data.reservaciones.find((item) => item.id === texto(input.id))
  const estado = texto(input.estado) as EstadoReservacion
  if (!reserva) return fallo([{ field: 'estado', message: 'No se encontró la reservación.' }])
  if (reserva.estado !== 'pendiente') {
    return fallo([{ field: 'estado', message: 'Solo se pueden resolver solicitudes pendientes.' }])
  }
  if (estado !== 'aceptada' && estado !== 'rechazada') {
    return fallo([{ field: 'estado', message: 'Selecciona aceptar o rechazar.' }])
  }
  if (estado === 'aceptada') {
    const conflicto = conflictoDeHorario(data.sesiones, data.reservaciones, reserva, { reservacionId: reserva.id })
    if (conflicto) {
      return fallo([{ field: 'estado', message: describirConflicto(data, conflicto) }], true)
    }
  }
  return { ok: true, message: MENSAJE_OK }
}

function revisarUsuario(input: Record<string, unknown>, data: DemoData, ignoreId: string): Revision {
  const errors: FieldError[] = []
  const nombre = texto(input.nombre)
  const correo = texto(input.correo).toLowerCase()
  const rol = texto(input.rol) as Rol
  const estado = texto(input.estado) as EstadoPersona
  if (nombre.length < 5 || !nombre.includes(' ')) errors.push({ field: 'nombre', message: 'Escribe el nombre completo.' })
  if (!correoValido(correo)) errors.push({ field: 'correo', message: 'Escribe un correo válido.' })
  if (!ROLES.has(rol)) errors.push({ field: 'rol', message: 'Selecciona el rol.' })
  if (!ESTADOS_PERSONA.has(estado)) errors.push({ field: 'estado', message: 'Selecciona el estado.' })
  if (data.usuarios.some((usuario) => usuario.correo.toLowerCase() === correo && usuario.id !== ignoreId)) {
    errors.push({ field: 'correo', message: 'Ese correo ya está registrado.' })
  }
  return errors.length ? fallo(errors) : { ok: true, message: MENSAJE_OK }
}
