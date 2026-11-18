import { etiquetaGrupo, semestreValido } from './academico.ts'
import type { Alumno, DemoData, Equipo, EstadoEquipo, EstadoIncidencia, EstadoLaboratorio, EstadoPersona, EstadoReservacion, EstadoSesion, Incidencia, Maestro, Materia, Rol, TurnoId, Usuario } from './types.ts'

function texto(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function ahora() {
  const date = new Date()
  const p = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

function idDe(datos: Record<string, unknown>, ids: string[], indice = 0) {
  return texto(datos.id) || ids[indice] || ''
}

function sincronizarMaterias(data: DemoData) {
  for (const maestro of data.maestros) {
    maestro.materias = data.materias
      .filter((materia) => materia.maestroId === maestro.id)
      .map((materia) => `${materia.nombre} · ${etiquetaGrupo(materia.semestre, materia.grupo)}`)
  }
}

export function aplicarOperacion(data: DemoData, tipo: string, datos: Record<string, unknown>, ids: string[], usuario: string) {
  switch (tipo) {
    case 'alumno':
      guardarAlumno(data, datos, idDe(datos, ids))
      break
    case 'alumnos.carga':
      cargarAlumnos(data, datos)
      break
    case 'ingreso':
      guardarIngreso(data, datos, ids)
      break
    case 'ingreso.prueba':
      quitarIngreso(data, datos)
      break
    case 'maestro':
      guardarMaestro(data, datos, idDe(datos, ids))
      break
    case 'materia':
      guardarMateria(data, datos, idDe(datos, ids))
      sincronizarMaterias(data)
      break
    case 'sesion':
      data.sesiones.unshift({
        id: ids[0],
        laboratorioId: texto(datos.laboratorioId),
        maestroId: texto(datos.maestroId),
        materiaId: texto(datos.materiaId),
        semestre: Number(datos.semestre),
        grupo: texto(datos.grupo).toUpperCase(),
        turnoId: texto(datos.turnoId) as TurnoId,
        fecha: texto(datos.fecha),
        horaInicio: texto(datos.horaInicio),
        horaFin: texto(datos.horaFin),
        estado: 'programada',
      })
      break
    case 'sesion.estado': {
      const item = data.sesiones.find((row) => row.id === texto(datos.id))
      if (item) item.estado = texto(datos.estado) as EstadoSesion
      break
    }
    case 'turno': {
      const item = data.turnos.find((row) => row.id === texto(datos.id))
      if (!item) break
      const configurado = datos.configurado === true
      item.configurado = configurado
      item.horaInicio = configurado ? texto(datos.horaInicio) : null
      item.horaFin = configurado ? texto(datos.horaFin) : null
      item.origen = 'sesion'
      break
    }
    case 'laboratorio': {
      const item = data.laboratorios.find((row) => row.id === texto(datos.id))
      if (!item) break
      item.ubicacion = texto(datos.ubicacion)
      item.descripcion = texto(datos.descripcion)
      item.capacidad = Number(datos.capacidad)
      item.estado = texto(datos.estado) as EstadoLaboratorio
      break
    }
    case 'equipo': {
      const id = texto(datos.id).toUpperCase()
      const foto = texto(datos.foto)
      data.equipos.push({
        id,
        laboratorioId: texto(datos.laboratorioId),
        estado: texto(datos.estado) as EstadoEquipo,
        descripcion: texto(datos.descripcion),
        ...(foto ? { foto } : {}),
      })
      data.equipos.sort((a, b) => a.id.localeCompare(b.id))
      contarEquipos(data)
      break
    }
    case 'equipo.foto': {
      const item = data.equipos.find((row) => row.id === texto(datos.id))
      if (!item) break
      const foto = texto(datos.foto)
      if (foto) item.foto = foto
      else delete item.foto
      break
    }
    case 'equipo.estado': {
      const item = data.equipos.find((row) => row.id === texto(datos.id))
      if (item) item.estado = texto(datos.estado) as Equipo['estado']
      break
    }
    case 'mantenimiento':
      data.mantenimientos.unshift({
        id: ids[0],
        equipoId: texto(datos.equipoId),
        fecha: texto(datos.fecha),
        descripcion: texto(datos.descripcion),
        responsable: usuario,
      })
      break
    case 'incidencia':
      data.incidencias.unshift(nuevaIncidencia(datos, ids[0], usuario))
      break
    case 'incidencia.foto': {
      const item = data.incidencias.find((row) => row.id === texto(datos.id))
      if (!item) break
      const foto = texto(datos.foto)
      if (foto) item.foto = foto
      else delete item.foto
      break
    }
    case 'incidencia.estado':
      actualizarIncidencia(data, datos, usuario)
      break
    case 'reservacion':
      data.reservaciones.unshift({
        id: ids[0],
        laboratorioId: texto(datos.laboratorioId),
        maestroId: texto(datos.maestroId),
        materiaId: texto(datos.materiaId),
        grupo: texto(datos.grupo),
        fecha: texto(datos.fecha),
        horaInicio: texto(datos.horaInicio),
        horaFin: texto(datos.horaFin),
        estado: 'pendiente',
      })
      break
    case 'reservacion.estado': {
      const item = data.reservaciones.find((row) => row.id === texto(datos.id))
      if (!item) break
      item.estado = texto(datos.estado) as EstadoReservacion
      const motivo = texto(datos.motivo)
      if (motivo) item.motivo = motivo
      break
    }
    case 'usuario':
      guardarUsuario(data, datos, idDe(datos, ids))
      break
    default:
      throw new Error('Operación no reconocida.')
  }

  const accion = texto(datos.accion)
  data.bitacora.unshift({
    id: `bit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fechaHora: ahora(),
    usuario,
    accion: accion || tipo,
    origen: 'sesion',
  })
}

function guardarAlumno(data: DemoData, datos: Record<string, unknown>, id: string) {
  const record: Alumno = {
    id,
    matricula: texto(datos.matricula).toUpperCase(),
    nombre: texto(datos.nombre),
    plantel: texto(datos.plantel) || undefined,
    semestre: Number(datos.semestre),
    grupo: texto(datos.grupo).toUpperCase(),
    turnoId: texto(datos.turnoId) as TurnoId,
    estado: texto(datos.estado) as Alumno['estado'],
  }
  const index = data.alumnos.findIndex((alumno) => alumno.id === id)
  if (index >= 0) data.alumnos[index] = record
  else data.alumnos.unshift(record)
}

function cargarAlumnos(data: DemoData, datos: Record<string, unknown>) {
  const filas = Array.isArray(datos.filas) ? datos.filas : []
  for (const fila of filas) {
    if (!fila || typeof fila !== 'object') continue
    const item = fila as Record<string, unknown>
    const matricula = texto(item.matricula).toUpperCase()
    const previo = data.alumnos.find((alumno) => alumno.matricula.toUpperCase() === matricula)
    guardarAlumno(data, item, previo?.id || texto(item.id))
  }
}

function guardarIngreso(data: DemoData, datos: Record<string, unknown>, ids: string[]) {
  const matricula = texto(datos.matricula).toUpperCase()
  const existente = data.alumnos.find((alumno) => alumno.matricula.toUpperCase() === matricula)
  const alumnoId = existente?.id ?? ids[0]
  const semestre = Number(datos.semestre)
  if (existente && semestreValido(semestre)) existente.semestre = semestre
  if (!existente) {
    data.alumnos.unshift({
      id: alumnoId,
      matricula,
      nombre: texto(datos.nombre) || matricula,
      plantel: texto(datos.plantel) || undefined,
      semestre: Number(datos.semestre),
      grupo: texto(datos.grupo).toUpperCase(),
      turnoId: texto(datos.turnoId) as TurnoId,
      estado: 'activo',
    })
  }
  data.ingresos.push({
    id: existente ? ids[0] : (ids[1] || ids[0]),
    alumnoId,
    sesionId: texto(datos.sesionId),
    fecha: texto(datos.fecha),
    hora: texto(datos.hora),
  })
}

function quitarIngreso(data: DemoData, datos: Record<string, unknown>) {
  const ingresoId = texto(datos.ingresoId)
  data.ingresos = data.ingresos.filter((item) => item.id !== ingresoId)
  if (datos.borrarAlumno === true) {
    const alumnoId = texto(datos.alumnoId)
    const sigue = data.ingresos.some((item) => item.alumnoId === alumnoId)
    if (!sigue) data.alumnos = data.alumnos.filter((item) => item.id !== alumnoId)
  }
}

function guardarMaestro(data: DemoData, datos: Record<string, unknown>, id: string) {
  const previo = data.maestros.find((maestro) => maestro.id === id)
  const record: Maestro = {
    id,
    numeroEmpleado: texto(datos.numeroEmpleado).toUpperCase(),
    nombre: texto(datos.nombre),
    correo: texto(datos.correo).toLowerCase(),
    turnoId: texto(datos.turnoId) as TurnoId,
    estado: texto(datos.estado) as EstadoPersona,
    materias: previo?.materias ?? [],
  }
  const index = data.maestros.findIndex((maestro) => maestro.id === id)
  if (index >= 0) data.maestros[index] = record
  else data.maestros.unshift(record)
}

function guardarMateria(data: DemoData, datos: Record<string, unknown>, id: string) {
  const record: Materia = {
    id,
    clave: texto(datos.clave).toUpperCase(),
    nombre: texto(datos.nombre),
    semestre: Number(datos.semestre),
    grupo: texto(datos.grupo).toUpperCase(),
    turnoId: texto(datos.turnoId) as TurnoId,
    maestroId: texto(datos.maestroId),
  }
  const index = data.materias.findIndex((materia) => materia.id === id)
  if (index >= 0) data.materias[index] = record
  else data.materias.unshift(record)
}

function guardarUsuario(data: DemoData, datos: Record<string, unknown>, id: string) {
  const record: Usuario = {
    id,
    nombre: texto(datos.nombre),
    correo: texto(datos.correo).toLowerCase(),
    rol: texto(datos.rol) as Rol,
    estado: texto(datos.estado) as EstadoPersona,
  }
  const index = data.usuarios.findIndex((usuario) => usuario.id === id)
  if (index >= 0) data.usuarios[index] = record
  else data.usuarios.unshift(record)
}

function nuevaIncidencia(datos: Record<string, unknown>, id: string, usuario: string): Incidencia {
  const detecto = texto(datos.detecto)
  const foto = texto(datos.foto)
  return {
    id,
    laboratorioId: texto(datos.laboratorioId),
    equipoId: texto(datos.equipoId) || null,
    descripcion: texto(datos.descripcion),
    fechaHora: ahora(),
    estado: 'pendiente',
    reporta: usuario,
    tipo: texto(datos.tipo) || undefined,
    prioridad: texto(datos.prioridad) || undefined,
    detecto: detecto || undefined,
    ...(foto ? { foto } : {}),
    historial: [{ fechaHora: ahora(), usuario, estado: 'pendiente', nota: 'Registro inicial.' }],
  }
}

function actualizarIncidencia(data: DemoData, datos: Record<string, unknown>, usuario: string) {
  const item = data.incidencias.find((row) => row.id === texto(datos.id))
  if (!item) return
  const estado = texto(datos.estado) as EstadoIncidencia
  item.estado = estado
  const solucion = texto(datos.solucion)
  const reparo = texto(datos.reparo)
  if (solucion) item.solucion = solucion
  if (reparo) item.reparo = reparo
  item.historial = [...(item.historial ?? []), { fechaHora: ahora(), usuario, estado, nota: solucion || reparo || 'Cambio de estado.' }]
}

function contarEquipos(data: DemoData) {
  for (const laboratorio of data.laboratorios) {
    laboratorio.cantidadEquipos = data.equipos.filter((equipo) => equipo.laboratorioId === laboratorio.id).length
  }
}
