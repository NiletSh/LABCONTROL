import type { HechosLaboratorio, Membrete } from './informes.ts'

export type ExtensionInforme = 'ejecutivo' | 'corto' | 'detallado'
export type TipoInstitucional =
  | 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'general'
  | 'preventivo' | 'correctivo' | 'inventario' | 'incidencias'
  | 'funcionamiento' | 'uso' | 'software' | 'conectividad' | 'necesidades'

export interface TablaDocumento {
  columnas: string[]
  filas: string[][]
  nota: string
  anchos: number[]
}

export interface SeccionDocumento {
  titulo: string
  parrafos: string[]
  tabla?: TablaDocumento
}

export interface FirmaDocumento {
  rol: string
  cargo: string
  nombre: string
}

export interface DocumentoInstitucional {
  tipo: TipoInstitucional
  extension: ExtensionInforme
  institucion: string
  departamento: string
  laboratorio: string
  titulo: string
  periodo: string
  fechaElaboracion: string
  responsable: string
  datos: { etiqueta: string; valor: string }[]
  secciones: SeccionDocumento[]
  firmas: FirmaDocumento[]
  notaFuente: string
  filtros: string[]
}

export const TIPOS_INSTITUCIONALES: { id: TipoInstitucional; nombre: string }[] = [
  { id: 'mensual', nombre: 'Reporte mensual de actividades' },
  { id: 'trimestral', nombre: 'Reporte trimestral' },
  { id: 'semestral', nombre: 'Reporte semestral' },
  { id: 'anual', nombre: 'Reporte anual' },
  { id: 'general', nombre: 'Reporte general de actividades' },
  { id: 'preventivo', nombre: 'Reporte de mantenimiento preventivo' },
  { id: 'correctivo', nombre: 'Reporte de mantenimiento correctivo' },
  { id: 'inventario', nombre: 'Reporte de inventario de equipos' },
  { id: 'incidencias', nombre: 'Reporte de incidencias' },
  { id: 'funcionamiento', nombre: 'Reporte de funcionamiento del laboratorio' },
  { id: 'uso', nombre: 'Reporte de uso por alumnos y docentes' },
  { id: 'software', nombre: 'Reporte de instalación y actualización de software' },
  { id: 'conectividad', nombre: 'Reporte de conectividad y servicios de red' },
  { id: 'necesidades', nombre: 'Reporte de necesidades y recursos' },
]

export const EXTENSIONES: { id: ExtensionInforme; nombre: string }[] = [
  { id: 'ejecutivo', nombre: 'Ejecutivo' },
  { id: 'corto', nombre: 'Corto' },
  { id: 'detallado', nombre: 'Detallado' },
]

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const NOTA = 'Las cifras corresponden solo a lo registrado en LAB CONTROL para el periodo y los filtros indicados. El documento no sustituye una verificación física ni afirma que un equipo funcione si el registro no lo consigna. No se inventaron cantidades, nombres ni resultados.'

export function leerSolicitudInstitucional(input: unknown): { tipo: TipoInstitucional; extension: ExtensionInforme } | null {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : null
  if (!source || typeof source.tipo !== 'string') return null
  const tipo = TIPOS_INSTITUCIONALES.find((item) => item.id === source.tipo)
  if (!tipo) return null
  const extension = source.extension === 'ejecutivo' || source.extension === 'corto' || source.extension === 'detallado'
    ? source.extension
    : 'detallado'
  return { tipo: tipo.id, extension }
}

export function rangoSugerido(tipo: TipoInstitucional, ancla: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ancla)) return null
  const year = Number(ancla.slice(0, 4))
  const month = Number(ancla.slice(5, 7))
  if (tipo === 'mensual') return { desde: iso(year, month, 1), hasta: iso(year, month, new Date(year, month, 0).getDate()) }
  if (tipo === 'trimestral') {
    const inicio = Math.floor((month - 1) / 3) * 3 + 1
    return { desde: iso(year, inicio, 1), hasta: iso(year, inicio + 2, new Date(year, inicio + 2, 0).getDate()) }
  }
  if (tipo === 'semestral') {
    const inicio = month >= 7 ? 7 : 1
    return { desde: iso(year, inicio, 1), hasta: iso(year, inicio + 5, new Date(year, inicio + 5, 0).getDate()) }
  }
  if (tipo === 'anual') return { desde: iso(year, 1, 1), hasta: iso(year, 12, 31) }
  return null
}

export function redactarInstitucional(
  hechos: HechosLaboratorio,
  solicitud: { tipo: TipoInstitucional; extension: ExtensionInforme },
  membrete: Membrete,
): DocumentoInstitucional {
  const titulo = membrete.titulo.trim() || TIPOS_INSTITUCIONALES.find((item) => item.id === solicitud.tipo)?.nombre || 'Informe de laboratorio'
  const institucion = membrete.institucion || 'Sin especificar'
  const departamento = membrete.departamento || 'Sin especificar'
  const responsable = membrete.encargado || 'Sin especificar'
  const laboratorio = hechos.laboratorios.map((item) => item.nombre).join(' y ') || 'Sin laboratorio en el corte'
  const alcance = hechos.filtros.length
    ? ` Las cifras respetan estos filtros: ${hechos.filtros.join('; ')}.`
    : ''
  const secciones = armarSecciones(solicitud.tipo, solicitud.extension, hechos, alcance)
  return {
    tipo: solicitud.tipo,
    extension: solicitud.extension,
    institucion,
    departamento,
    laboratorio,
    titulo,
    periodo: hechos.periodo,
    fechaElaboracion: fechaLarga(membrete.fecha),
    responsable,
    datos: [
      { etiqueta: 'Institución', valor: institucion },
      { etiqueta: 'Área o departamento', valor: departamento },
      { etiqueta: 'Laboratorio', valor: laboratorio },
      { etiqueta: 'Responsable', valor: responsable },
      { etiqueta: 'Periodo que comprende', valor: hechos.periodo },
      { etiqueta: 'Fecha de elaboración', valor: fechaLarga(membrete.fecha) },
      { etiqueta: 'Extensión', valor: EXTENSIONES.find((item) => item.id === solicitud.extension)?.nombre ?? 'Detallado' },
    ],
    secciones,
    firmas: [
      { rol: 'ELABORÓ', cargo: 'Responsable del laboratorio de cómputo', nombre: membrete.encargado },
      { rol: 'REVISÓ', cargo: 'Jefatura de departamento o responsable del área', nombre: membrete.reviso },
      { rol: 'AUTORIZÓ', cargo: 'Dirección del plantel', nombre: membrete.autorizo },
    ],
    notaFuente: NOTA,
    filtros: hechos.filtros,
  }
}

function armarSecciones(tipo: TipoInstitucional, extension: ExtensionInforme, hechos: HechosLaboratorio, alcance: string): SeccionDocumento[] {
  if (tipo === 'software') return seccionesSoftware(hechos, alcance)
  if (tipo === 'conectividad') return seccionesConectividad(extension, hechos, alcance)
  if (tipo === 'inventario') return seccionesInventario(extension, hechos, alcance)
  if (tipo === 'funcionamiento') return seccionesFuncionamiento(extension, hechos, alcance)
  if (tipo === 'uso') return seccionesUso(extension, hechos, alcance)
  if (tipo === 'necesidades') return seccionesNecesidades(extension, hechos, alcance)
  if (tipo === 'incidencias') return seccionesIncidencias(extension, hechos, alcance)
  if (tipo === 'preventivo' || tipo === 'correctivo') return seccionesMantenimiento(tipo, extension, hechos, alcance)
  return seccionesPeriodo(tipo, extension, hechos, alcance)
}

function seccionesPeriodo(tipo: TipoInstitucional, extension: ExtensionInforme, hechos: HechosLaboratorio, alcance: string): SeccionDocumento[] {
  const nombre = TIPOS_INSTITUCIONALES.find((item) => item.id === tipo)?.nombre.toLowerCase() ?? 'reporte'
  const calendario = tipo === 'semestral'
    ? ' Para el semestre se usó el semestre calendario: enero a junio, o julio a diciembre.'
    : tipo === 'trimestral'
      ? ' Para el trimestre se usó el trimestre calendario que contiene la fecha inicial.'
      : ''
  return [
    seccion('Introducción', [
      `Se elabora el ${nombre} de los laboratorios de cómputo con la información capturada en el sistema.${calendario} El periodo de las cifras es ${corte(hechos)}.${alcance} La denominación del documento no amplía por sí sola ese corte.`,
    ]),
    seccion('Objetivo', [
      'Dejar constancia, ante la autoridad del plantel, de las actividades, el uso, los mantenimientos y las incidencias que constan en el registro del periodo.',
    ]),
    seccionBitacora(extension, hechos),
    seccionUso(extension, hechos),
    seccionInventario(extension, hechos, false),
    seccionMantenimientos(extension, hechos, 'Los mantenimientos registrados no traen una marca que los clasifique como preventivos o correctivos. Se transcribe el texto capturado.'),
    seccionIncidenciasTabla(extension, hechos),
    seccionResultados(hechos),
    seccionConclusiones(hechos, true),
    seccionPendientes(extension, hechos),
  ]
}

function seccionesMantenimiento(tipo: 'preventivo' | 'correctivo', extension: ExtensionInforme, hechos: HechosLaboratorio, alcance: string): SeccionDocumento[] {
  const clase = tipo === 'preventivo' ? 'preventivo' : 'correctivo'
  const secciones = [
    seccion('Introducción', [
      `Se presenta el reporte de mantenimiento ${clase} para el corte ${corte(hechos)}.${alcance} El registro no clasifica cada trabajo como preventivo o correctivo, así que este informe no asigna esa categoría. Quien elabora puede anotarla al revisar cada renglón.`,
    ]),
    seccion('Objetivo', [
      tipo === 'preventivo'
        ? 'Poner a la vista los mantenimientos capturados en el periodo para que se distingan, en la revisión, los que correspondan a mantenimiento preventivo.'
        : 'Poner a la vista los mantenimientos y las fallas capturadas en el periodo, sin dar por corregido un equipo cuyo registro no lo indique.',
    ]),
    seccionMantenimientos(extension, hechos, 'Cada fila reproduce la fecha, el equipo, el responsable y la descripción guardada. El estado es el que el equipo tiene ahora en el inventario, no una constancia de que la falla haya quedado resuelta.'),
  ]
  if (tipo === 'correctivo') secciones.push(seccionIncidenciasTabla(extension, hechos))
  secciones.push(seccionConclusiones(hechos, false), seccionPendientes(extension, hechos))
  return secciones
}

function seccionesInventario(extension: ExtensionInforme, hechos: HechosLaboratorio, alcance: string): SeccionDocumento[] {
  return [
    seccion('Introducción', [
      `Se informa el inventario de computadoras registrado al momento de la consulta.${alcance} El inventario no se recorta por las fechas del periodo: muestra el estado capturado de los equipos.`,
    ]),
    seccion('Objetivo', [
      'Presentar la relación de computadoras y el estado en que cada una está capturada, sin afirmar un funcionamiento que el registro no comprueba.',
    ]),
    seccionInventario(extension, hechos, true),
    seccion('Recursos sin inventario propio', [
      'No existe un inventario separado de monitores, teclados, mouse, impresoras, proyectores ni equipos de red. Este informe no informa cantidades de esos recursos. Cuando la descripción de una computadora menciona un periférico, ese texto se conserva en la fila correspondiente y no se convierte en una cifra de inventario.',
    ]),
    seccion('Resultados', [conteoEquipos(hechos)]),
    seccion('Conclusiones', [
      `${conteoEquipos(hechos)} Esos estados son los capturados en el sistema. Disponible u ocupada no se presenta aquí como prueba de que el equipo funcione correctamente.`,
    ]),
  ]
}

function seccionesFuncionamiento(extension: ExtensionInforme, hechos: HechosLaboratorio, alcance: string): SeccionDocumento[] {
  const labs = hechos.laboratorios.map((item) => `${item.nombre} está capturado con estado ${item.estado.toLowerCase()}, en ${item.ubicacion}, con capacidad de ${item.capacidad} lugares y ${item.equipos} computadoras registradas.`)
  return [
    seccion('Introducción', [
      `Se informa el estado registrado de los laboratorios de cómputo y la actividad del corte ${corte(hechos)}.${alcance}`,
    ]),
    seccion('Objetivo', [
      'Exponer el estado capturado de cada laboratorio y el uso registrado, sin sustituir una revisión física del servicio.',
    ]),
    seccion('Estado registrado', labs.length ? labs : ['No hay laboratorios en el corte.']),
    seccionInventario(extension, hechos, false),
    seccionUso(extension, hechos),
    seccion('Conclusiones', [
      `${labs.join(' ') || 'No hay laboratorios en el corte.'} ${conteoEquipos(hechos)} El estado operativo, parcial o cerrado es el dato guardado y no constituye, por sí solo, una constancia de funcionamiento. En el periodo hay ${hechos.sesionesTotal} sesiones y ${hechos.ingresos} ingresos.`,
    ]),
  ]
}

function seccionesUso(extension: ExtensionInforme, hechos: HechosLaboratorio, alcance: string): SeccionDocumento[] {
  return [
    seccion('Introducción', [
      `Se informa el uso de los laboratorios por alumnos y docentes en el corte ${corte(hechos)}.${alcance}`,
    ]),
    seccion('Objetivo', [
      'Cuantificar los ingresos de alumnos y las sesiones atendidas por los docentes, conforme al registro de asistencia y de clases.',
    ]),
    seccionUso(extension, hechos),
    seccionResultados(hechos),
    seccion('Conclusiones', [
      hechos.ingresos
        ? `Quedaron registrados ${hechos.ingresos} ingresos de ${hechos.alumnosDistintos} alumnos distintos, en ${hechos.sesionesTotal} sesiones. La atención a docentes se limita a las sesiones y reservaciones capturadas; no se agrega una valoración de la clase.`
        : 'No quedaron ingresos de alumnos en el periodo consultado. Este informe no afirma que el laboratorio haya estado sin actividad fuera del registro.',
    ]),
  ]
}

function seccionesIncidencias(extension: ExtensionInforme, hechos: HechosLaboratorio, alcance: string): SeccionDocumento[] {
  const resueltas = hechos.incidencias.filter((item) => item.estado === 'Resuelta').length
  const abiertas = hechos.incidencias.length - resueltas
  return [
    seccion('Introducción', [
      `Se relacionan las incidencias capturadas en el corte ${corte(hechos)}.${alcance}`,
    ]),
    seccion('Objetivo', [
      'Distinguir las incidencias que el registro marca como resueltas de las que siguen pendientes o en atención, sin describir una solución que no esté escrita en el registro.',
    ]),
    seccionIncidenciasTabla(extension, hechos),
    seccion('Resultados', [
      hechos.incidencias.length
        ? `Hay ${hechos.incidencias.length} incidencias en el periodo: ${resueltas} marcadas como resueltas y ${abiertas} pendientes o en atención. Una incidencia resuelta conserva la descripción con la que fue reportada; si ese texto no explica la corrección, el informe no la completa.`
        : 'No hay incidencias registradas en el periodo. Eso no demuestra que no hayan ocurrido fallas fuera del sistema.',
    ]),
    seccionConclusiones(hechos, false),
    seccionPendientes(extension, hechos),
  ]
}

function seccionesNecesidades(extension: ExtensionInforme, hechos: HechosLaboratorio, alcance: string): SeccionDocumento[] {
  const abiertos = hechos.equipos.filter((item) => item.estado === 'En mantenimiento' || item.estado === 'Fuera de servicio')
  const abiertas = hechos.incidencias.filter((item) => item.estado !== 'Resuelta')
  return [
    seccion('Introducción', [
      `Se relacionan las necesidades que ya están visibles en el registro, para el corte ${corte(hechos)}.${alcance} No se registran montos, pedidos ni cantidades de equipo solicitado, y este informe no los calcula.`,
    ]),
    seccion('Objetivo', [
      'Identificar equipos e incidencias que siguen abiertos y las reservaciones de horario que siguen pendientes, para que la autoridad valore si requieren recurso o atención.',
    ]),
    seccion('Equipos que no están disponibles', [
      abiertos.length
        ? `Hay ${abiertos.length} computadoras capturadas en mantenimiento o fuera de servicio.`
        : 'No hay computadoras capturadas en mantenimiento o fuera de servicio dentro de este corte.',
    ], tablaEquipos(extension, abiertos)),
    seccion('Incidencias sin cerrar', [
      abiertas.length
        ? `Hay ${abiertas.length} incidencias del periodo que siguen pendientes o en atención.`
        : 'No hay incidencias pendientes o en atención dentro del periodo.',
    ], tablaIncidencias(extension, abiertas)),
    seccion('Reservaciones de horario', [
      hechos.reservacionesPendientes
        ? `Hay ${hechos.reservacionesPendientes} reservaciones de horario pendientes en el periodo. Son solicitudes de uso, no solicitudes de compra.`
        : 'No hay reservaciones de horario pendientes en el periodo.',
    ]),
    seccion('Conclusiones', [
      'Las necesidades de este informe son las que el registro deja abiertas. No se proponen cantidades de reposición ni de presupuesto porque no existe esa captura.',
    ]),
  ]
}

function seccionesSoftware(hechos: HechosLaboratorio, alcance: string): SeccionDocumento[] {
  return [
    seccion('Introducción', [
      `Se solicitó un reporte de instalación y actualización de software para el corte ${corte(hechos)}.${alcance}`,
    ]),
    seccion('Objetivo', [
      'Informar las instalaciones y actualizaciones de software que consten en un registro fechado.',
    ]),
    seccion('Registro disponible', [
      'LAB CONTROL no tiene un registro de instalación ni de actualización de software. No es posible informar programas, versiones, equipos intervenidos ni fechas de ese trabajo. Este documento no afirma que se hayan realizado ni que se hayan omitido.',
    ]),
    seccion('Dato pendiente para completar el informe', [
      'Para integrar el apartado hace falta capturar, por cada intervención, la fecha, el equipo, el nombre del programa y el resultado registrado. Mientras ese dato no exista, el informe debe permanecer en estos términos.',
    ]),
  ]
}

function seccionesConectividad(extension: ExtensionInforme, hechos: HechosLaboratorio, alcance: string): SeccionDocumento[] {
  const menciones = mencionesDeRed(hechos)
  return [
    seccion('Introducción', [
      `Se revisaron la bitácora, los mantenimientos y las incidencias del corte ${corte(hechos)} en busca de menciones a la red o a internet.${alcance} No hay un monitoreo de red ni una medición de servicio.`,
    ]),
    seccion('Objetivo', [
      'Transcribir los registros que mencionan conectividad, sin concluir que la red funciona o que el servicio está restablecido si el texto no lo dice.',
    ]),
    seccion('Menciones registradas', [
      menciones.length
        ? `Hay ${menciones.length} registros cuyo texto menciona red o internet. Se transcriben tal como fueron capturados.`
        : 'Ningún registro del periodo menciona red o internet. Este informe no concluye, por esa ausencia, que la conectividad haya estado bien o mal.',
    ], tabla(extension, ['Fecha', 'Origen', 'Texto registrado'], menciones.map((item) => [item.fecha, item.origen, item.texto]), [14, 18, 68])),
  ]
}

function seccionBitacora(extension: ExtensionInforme, hechos: HechosLaboratorio): SeccionDocumento {
  return seccion('Actividades registradas', [
    hechos.bitacora.length
      ? `La bitácora consigna ${hechos.bitacora.length} acciones en el periodo. El procedimiento y el resultado son el texto guardado; no se agrega un procedimiento distinto.`
      : 'La bitácora no tiene acciones en el periodo para el laboratorio consultado. No se listan actividades fuera de ese registro.',
  ], tabla(extension, ['Fecha', 'Hora', 'Usuario', 'Acción registrada'], hechos.bitacora.map((item) => [item.fecha, item.hora, item.usuario, item.accion]), [14, 10, 24, 52]))
}

function seccionUso(extension: ExtensionInforme, hechos: HechosLaboratorio): SeccionDocumento {
  const turnos = hechos.porTurno.map((item) => `${item.turno.toLowerCase()}: ${item.ingresos}`).join('; ')
  const labs = hechos.porLaboratorioUso.map((item) => `${item.laboratorio}: ${item.ingresos} ingresos y ${item.alumnos} alumnos distintos`).join('. ')
  const parrafos = [
    `Se registraron ${hechos.ingresos} ingresos de ${hechos.alumnosDistintos} alumnos distintos y ${hechos.sesionesTotal} sesiones. Ingresos por turno: ${turnos || 'sin turno en el corte'}. ${labs}.`,
  ]
  if (hechos.reservacionesPendientes === 1) parrafos.push('Queda 1 reservación de horario pendiente en el periodo.')
  else if (hechos.reservacionesPendientes) parrafos.push(`Quedan ${hechos.reservacionesPendientes} reservaciones de horario pendientes en el periodo.`)
  const filas = extension === 'ejecutivo'
    ? []
    : hechos.maestros.map((item) => [item.nombre, String(item.sesiones), String(item.ingresos)])
  const usoLab = hechos.porLaboratorioUso.map((item) => [item.laboratorio, String(item.ingresos), String(item.alumnos)])
  const tablaUso = extension === 'ejecutivo'
    ? undefined
    : tabla(extension, ['Laboratorio', 'Ingresos', 'Alumnos distintos'], usoLab, [40, 30, 30])
  const conMaestros = filas.length
    ? tabla(extension, ['Docente', 'Sesiones', 'Ingresos de alumnos'], filas, [50, 25, 25])
    : tablaUso
  return seccion('Atención a docentes y alumnos', parrafos, conMaestros)
}

function seccionInventario(extension: ExtensionInforme, hechos: HechosLaboratorio, completo: boolean): SeccionDocumento {
  const excepciones = hechos.equipos.filter((item) => item.estado === 'En mantenimiento' || item.estado === 'Fuera de servicio')
  const lista = completo || extension === 'detallado' ? hechos.equipos : excepciones
  const notaLista = !completo && extension !== 'detallado'
    ? 'En esta extensión solo se listan las computadoras en mantenimiento o fuera de servicio.'
    : 'Se listan las computadoras del corte.'
  return seccion('Inventario y estado de los equipos', [
    `${conteoEquipos(hechos)} ${notaLista}`,
  ], tabla(extension, ['Equipo', 'Laboratorio', 'Estado registrado', 'Descripción'], lista.map((item) => [item.id, item.laboratorio, item.estado, item.descripcion]), [18, 18, 20, 44]))
}

function seccionMantenimientos(extension: ExtensionInforme, hechos: HechosLaboratorio, aviso: string): SeccionDocumento {
  return seccion('Mantenimientos registrados', [
    hechos.mantenimientos.length
      ? `Hay ${hechos.mantenimientos.length} mantenimientos en el periodo. ${aviso}`
      : `No hay mantenimientos registrados en el periodo. ${aviso}`,
  ], tabla(
    extension,
    ['Fecha', 'Equipo', 'Laboratorio', 'Estado actual', 'Responsable', 'Descripción'],
    hechos.mantenimientos.map((item) => [item.fecha, item.equipo, item.laboratorio, item.estadoActual, item.responsable, item.descripcion]),
    [12, 14, 14, 16, 16, 28],
  ))
}

function seccionIncidenciasTabla(extension: ExtensionInforme, hechos: HechosLaboratorio): SeccionDocumento {
  return seccion('Incidencias detectadas', [
    hechos.incidencias.length
      ? `Hay ${hechos.incidencias.length} incidencias en el periodo. El estado es el capturado. La descripción es el reporte; no se redacta una solución adicional.`
      : 'No hay incidencias registradas en el periodo.',
  ], tablaIncidencias(extension, hechos.incidencias))
}

function seccionResultados(hechos: HechosLaboratorio): SeccionDocumento {
  const sesiones = hechos.sesiones.map((item) => `${item.estado.toLowerCase()}: ${item.total}`).join('; ')
  return seccion('Resultados generales', [
    `Ingresos: ${hechos.ingresos}. Alumnos distintos: ${hechos.alumnosDistintos}. Sesiones: ${hechos.sesionesTotal} (${sesiones}).`,
    `Mantenimientos en el periodo: ${hechos.mantenimientos.length}. Incidencias en el periodo: ${hechos.incidencias.length}. ${conteoEquipos(hechos)}`,
  ])
}

function seccionConclusiones(hechos: HechosLaboratorio, incluyeUso: boolean): SeccionDocumento {
  const resueltas = hechos.incidencias.filter((item) => item.estado === 'Resuelta').length
  const abiertas = hechos.incidencias.length - resueltas
  const fuera = hechos.equipos.filter((item) => item.estado === 'Fuera de servicio').length
  const mant = hechos.equipos.filter((item) => item.estado === 'En mantenimiento').length
  const parrafos = [
    incluyeUso
      ? `El uso registrado del periodo es de ${hechos.ingresos} ingresos y ${hechos.sesionesTotal} sesiones. La bitácora contiene ${hechos.bitacora.length} acciones.`
      : `En el periodo constan ${hechos.mantenimientos.length} mantenimientos y ${hechos.incidencias.length} incidencias.`,
    `De las incidencias del periodo, ${resueltas} están marcadas como resueltas y ${abiertas} siguen pendientes o en atención. En el inventario hay ${mant} computadoras en mantenimiento y ${fuera} fuera de servicio.`,
    'No se concluye que el resto de los equipos funcione correctamente: su estado disponible u ocupada solo indica cómo están capturados.',
  ]
  return seccion('Conclusiones', parrafos)
}

function seccionPendientes(extension: ExtensionInforme, hechos: HechosLaboratorio): SeccionDocumento {
  const equipos = hechos.equipos.filter((item) => item.estado === 'En mantenimiento' || item.estado === 'Fuera de servicio')
  const abiertas = hechos.incidencias.filter((item) => item.estado !== 'Resuelta')
  const parrafos = [
    equipos.length || abiertas.length || hechos.reservacionesPendientes
      ? `Quedan abiertos ${equipos.length} equipos en mantenimiento o fuera de servicio, ${abiertas.length} incidencias del periodo sin cerrar y ${hechos.reservacionesPendientes === 1 ? '1 reservación de horario pendiente' : `${hechos.reservacionesPendientes} reservaciones de horario pendientes`}. Lo ya registrado como resuelto no se vuelve a listar como pendiente.`
      : 'En este corte no quedan incidencias sin cerrar, ni computadoras en mantenimiento o fuera de servicio, ni reservaciones de horario pendientes.',
  ]
  return seccion('Actividades pendientes', parrafos, tabla(
    extension,
    ['Tipo', 'Referencia', 'Estado', 'Detalle'],
    [
      ...equipos.map((item) => ['Equipo', item.id, item.estado, item.descripcion]),
      ...abiertas.map((item) => ['Incidencia', `${item.fecha} ${item.hora}`, item.estado, item.descripcion]),
    ],
    [16, 22, 18, 44],
  ))
}

function seccion(titulo: string, parrafos: string[], tablaDocumento?: TablaDocumento): SeccionDocumento {
  return tablaDocumento && (tablaDocumento.filas.length || tablaDocumento.nota) ? { titulo, parrafos, tabla: tablaDocumento } : { titulo, parrafos }
}

function tabla(extension: ExtensionInforme, columnas: string[], filas: string[][], anchos: number[]): TablaDocumento | undefined {
  if (!filas.length || extension === 'ejecutivo') return undefined
  const limite = extension === 'corto' ? 8 : 80
  const visibles = filas.slice(0, limite)
  const nota = filas.length > visibles.length ? `Se muestran ${visibles.length} de ${filas.length} registros. El corte completo sigue en el sistema.` : ''
  return { columnas, filas: visibles, nota, anchos }
}

function tablaEquipos(extension: ExtensionInforme, equipos: HechosLaboratorio['equipos']) {
  return tabla(extension, ['Equipo', 'Laboratorio', 'Estado registrado', 'Descripción'], equipos.map((item) => [item.id, item.laboratorio, item.estado, item.descripcion]), [18, 18, 20, 44])
}

function tablaIncidencias(extension: ExtensionInforme, incidencias: HechosLaboratorio['incidencias']) {
  return tabla(
    extension,
    ['Fecha', 'Hora', 'Laboratorio', 'Equipo', 'Estado', 'Reporta', 'Descripción'],
    incidencias.map((item) => [item.fecha, item.hora, item.laboratorio, item.equipo, item.estado, item.reporta, item.descripcion]),
    [12, 8, 14, 14, 12, 16, 24],
  )
}

function conteoEquipos(hechos: HechosLaboratorio) {
  const contar = (estado: string) => hechos.equipos.filter((item) => item.estado === estado).length
  return `Computadoras en el corte: ${hechos.equipos.length}. Disponibles: ${contar('Disponible')}. Ocupadas: ${contar('Ocupada')}. En mantenimiento: ${contar('En mantenimiento')}. Fuera de servicio: ${contar('Fuera de servicio')}.`
}

function mencionesDeRed(hechos: HechosLaboratorio) {
  const patrón = /internet|nodo de red|conexi[oó]n a la red|sin conexi[oó]n/i
  return [
    ...hechos.mantenimientos.filter((item) => patrón.test(item.descripcion)).map((item) => ({ fecha: item.fecha, origen: `Mantenimiento ${item.equipo}`, texto: item.descripcion })),
    ...hechos.incidencias.filter((item) => patrón.test(item.descripcion)).map((item) => ({ fecha: item.fecha, origen: `Incidencia ${item.equipo}`, texto: item.descripcion })),
    ...hechos.bitacora.filter((item) => patrón.test(item.accion)).map((item) => ({ fecha: item.fecha, origen: 'Bitácora', texto: item.accion })),
  ]
}

function corte(hechos: HechosLaboratorio) {
  return hechos.periodo.charAt(0).toLowerCase() + hechos.periodo.slice(1)
}

function fechaLarga(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || 'Sin especificar'
  const [year, month, day] = iso.split('-').map(Number)
  return `${day} de ${MESES[month - 1]} de ${year}`
}

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
