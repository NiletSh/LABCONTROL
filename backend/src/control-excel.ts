import ExcelJS from 'exceljs'
import type { HechosLaboratorio, Membrete } from '../../shared/informes.ts'

const NAVY = 'FF0B1F3A'
const BLUE = 'FFDBEAFE'
const GREEN = 'FFDCFCE7'
const GREEN_TEXT = 'FF166534'
const YELLOW = 'FFFDE68A'
const YELLOW_TEXT = 'FF92400E'
const RED = 'FFFEE2E2'
const RED_TEXT = 'FFB91C1C'
const GRAY = 'FFF1F5F9'
const WHITE = 'FFFFFFFF'
const INK = 'FF0F172A'
const MUTED = 'FF64748B'
const EXTRA = 12

const ESTADOS_EQUIPO = ['Disponible', 'Ocupada', 'Operativo', 'En mantenimiento', 'Fuera de servicio']
const TIPOS_MANTENIMIENTO = ['Preventivo', 'Correctivo']
const ESTADOS_INCIDENCIA = ['Pendiente', 'En atención', 'En proceso', 'Resuelta']

export async function construirControlExcel(hechos: HechosLaboratorio, membrete: Membrete, creado: string) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'LAB CONTROL'
  workbook.created = new Date()
  workbook.title = membrete.titulo || 'Control de laboratorio de cómputo'
  workbook.calcProperties.fullCalcOnLoad = true

  const listas = workbook.addWorksheet('Listas', { state: 'veryHidden' })
  ESTADOS_EQUIPO.forEach((item, index) => { listas.getCell(index + 1, 1).value = item })
  TIPOS_MANTENIMIENTO.forEach((item, index) => { listas.getCell(index + 1, 2).value = item })
  ESTADOS_INCIDENCIA.forEach((item, index) => { listas.getCell(index + 1, 3).value = item })

  const resumen = libroBase(workbook, 'Resumen', 'portrait')
  const actividades = libroBase(workbook, 'Actividades', 'landscape')
  const inventario = libroBase(workbook, 'Inventario', 'landscape')
  const mantenimiento = libroBase(workbook, 'Mantenimiento', 'landscape')
  const incidencias = libroBase(workbook, 'Incidencias', 'landscape')
  const uso = libroBase(workbook, 'Uso', 'landscape')
  const firmas = libroBase(workbook, 'Firmas', 'portrait')

  const filasActividades = hechos.bitacora.map((item) => [
    null,
    fechaCelda(item.fecha),
    item.accion,
    '',
    areaDe(item.accion),
    item.usuario,
    '',
    '',
    '',
  ])
  const filasInventario = hechos.equipos.map((item) => [
    item.id,
    '',
    '',
    '',
    '',
    item.laboratorio,
    null,
    item.estado,
    item.descripcion,
  ])
  const filasMantenimiento = hechos.mantenimientos.map((item) => [
    fechaCelda(item.fecha),
    item.equipo,
    '',
    item.descripcion,
    '',
    item.responsable,
    '',
    `Estado actual capturado: ${item.estadoActual}`,
  ])
  const filasIncidencias = hechos.incidencias.map((item) => [
    null,
    fechaCelda(item.fecha),
    item.equipo,
    item.descripcion,
    item.reporta,
    '',
    null,
    item.estado,
    '',
  ])
  const filasUso = hechos.sesionesDetalle.map((item) => [
    fechaCelda(item.fecha),
    item.horario,
    item.grupo,
    item.docente,
    item.asignatura,
    item.alumnos,
    null,
    '',
    item.laboratorio,
  ])

  tabla(actividades, 'Actividades', 5, [
    'Número de actividad', 'Fecha', 'Actividad realizada', 'Descripción del trabajo', 'Área o equipo involucrado',
    'Responsable', 'Resultado', 'Observaciones', 'Evidencia o referencia fotográfica',
  ], filasActividades, [2])
  tabla(inventario, 'Inventario', 5, [
    'Número de inventario', 'Nombre del equipo', 'Marca', 'Modelo', 'Número de serie',
    'Ubicación', 'Fecha de adquisición', 'Estado del equipo', 'Observaciones',
  ], filasInventario, [7])
  tabla(mantenimiento, 'Mantenimiento', 5, [
    'Fecha del mantenimiento', 'Número o identificación del equipo', 'Tipo de mantenimiento', 'Descripción del trabajo',
    'Materiales utilizados', 'Técnico responsable', 'Estado final del equipo', 'Observaciones',
  ], filasMantenimiento, [1])
  tabla(incidencias, 'Incidencias', 5, [
    'Número de incidencia', 'Fecha del reporte', 'Equipo involucrado', 'Descripción de la falla', 'Persona que reporta',
    'Solución aplicada', 'Fecha de solución', 'Estado', 'Observaciones',
  ], filasIncidencias, [2, 7])
  tabla(uso, 'Uso', 5, [
    'Fecha', 'Horario', 'Grupo', 'Docente', 'Asignatura', 'Número de alumnos',
    'Computadoras utilizadas', 'Actividad realizada', 'Observaciones',
  ], filasUso, [1])

  numerar(actividades, filasActividades.length, 6, 1)
  numerar(incidencias, filasIncidencias.length, 6, 1)
  lista(inventario, filasInventario.length, 6, 8, `Listas!$A$1:$A$${ESTADOS_EQUIPO.length}`)
  lista(mantenimiento, filasMantenimiento.length, 6, 3, `Listas!$B$1:$B$${TIPOS_MANTENIMIENTO.length}`)
  lista(incidencias, filasIncidencias.length, 6, 8, `Listas!$C$1:$C$${ESTADOS_INCIDENCIA.length}`)
  estadoEquipo(inventario, filasInventario.length)
  estadoIncidencia(incidencias, filasIncidencias.length)

  portada(resumen, hechos, membrete, creado)
  cierre(firmas, membrete)
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

function libroBase(workbook: ExcelJS.Workbook, nombre: string, orientation: 'portrait' | 'landscape') {
  const sheet = workbook.addWorksheet(nombre, {
    pageSetup: {
      paperSize: 9 as ExcelJS.PaperSize,
      orientation,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.5, right: 0.5, top: 0.7, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    views: [{ state: 'frozen', ySplit: nombre === 'Resumen' || nombre === 'Firmas' ? 3 : 5, showGridLines: false }],
    properties: { tabColor: { argb: NAVY } },
  })
  sheet.headerFooter.oddFooter = '&L&8Laboratorio de cómputo&C&8Sin sello oficial&R&8Página &P de &N'
  sheet.headerFooter.oddHeader = '&L&8CONTROL DE LABORATORIO DE CÓMPUTO&R&8Documento de trabajo'
  sheet.pageSetup.printTitlesRow = nombre === 'Resumen' || nombre === 'Firmas' ? '1:3' : '1:5'
  return sheet
}

function portada(sheet: ExcelJS.Worksheet, hechos: HechosLaboratorio, membrete: Membrete, creado: string) {
  banner(sheet, 'A1:H1', 'CONTROL DE LABORATORIO DE CÓMPUTO')
  sheet.getRow(1).height = 28
  sheet.mergeCells('A2:H2')
  const sub = sheet.getCell('A2')
  sub.value = membrete.titulo || 'Resumen general'
  sub.font = { name: 'Calibri', size: 14, color: { argb: NAVY }, bold: true }
  sub.alignment = { vertical: 'middle' }
  sheet.getRow(2).height = 22
  sheet.mergeCells('A3:H3')
  sheet.getCell('A3').value = 'Los indicadores se calculan con las hojas de este libro. Al agregar un registro dentro de la tabla, el resumen se actualiza al abrir o recalcular el archivo.'
  sheet.getCell('A3').font = { name: 'Calibri', size: 10, color: { argb: MUTED }, italic: true }
  sheet.getRow(3).height = 32

  const datos: [string, ExcelJS.CellValue][] = [
    ['Nombre del plantel', membrete.institucion],
    ['Nombre del laboratorio', hechos.laboratorios.map((item) => item.nombre).join(' y ')],
    ['Nombre del responsable', membrete.encargado],
    ['Área o departamento', membrete.departamento],
    ['Periodo del reporte', hechos.periodo],
    ['Fecha de elaboración', fechaCelda(membrete.fecha)],
  ]
  datos.forEach((item, index) => {
    const row = 5 + index
    const label = sheet.getCell(row, 1)
    const value = sheet.getCell(row, 2)
    label.value = item[0]
    label.font = { name: 'Calibri', bold: true, color: { argb: NAVY }, size: 11 }
    label.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }
    label.alignment = { vertical: 'middle', wrapText: true }
    value.value = item[1] || null
    value.font = { name: 'Calibri', size: 12, color: { argb: INK } }
    value.alignment = { vertical: 'middle', wrapText: true }
    if (item[0].startsWith('Fecha')) value.numFmt = 'dd/mm/yyyy'
    sheet.mergeCells(row, 2, row, 4)
    sheet.getRow(row).height = 22
  })

  const indicadores: [string, string, string, string][] = [
    ['Total de computadoras', '=COUNTA(Inventario[Número de inventario])', NAVY, WHITE],
    ['Equipos operativos', '=COUNTIF(Inventario[Estado del equipo],"Disponible")+COUNTIF(Inventario[Estado del equipo],"Ocupada")+COUNTIF(Inventario[Estado del equipo],"Operativo")', GREEN, GREEN_TEXT],
    ['Equipos fuera de servicio', '=COUNTIF(Inventario[Estado del equipo],"Fuera de servicio")', RED, RED_TEXT],
    ['Equipos en mantenimiento', '=COUNTIF(Inventario[Estado del equipo],"En mantenimiento")', YELLOW, YELLOW_TEXT],
    ['Actividades realizadas', '=COUNTA(Actividades[Fecha])', BLUE, NAVY],
    ['Mantenimientos efectuados', '=COUNTA(Mantenimiento[Fecha del mantenimiento])', BLUE, NAVY],
    ['Incidencias registradas', '=COUNTA(Incidencias[Fecha del reporte])', BLUE, NAVY],
    ['Actividades pendientes', '=COUNTIF(Incidencias[Estado],"Pendiente")+COUNTIF(Incidencias[Estado],"En atención")+COUNTIF(Incidencias[Estado],"En proceso")', YELLOW, YELLOW_TEXT],
    ['Incidencias resueltas', '=COUNTIF(Incidencias[Estado],"Resuelta")', GREEN, GREEN_TEXT],
    ['Porcentaje disponible u ocupado', '=IF(G5=0,"",G6/G5)', GRAY, NAVY],
  ]
  indicadores.forEach((item, index) => {
    const row = 5 + index
    const label = sheet.getCell(row, 6)
    const value = sheet.getCell(row, 7)
    label.value = item[0]
    label.font = { name: 'Calibri', bold: true, size: 11, color: { argb: item[3] } }
    label.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item[2] } }
    label.alignment = { vertical: 'middle', wrapText: true }
    value.value = { formula: item[1].slice(1), result: 0 }
    value.font = { name: 'Calibri', bold: true, size: 16, color: { argb: item[3] } }
    value.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: item[2] } }
    value.alignment = { vertical: 'middle', horizontal: 'center' }
    if (item[0].startsWith('Porcentaje')) value.numFmt = '0%'
    sheet.mergeCells(row, 7, row, 8)
    sheet.getRow(row).height = 24
  })

  sheet.mergeCells('A16:H16')
  sheet.getCell('A16').value = 'Equipos operativos suma los estados Disponible, Ocupada y Operativo. Es el estado capturado, no una constancia de funcionamiento. Actividades pendientes suma incidencias en Pendiente, En atención o En proceso. Marca, modelo, serie, materiales, solución y fotografías quedan vacíos porque el registro no los trae.'
  sheet.getCell('A16').alignment = { wrapText: true, vertical: 'top' }
  sheet.getCell('A16').font = { name: 'Calibri', size: 10, color: { argb: MUTED } }
  sheet.getRow(16).height = 48

  sheet.mergeCells('A18:B18')
  sheet.getCell('A18').value = 'Estado registrado de las computadoras'
  sheet.getCell('A18').font = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 12 }
  sheet.getCell('A18').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  const estados = ['Disponible', 'Ocupada', 'En mantenimiento', 'Fuera de servicio']
  estados.forEach((estado, index) => {
    const row = 19 + index
    sheet.getCell(row, 1).value = estado
    sheet.getCell(row, 1).font = { name: 'Calibri', size: 11 }
    sheet.getCell(row, 2).value = { formula: `COUNTIF(Inventario[Estado del equipo],A${row})`, result: 0 }
    sheet.getCell(row, 2).font = { name: 'Calibri', bold: true, size: 12 }
    sheet.getCell(row, 2).alignment = { horizontal: 'center' }
    sheet.getRow(row).height = 20
  })
  sheet.addConditionalFormatting({
    ref: 'B19:B22',
    rules: [{
      type: 'dataBar',
      priority: 1,
      gradient: false,
      showValue: true,
      cfvo: [{ type: 'num', value: 0 }, { type: 'max' }],
    }],
  })

  sheet.mergeCells('D18:E18')
  sheet.getCell('D18').value = 'Incidencias por estado'
  sheet.getCell('D18').font = { name: 'Calibri', bold: true, color: { argb: WHITE }, size: 12 }
  sheet.getCell('D18').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  ;['Pendiente', 'En atención', 'Resuelta'].forEach((estado, index) => {
    const row = 19 + index
    sheet.getCell(row, 4).value = estado
    sheet.getCell(row, 4).font = { name: 'Calibri', size: 11 }
    sheet.getCell(row, 5).value = { formula: `COUNTIF(Incidencias[Estado],D${row})`, result: 0 }
    sheet.getCell(row, 5).font = { name: 'Calibri', bold: true, size: 12 }
    sheet.getCell(row, 5).alignment = { horizontal: 'center' }
  })
  sheet.addConditionalFormatting({
    ref: 'E19:E21',
    rules: [{
      type: 'dataBar',
      priority: 1,
      gradient: false,
      showValue: true,
      cfvo: [{ type: 'num', value: 0 }, { type: 'max' }],
    }],
  })

  sheet.mergeCells('A24:H24')
  sheet.getCell('A24').value = hechos.filtros.length ? `Filtros: ${hechos.filtros.join(' | ')}` : 'Sin filtros adicionales.'
  sheet.getCell('A24').font = { name: 'Calibri', size: 10, color: { argb: MUTED } }
  sheet.mergeCells('A25:H25')
  sheet.getCell('A25').value = `Archivo creado: ${creado}. Las cifras corresponden solo a lo registrado en el periodo. No se insertaron firmas ni sellos.`
  sheet.getCell('A25').font = { name: 'Calibri', size: 10, color: { argb: MUTED } }

  sheet.getColumn(1).width = 34
  sheet.getColumn(2).width = 28
  sheet.getColumn(3).width = 18
  sheet.getColumn(4).width = 22
  sheet.getColumn(5).width = 16
  sheet.getColumn(6).width = 36
  sheet.getColumn(7).width = 14
  sheet.getColumn(8).width = 18
  sheet.pageSetup.printArea = 'A1:H25'
}

function cierre(sheet: ExcelJS.Worksheet, membrete: Membrete) {
  banner(sheet, 'A1:F1', 'FIRMAS Y VALIDACIÓN')
  sheet.getRow(1).height = 28
  sheet.mergeCells('A2:F2')
  sheet.getCell('A2').value = 'Espacios para firma manuscrita. No se inserta firma ni sello.'
  sheet.getCell('A2').font = { name: 'Calibri', italic: true, size: 11, color: { argb: MUTED } }
  sheet.getRow(2).height = 20

  const bloques: [string, string, string][] = [
    ['ELABORÓ', 'Encargado del laboratorio de cómputo', membrete.encargado],
    ['REVISÓ', 'Jefatura de departamento o responsable del área', membrete.reviso],
    ['AUTORIZÓ', 'Autoridad del plantel, si aplica', membrete.autorizo],
  ]
  bloques.forEach((bloque, index) => {
    const col = 1 + index * 2
    const titulo = sheet.getCell(4, col)
    titulo.value = bloque[0]
    titulo.font = { name: 'Calibri', bold: true, size: 12, color: { argb: WHITE } }
    titulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    titulo.alignment = { horizontal: 'center' }
    sheet.mergeCells(4, col, 4, col + 1)
    const cargo = sheet.getCell(5, col)
    cargo.value = bloque[1]
    cargo.font = { name: 'Calibri', size: 10, color: { argb: MUTED } }
    cargo.alignment = { wrapText: true, horizontal: 'center' }
    sheet.mergeCells(5, col, 5, col + 1)
    const linea = sheet.getCell(8, col)
    linea.border = { bottom: { style: 'thin', color: { argb: NAVY } } }
    sheet.mergeCells(8, col, 8, col + 1)
    const nombre = sheet.getCell(9, col)
    nombre.value = bloque[2] || null
    nombre.font = { name: 'Calibri', size: 12, color: { argb: INK } }
    nombre.alignment = { horizontal: 'center' }
    sheet.mergeCells(9, col, 9, col + 1)
    const leyenda = sheet.getCell(10, col)
    leyenda.value = 'Nombre y firma'
    leyenda.font = { name: 'Calibri', size: 9, color: { argb: MUTED } }
    leyenda.alignment = { horizontal: 'center' }
    sheet.mergeCells(10, col, 10, col + 1)
    sheet.getColumn(col).width = 24
    sheet.getColumn(col + 1).width = 18
  })
  sheet.getRow(5).height = 32
  sheet.getRow(6).height = 18
  sheet.getRow(7).height = 18
  sheet.getRow(8).height = 22

  const fechas: [string, ExcelJS.CellValue][] = [
    ['Fecha de elaboración', fechaCelda(membrete.fecha)],
    ['Fecha de revisión', null],
    ['Fecha de autorización', null],
  ]
  fechas.forEach((item, index) => {
    const row = 12 + index
    sheet.getCell(row, 1).value = item[0]
    sheet.getCell(row, 1).font = { name: 'Calibri', bold: true, color: { argb: NAVY } }
    sheet.getCell(row, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } }
    sheet.getCell(row, 2).value = item[1]
    sheet.getCell(row, 2).numFmt = 'dd/mm/yyyy'
    sheet.getCell(row, 2).border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } }
    sheet.getRow(row).height = 22
  })

  const sello = sheet.getCell('D12')
  sello.value = 'Espacio para sello institucional'
  sello.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  sello.font = { name: 'Calibri', size: 11, color: { argb: MUTED } }
  sheet.mergeCells('D12:F15')
  for (let row = 12; row <= 15; row += 1) {
    for (let col = 4; col <= 6; col += 1) {
      sheet.getCell(row, col).border = {
        top: { style: 'dashed', color: { argb: 'FF93C5FD' } },
        left: { style: 'dashed', color: { argb: 'FF93C5FD' } },
        bottom: { style: 'dashed', color: { argb: 'FF93C5FD' } },
        right: { style: 'dashed', color: { argb: 'FF93C5FD' } },
      }
    }
  }
  sheet.getRow(13).height = 22
  sheet.getRow(14).height = 22
  sheet.getRow(15).height = 22
  sheet.pageSetup.printArea = 'A1:F16'
}

function tabla(sheet: ExcelJS.Worksheet, nombre: string, encabezado: number, columnas: string[], filas: ExcelJS.CellValue[][], fechas: number[]) {
  banner(sheet, `A1:${columna(columnas.length)}1`, nombre.toUpperCase())
  sheet.getRow(1).height = 26
  sheet.mergeCells(`A2:${columna(columnas.length)}2`)
  sheet.getCell('A2').value = 'Los renglones en blanco quedan dentro de la tabla para capturar registros nuevos. Las listas desplegables están en las columnas de estado o tipo.'
  sheet.getCell('A2').font = { name: 'Calibri', size: 10, italic: true, color: { argb: MUTED } }
  sheet.getRow(2).height = 28
  sheet.getRow(3).height = 8
  const datos = [...filas, ...Array.from({ length: EXTRA }, () => columnas.map(() => null))]
  sheet.addTable({
    name: nombre,
    ref: `A${encabezado}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: columnas.map((item) => ({ name: item, filterButton: true })),
    rows: datos.map((fila) => fila.map((valor) => valor ?? null)),
  })
  fechas.forEach((col) => { sheet.getColumn(col).numFmt = 'dd/mm/yyyy' })
  columnas.forEach((item, index) => {
    const ancho = item.length > 28 ? 42 : item.length > 18 ? 28 : 20
    sheet.getColumn(index + 1).width = Math.max(sheet.getColumn(index + 1).width ?? 0, ancho)
  })
  sheet.pageSetup.printArea = `A1:${columna(columnas.length)}${encabezado + datos.length}`
}

function numerar(sheet: ExcelJS.Worksheet, ocupadas: number, primera: number, columnaNumero: number) {
  const total = Math.max(ocupadas, 0) + EXTRA
  for (let index = 0; index < total; index += 1) {
    const row = primera + index
    sheet.getCell(row, columnaNumero).value = { formula: `ROW()-${primera - 1}`, result: index + 1 }
  }
}

function lista(sheet: ExcelJS.Worksheet, ocupadas: number, primera: number, columnaLista: number, formula: string) {
  const total = Math.max(ocupadas, 0) + EXTRA
  for (let index = 0; index < total; index += 1) {
    sheet.getCell(primera + index, columnaLista).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Valor de la lista',
      error: 'Elige un valor de la lista o déjalo vacío.',
    }
  }
}

function estadoEquipo(sheet: ExcelJS.Worksheet, ocupadas: number) {
  const ultima = 5 + Math.max(ocupadas, 0) + EXTRA
  sheet.addConditionalFormatting({
    ref: `H6:H${ultima}`,
    rules: [
      reglaIgual('Disponible', GREEN, GREEN_TEXT, 1),
      reglaIgual('Ocupada', BLUE, NAVY, 2),
      reglaIgual('Operativo', GREEN, GREEN_TEXT, 3),
      reglaIgual('En mantenimiento', YELLOW, YELLOW_TEXT, 4),
      reglaIgual('Fuera de servicio', RED, RED_TEXT, 5),
    ],
  })
}

function estadoIncidencia(sheet: ExcelJS.Worksheet, ocupadas: number) {
  const ultima = 5 + Math.max(ocupadas, 0) + EXTRA
  sheet.addConditionalFormatting({
    ref: `H6:H${ultima}`,
    rules: [
      reglaIgual('Pendiente', YELLOW, YELLOW_TEXT, 1),
      reglaIgual('En atención', YELLOW, YELLOW_TEXT, 2),
      reglaIgual('En proceso', YELLOW, YELLOW_TEXT, 3),
      reglaIgual('Resuelta', GREEN, GREEN_TEXT, 4),
    ],
  })
}

function reglaIgual(texto: string, fondo: string, tinta: string, priority: number): ExcelJS.ConditionalFormattingRule {
  return {
    type: 'cellIs',
    operator: 'equal',
    priority,
    formulae: [`"${texto}"`],
    style: {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fondo } },
      font: { color: { argb: tinta }, bold: true },
    },
  }
}

function banner(sheet: ExcelJS.Worksheet, rango: string, texto: string) {
  sheet.mergeCells(rango)
  const celda = sheet.getCell(rango.split(':')[0])
  celda.value = texto
  celda.font = { name: 'Calibri', bold: true, size: 16, color: { argb: WHITE } }
  celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  celda.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
}

function areaDe(accion: string) {
  const equipo = accion.match(/LAB\d-PC\d{2}/)
  if (equipo) return equipo[0]
  const laboratorio = accion.match(/Laboratorio \d/)
  if (laboratorio) return laboratorio[0]
  return ''
}

function fechaCelda(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function columna(total: number) {
  let n = total
  let texto = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    texto = String.fromCharCode(65 + resto) + texto
    n = Math.floor((n - 1) / 26)
  }
  return texto
}
