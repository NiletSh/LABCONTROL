import { alumnoDelGrupo } from './academico.ts'
import { conflictoDeHorario, dentroDeRango, esIngresoDuplicado, rangosSeCruzan } from './schedule.ts'
import type { Alumno, DemoData, Equipo, EstadoAlumno, Materia, Sesion, TurnoId } from './types.ts'

export const ESCENARIO_FECHA = '2026-11-03'
export const HORA_REFERENCIA = '09:30'

const NOMBRES = [
  'Valeria', 'Diego', 'Mariana', 'Jorge', 'Sofía', 'Luis', 'Camila', 'Andrés', 'Regina', 'Emilio',
  'Natalia', 'Pablo', 'Fernanda', 'Iván', 'Ximena', 'Mateo', 'Renata', 'Gael', 'Daniela', 'Santiago',
  'Isabel', 'Leonardo', 'Ana', 'Tomás', 'Adriana', 'Bruno', 'Elena', 'Martín', 'Lucía', 'Rodrigo',
  'Paula', 'Hugo', 'Carla', 'Emiliano', 'Andrea', 'Sebastián', 'María', 'Joaquín', 'Jimena', 'Oscar',
]

const APELLIDOS = [
  'Cruz', 'Morales', 'López', 'Castillo', 'Ramírez', 'Ortega', 'Estrada', 'Guzmán', 'Paredes', 'Vargas',
  'Herrera', 'Méndez', 'Flores', 'Ríos', 'Santos', 'Navarro', 'Delgado', 'Cortés', 'Silva', 'Romero',
  'Aguilar', 'Vega', 'Campos', 'León', 'Peña', 'Soto', 'Ibarra', 'Núñez', 'Cabrera', 'Domínguez',
  'Salazar', 'Ponce', 'Miranda', 'Acosta', 'Fuentes', 'Cervantes', 'Maldonado', 'Espinoza', 'Cárdenas', 'Beltrán',
]

const GRUPOS: { grupo: string; semestre: number; turnoId: TurnoId; cantidad: number }[] = [
  { semestre: 1, grupo: 'A', turnoId: 'matutino', cantidad: 18 },
  { semestre: 1, grupo: 'B', turnoId: 'matutino', cantidad: 16 },
  { semestre: 2, grupo: 'A', turnoId: 'matutino', cantidad: 16 },
  { semestre: 3, grupo: 'A', turnoId: 'matutino', cantidad: 18 },
  { semestre: 4, grupo: 'A', turnoId: 'matutino', cantidad: 14 },
  { semestre: 5, grupo: 'A', turnoId: 'matutino', cantidad: 16 },
  { semestre: 3, grupo: 'B', turnoId: 'vespertino', cantidad: 14 },
  { semestre: 5, grupo: 'B', turnoId: 'vespertino', cantidad: 12 },
  { semestre: 6, grupo: 'A', turnoId: 'vespertino', cantidad: 12 },
]

function hashCode(text: string) {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function iso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function nombreCompleto(index: number, salto = 0) {
  const nombre = NOMBRES[index % NOMBRES.length]
  const apellido1 = APELLIDOS[(index * 3 + salto) % APELLIDOS.length]
  let apellido2 = APELLIDOS[(index * 7 + 5 + salto) % APELLIDOS.length]
  if (apellido2 === apellido1) apellido2 = APELLIDOS[(index * 7 + 6 + salto) % APELLIDOS.length]
  return `${nombre} ${apellido1} ${apellido2}`
}

function crearAlumnos(): Alumno[] {
  const inactivos = new Set([4, 19, 37, 52])
  const alumnos: Alumno[] = []
  let cursor = 0
  const usados = new Set<string>()

  for (const grupo of GRUPOS) {
    for (let offset = 0; offset < grupo.cantidad; offset += 1) {
      const index = cursor
      cursor += 1
      let salto = 0
      let nombre = nombreCompleto(index, salto)
      while (usados.has(nombre) && salto < 20) {
        salto += 1
        nombre = nombreCompleto(index, salto)
      }
      if (usados.has(nombre)) throw new Error(`Nombre de demostración repetido: ${nombre}`)
      usados.add(nombre)
      const year = [2024, 2023, 2022, 2021][index % 4]
      const estado: EstadoAlumno = inactivos.has(index) ? 'inactivo' : 'activo'
      alumnos.push({
        id: `alu-${String(index + 1).padStart(3, '0')}`,
        matricula: `${year}${String(index + 1).padStart(4, '0')}`,
        nombre,
        semestre: grupo.semestre,
        grupo: grupo.grupo,
        turnoId: grupo.turnoId,
        estado,
      })
    }
  }

  return alumnos
}

function plantillaDelDia(date: Date) {
  const day = date.getDay()
  const base: { laboratorioId: string; materiaId: string; horaInicio: string; horaFin: string }[] = [
    { laboratorioId: 'lab-1', materiaId: 'mat-inf', horaInicio: '09:00', horaFin: '10:00' },
    { laboratorioId: 'lab-2', materiaId: 'mat-prg', horaInicio: '09:00', horaFin: '10:00' },
  ]
  if (day === 1 || day === 3) base.push({ laboratorioId: 'lab-1', materiaId: 'mat-ofi', horaInicio: '12:00', horaFin: '13:00' })
  if (day === 2 || day === 4) base.push({ laboratorioId: 'lab-2', materiaId: 'mat-mate', horaInicio: '12:00', horaFin: '13:00' })
  if (day === 5) {
    base.push({ laboratorioId: 'lab-1', materiaId: 'mat-qui', horaInicio: '12:00', horaFin: '13:00' })
    base.push({ laboratorioId: 'lab-2', materiaId: 'mat-inf-b', horaInicio: '12:00', horaFin: '13:00' })
  }
  if (day !== 5) base.push({ laboratorioId: 'lab-1', materiaId: 'mat-fis', horaInicio: '16:00', horaFin: '17:00' })
  if (day !== 4) base.push({ laboratorioId: 'lab-2', materiaId: 'mat-ing', horaInicio: '16:00', horaFin: '17:00' })
  return base
}

function estadoDeSesion(fecha: string, horaInicio: string, horaFin: string): Sesion['estado'] {
  if (fecha < ESCENARIO_FECHA) return 'finalizada'
  if (fecha > ESCENARIO_FECHA) return 'programada'
  if (horaFin <= HORA_REFERENCIA) return 'finalizada'
  if (horaInicio <= HORA_REFERENCIA) return 'activa'
  return 'programada'
}

function horaLlegada(inicio: string, alumnoId: string, fecha: string) {
  const [hours, minutes] = inicio.split(':').map(Number)
  const total = hours * 60 + minutes + (hashCode(`${alumnoId}|${fecha}`) % 16)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function crearEquipos(): Equipo[] {
  const especiales: Record<string, Pick<Equipo, 'estado' | 'descripcion'>> = {
    'LAB1-PC04': {
      estado: 'mantenimiento',
      descripcion: 'Pantalla con parpadeo intermitente. En revisión desde el 2 de noviembre.',
    },
    'LAB1-PC19': {
      estado: 'fuera_de_servicio',
      descripcion: 'Fuente de poder dañada. Equipo retirado hasta su reemplazo.',
    },
    'LAB2-PC07': {
      estado: 'mantenimiento',
      descripcion: 'Teclado fuera de servicio. Pendiente de reemplazo.',
    },
    'LAB2-PC21': {
      estado: 'fuera_de_servicio',
      descripcion: 'El equipo no enciende. En espera de diagnóstico de la tarjeta madre.',
    },
  }
  const equipos: Equipo[] = []
  const labs: [string, string, number][] = [
    ['lab-1', 'LAB1', 30],
    ['lab-2', 'LAB2', 24],
  ]
  for (const [laboratorioId, prefix, total] of labs) {
    for (let number = 1; number <= total; number += 1) {
      const id = `${prefix}-PC${String(number).padStart(2, '0')}`
      const especial = especiales[id]
      equipos.push({
        id,
        laboratorioId,
        estado: especial?.estado ?? 'disponible',
        descripcion: especial?.descripcion ?? 'Equipo de escritorio para prácticas: computadora, monitor y periféricos.',
      })
    }
  }
  return equipos
}

function buildDemo(): DemoData {
  const alumnos = crearAlumnos()
  const maestros = [
    { id: 'mae-laura', numeroEmpleado: 'EMP-1042', nombre: 'Laura Benítez Olmos', correo: 'laura.benitez@institucion.edu.mx', turnoId: 'matutino' as const, estado: 'activo' as const, materias: [] as string[] },
    { id: 'mae-ricardo', numeroEmpleado: 'EMP-0988', nombre: 'Ricardo Palma Ibarra', correo: 'ricardo.palma@institucion.edu.mx', turnoId: 'matutino' as const, estado: 'activo' as const, materias: [] as string[] },
    { id: 'mae-patricia', numeroEmpleado: 'EMP-1105', nombre: 'Patricia Nava Cruz', correo: 'patricia.nava@institucion.edu.mx', turnoId: 'vespertino' as const, estado: 'activo' as const, materias: [] as string[] },
    { id: 'mae-miguel', numeroEmpleado: 'EMP-0874', nombre: 'Miguel Ángel Serrano', correo: 'miguel.serrano@institucion.edu.mx', turnoId: 'vespertino' as const, estado: 'activo' as const, materias: [] as string[] },
    { id: 'mae-elena', numeroEmpleado: 'EMP-1210', nombre: 'Elena Duarte Méndez', correo: 'elena.duarte@institucion.edu.mx', turnoId: 'vespertino' as const, estado: 'inactivo' as const, materias: [] as string[] },
  ]
  const materias: Materia[] = [
    { id: 'mat-inf', clave: 'INF-101', nombre: 'Informática', semestre: 1, grupo: 'A', turnoId: 'matutino', maestroId: 'mae-laura' },
    { id: 'mat-inf-b', clave: 'INF-101', nombre: 'Informática', semestre: 1, grupo: 'B', turnoId: 'matutino', maestroId: 'mae-ricardo' },
    { id: 'mat-ofi', clave: 'OFM-201', nombre: 'Ofimática', semestre: 2, grupo: 'A', turnoId: 'matutino', maestroId: 'mae-laura' },
    { id: 'mat-prg', clave: 'PRG-301', nombre: 'Programación', semestre: 3, grupo: 'A', turnoId: 'matutino', maestroId: 'mae-ricardo' },
    { id: 'mat-prg-b', clave: 'PRG-301', nombre: 'Programación', semestre: 3, grupo: 'B', turnoId: 'vespertino', maestroId: 'mae-miguel' },
    { id: 'mat-qui', clave: 'QUI-401', nombre: 'Química', semestre: 4, grupo: 'A', turnoId: 'matutino', maestroId: 'mae-laura' },
    { id: 'mat-mate', clave: 'MAT-501', nombre: 'Matemáticas', semestre: 5, grupo: 'A', turnoId: 'matutino', maestroId: 'mae-ricardo' },
    { id: 'mat-fis', clave: 'FIS-301', nombre: 'Física', semestre: 3, grupo: 'B', turnoId: 'vespertino', maestroId: 'mae-miguel' },
    { id: 'mat-ing', clave: 'ING-501', nombre: 'Inglés', semestre: 5, grupo: 'B', turnoId: 'vespertino', maestroId: 'mae-patricia' },
    { id: 'mat-his', clave: 'HIS-601', nombre: 'Historia de México', semestre: 6, grupo: 'A', turnoId: 'vespertino', maestroId: 'mae-elena' },
  ]
  for (const maestro of maestros) {
    maestro.materias = materias.filter((materia) => materia.maestroId === maestro.id).map((materia) => `${materia.nombre} · ${materia.semestre}° ${materia.grupo}`)
  }

  const materiasPorId = new Map(materias.map((materia) => [materia.id, materia]))
  const sesiones: Sesion[] = []
  const ingresos: DemoData['ingresos'] = []
  let ingresoSeq = 1
  const inicio = new Date(2026, 7, 17)
  const fin = new Date(2026, 10, 6)

  for (let cursor = new Date(inicio); cursor <= fin; cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getDay()
    if (day === 0 || day === 6) continue
    const fecha = iso(cursor)
    for (const bloque of plantillaDelDia(cursor)) {
      const materia = materiasPorId.get(bloque.materiaId)
      if (!materia) continue
      const sesion: Sesion = {
        id: `ses-${fecha.replaceAll('-', '')}-${bloque.laboratorioId}-${bloque.horaInicio.replace(':', '')}`,
        laboratorioId: bloque.laboratorioId,
        maestroId: materia.maestroId,
        materiaId: materia.id,
        semestre: materia.semestre,
        grupo: materia.grupo,
        turnoId: materia.turnoId,
        fecha,
        horaInicio: bloque.horaInicio,
        horaFin: bloque.horaFin,
        estado: estadoDeSesion(fecha, bloque.horaInicio, bloque.horaFin),
      }
      sesiones.push(sesion)
      if (sesion.estado === 'programada') continue
      const asistentes = alumnos.filter((alumno) => {
        if (!alumnoDelGrupo(alumno, { semestre: materia.semestre, grupo: materia.grupo, turnoId: sesion.turnoId })) return false
        return hashCode(`${fecha}|${alumno.id}|${sesion.id}`) % 1000 < 880
      })
      for (const alumno of asistentes) {
        if (esIngresoDuplicado(ingresos, alumno.id, sesion.id)) continue
        ingresos.push({
          id: `ing-${String(ingresoSeq).padStart(5, '0')}`,
          alumnoId: alumno.id,
          sesionId: sesion.id,
          fecha,
          hora: horaLlegada(sesion.horaInicio, alumno.id, fecha),
        })
        ingresoSeq += 1
      }
    }
  }

  const cancelada = sesiones.find((sesion) => sesion.id === 'ses-20261104-lab-1-1200')
  if (cancelada) cancelada.estado = 'cancelada'

  const equipos = crearEquipos()
  for (const laboratorioId of ['lab-1', 'lab-2']) {
    const activas = sesiones.filter((sesion) => sesion.estado === 'activa' && sesion.laboratorioId === laboratorioId)
    const ocupados = Math.max(0, ...activas.map((sesion) => ingresos.filter((ingreso) => ingreso.sesionId === sesion.id).length))
    const libres = equipos.filter((equipo) => equipo.laboratorioId === laboratorioId && equipo.estado === 'disponible')
    for (let index = 0; index < ocupados && index < libres.length; index += 1) libres[index].estado = 'ocupada'
  }

  const data: DemoData = {
    meta: {
      fuente: 'demostracion',
      persistido: false,
      escenarioFecha: ESCENARIO_FECHA,
      escenarioTexto: 'Martes 3 de noviembre de 2026, turno matutino',
      horaReferencia: HORA_REFERENCIA,
    },
    alumnos,
    maestros,
    materias,
    turnos: [
      {
        id: 'matutino',
        nombre: 'Turno matutino',
        horaInicio: '07:00',
        horaFin: '14:00',
        configurado: true,
        origen: 'demostracion',
      },
      {
        id: 'vespertino',
        nombre: 'Turno vespertino',
        horaInicio: '14:00',
        horaFin: '20:00',
        configurado: true,
        origen: 'demostracion',
      },
    ],
    laboratorios: [
      {
        id: 'lab-1',
        nombre: 'Laboratorio 1',
        ubicacion: 'Edificio de cómputo, planta baja',
        descripcion: 'Aula de prácticas de informática, ofimática y programación.',
        capacidad: 30,
        cantidadEquipos: equipos.filter((equipo) => equipo.laboratorioId === 'lab-1').length,
        estado: 'operativo',
      },
      {
        id: 'lab-2',
        nombre: 'Laboratorio 2',
        ubicacion: 'Edificio de cómputo, primer piso',
        descripcion: 'Aula para matemáticas, ciencias y materias que usan equipo de cómputo.',
        capacidad: 24,
        cantidadEquipos: equipos.filter((equipo) => equipo.laboratorioId === 'lab-2').length,
        estado: 'operativo',
      },
    ],
    equipos,
    mantenimientos: [
      { id: 'man-01', equipoId: 'LAB1-PC04', fecha: '2026-11-02', descripcion: 'Se documentó el parpadeo de la pantalla y el equipo quedó en mantenimiento.', responsable: 'Servicio interno' },
      { id: 'man-02', equipoId: 'LAB1-PC19', fecha: '2026-10-21', descripcion: 'Se confirmó el daño en la fuente de poder. El equipo salió de servicio.', responsable: 'Servicio interno' },
      { id: 'man-03', equipoId: 'LAB2-PC07', fecha: '2026-11-01', descripcion: 'Limpieza general y retiro del teclado dañado.', responsable: 'Héctor Ramírez' },
      { id: 'man-04', equipoId: 'LAB1-PC18', fecha: '2026-10-27', descripcion: 'Se reconectó el nodo de red y se verificó el acceso a internet.', responsable: 'Servicio interno' },
    ],
    sesiones,
    ingresos,
    incidencias: [
      { id: 'inc-2401', laboratorioId: 'lab-1', equipoId: 'LAB1-PC19', descripcion: 'El equipo no enciende. Se revisó el cable de alimentación y no hay respuesta.', fechaHora: '2026-11-03T08:12:00', estado: 'pendiente', reporta: 'Héctor Ramírez' },
      { id: 'inc-2402', laboratorioId: 'lab-2', equipoId: 'LAB2-PC07', descripcion: 'El teclado no responde. Los alumnos de la primera fila no pueden usar ese equipo.', fechaHora: '2026-11-03T08:40:00', estado: 'pendiente', reporta: 'Héctor Ramírez' },
      { id: 'inc-2394', laboratorioId: 'lab-1', equipoId: 'LAB1-PC04', descripcion: 'La pantalla parpadea después de unos minutos de uso.', fechaHora: '2026-11-02T13:05:00', estado: 'en_atencion', reporta: 'Héctor Ramírez' },
      { id: 'inc-2388', laboratorioId: 'lab-2', equipoId: null, descripcion: 'El proyector pierde la señal HDMI al conectar la computadora del docente.', fechaHora: '2026-10-29T10:20:00', estado: 'resuelta', reporta: 'Andrea Solís' },
      { id: 'inc-2375', laboratorioId: 'lab-1', equipoId: 'LAB1-PC18', descripcion: 'Sin conexión a la red del laboratorio. El resto de los equipos sí tenía acceso.', fechaHora: '2026-10-27T09:15:00', estado: 'resuelta', reporta: 'Andrea Solís' },
    ],
    reservaciones: [
      { id: 'res-01', laboratorioId: 'lab-2', maestroId: 'mae-patricia', materiaId: 'mat-ing', grupo: 'B', fecha: '2026-11-05', horaInicio: '16:00', horaFin: '17:00', estado: 'aceptada' },
      { id: 'res-02', laboratorioId: 'lab-1', maestroId: 'mae-miguel', materiaId: 'mat-fis', grupo: 'B', fecha: '2026-11-06', horaInicio: '16:00', horaFin: '17:00', estado: 'pendiente' },
      { id: 'res-03', laboratorioId: 'lab-1', maestroId: 'mae-miguel', materiaId: 'mat-fis', grupo: 'B', fecha: '2026-11-03', horaInicio: '09:00', horaFin: '10:00', estado: 'rechazada', motivo: 'El horario ya está ocupado por Informática, 1° A.' },
      { id: 'res-04', laboratorioId: 'lab-1', maestroId: 'mae-miguel', materiaId: 'mat-prg-b', grupo: 'B', fecha: '2026-11-09', horaInicio: '16:00', horaFin: '17:00', estado: 'aceptada' },
    ],
    usuarios: [
      { id: 'usr-andrea', nombre: 'Andrea Solís', correo: 'andrea.solis@institucion.edu.mx', rol: 'administrador', estado: 'activo' },
      { id: 'usr-hector', nombre: 'Héctor Ramírez', correo: 'hector.ramirez@institucion.edu.mx', rol: 'encargado', estado: 'activo' },
      { id: 'usr-claudia', nombre: 'Claudia Peña', correo: 'claudia.pena@institucion.edu.mx', rol: 'encargado', estado: 'inactivo' },
    ],
    bitacora: [
      { id: 'bit-01', fechaHora: '2026-11-03T08:41:00', usuario: 'Héctor Ramírez', accion: 'Registró la incidencia del equipo LAB2-PC07.', origen: 'demostracion' },
      { id: 'bit-02', fechaHora: '2026-11-03T08:16:00', usuario: 'Héctor Ramírez', accion: 'Registró la incidencia del equipo LAB1-PC19.', origen: 'demostracion' },
      { id: 'bit-03', fechaHora: '2026-11-03T08:05:00', usuario: 'Héctor Ramírez', accion: 'Consultó el tablero de los laboratorios.', origen: 'demostracion' },
      { id: 'bit-04', fechaHora: '2026-11-02T13:10:00', usuario: 'Andrea Solís', accion: 'Marcó el equipo LAB1-PC04 en mantenimiento.', origen: 'demostracion' },
      { id: 'bit-05', fechaHora: '2026-11-02T09:02:00', usuario: 'Héctor Ramírez', accion: 'Inició la sesión de Informática en Laboratorio 1.', origen: 'demostracion' },
      { id: 'bit-06', fechaHora: '2026-10-30T18:40:00', usuario: 'Andrea Solís', accion: 'Exportó el reporte de ingresos de la semana.', origen: 'demostracion' },
      { id: 'bit-07', fechaHora: '2026-10-29T11:05:00', usuario: 'Andrea Solís', accion: 'Cerró la incidencia del proyector del Laboratorio 2.', origen: 'demostracion' },
      { id: 'bit-08', fechaHora: '2026-10-27T12:30:00', usuario: 'Andrea Solís', accion: 'Actualizó el estado del equipo LAB1-PC18.', origen: 'demostracion' },
    ],
  }

  verificar(data)
  return data
}

function verificar(data: DemoData) {
  const fail = (message: string): never => {
    throw new Error(`Datos de demostración inconsistentes: ${message}`)
  }
  const ids = (values: { id: string }[], label: string) => {
    if (new Set(values.map((item) => item.id)).size !== values.length) fail(`identificadores repetidos en ${label}`)
  }
  ids(data.alumnos, 'alumnos')
  ids(data.sesiones, 'sesiones')
  ids(data.ingresos, 'ingresos')
  ids(data.equipos, 'equipos')
  if (new Set(data.alumnos.map((alumno) => alumno.matricula)).size !== data.alumnos.length) fail('matrículas repetidas')

  const sesiones = new Map(data.sesiones.map((sesion) => [sesion.id, sesion]))
  const vistos = new Set<string>()
  for (const ingreso of data.ingresos) {
    const clave = `${ingreso.alumnoId}|${ingreso.sesionId}`
    if (vistos.has(clave)) fail('ingreso duplicado')
    vistos.add(clave)
    const sesion = sesiones.get(ingreso.sesionId)
    if (!sesion) fail('ingreso sin sesión')
    else if (sesion.estado === 'programada') fail('ingreso en sesión programada')
    else if (sesion.fecha !== ingreso.fecha) fail('fecha de ingreso distinta a la sesión')
    else if (!data.alumnos.some((alumno) => alumno.id === ingreso.alumnoId)) fail('ingreso sin alumno')
  }

  const activas = data.sesiones.filter((sesion) => sesion.fecha === ESCENARIO_FECHA && sesion.estado === 'activa')
  if (activas.length !== 2) fail('se esperaban dos sesiones activas')

  for (const sesion of data.sesiones) {
    if (sesion.estado === 'cancelada') continue
    const conflicto = conflictoDeHorario(data.sesiones, data.reservaciones, sesion, { sesionId: sesion.id })
    if (conflicto) fail(`cruce de horario en ${sesion.id}`)
    const turno = data.turnos.find((item) => item.id === sesion.turnoId)
    if (!turno?.configurado || !turno.horaInicio || !turno.horaFin) fail(`turno sin horario en ${sesion.id}`)
    else if (!dentroDeRango(sesion.horaInicio, sesion.horaFin, turno.horaInicio, turno.horaFin)) fail(`sesión fuera de su turno: ${sesion.id}`)
    const materia = data.materias.find((item) => item.id === sesion.materiaId)
    const esperado = sesion.horaInicio < '14:00' ? 'matutino' : 'vespertino'
    if (!materia) throw new Error(`Datos de demostración inconsistentes: la sesión ${sesion.id} no tiene materia`)
    if (materia.semestre !== sesion.semestre || materia.grupo !== sesion.grupo || materia.turnoId !== sesion.turnoId || sesion.turnoId !== esperado) {
      fail(`la sesión ${sesion.id} no coincide con su materia o turno`)
    }
    const maestro = data.maestros.find((item) => item.id === materia.maestroId)
    if (maestro && maestro.turnoId !== materia.turnoId) fail(`el maestro de ${materia.id} trabaja en otro turno`)
  }

  const ejemploCancelada = data.sesiones.find((sesion) => sesion.id === 'ses-20261104-lab-1-1200')
  if (!ejemploCancelada || ejemploCancelada.estado !== 'cancelada') fail('falta la sesión cancelada de demostración')
  const huecoCancelado = conflictoDeHorario(data.sesiones, data.reservaciones, {
    laboratorioId: 'lab-1',
    fecha: '2026-11-04',
    horaInicio: '12:00',
    horaFin: '14:00',
  })
  if (huecoCancelado) fail('una sesión cancelada no debe seguir ocupando el laboratorio')
  const vespertina = data.sesiones.find((sesion) => sesion.fecha === ESCENARIO_FECHA && sesion.laboratorioId === 'lab-1' && sesion.horaInicio === '16:00')
  if (!vespertina || vespertina.turnoId !== 'vespertino' || vespertina.estado !== 'programada') fail('falta la sesión vespertina del escenario')

  const rechazada = data.reservaciones.find((reserva) => reserva.id === 'res-03')
  const sesionManana = data.sesiones.find((sesion) => sesion.fecha === ESCENARIO_FECHA && sesion.laboratorioId === 'lab-1' && sesion.horaInicio === '09:00')
  if (!rechazada || !sesionManana || !rangosSeCruzan(rechazada.horaInicio, rechazada.horaFin, sesionManana.horaInicio, sesionManana.horaFin)) {
    fail('la reservación rechazada debe documentar un cruce real')
  }

  if (data.laboratorios.some((laboratorio) => laboratorio.cantidadEquipos !== data.equipos.filter((equipo) => equipo.laboratorioId === laboratorio.id).length)) {
    fail('la cantidad de equipos no coincide')
  }
}

let cache: DemoData | null = null

export function getDemo() {
  if (!cache) cache = buildDemo()
  return cache
}
