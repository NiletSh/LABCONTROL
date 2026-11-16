import ExcelJS from 'exceljs'

interface FilaEntrada {
  fecha?: unknown
  hora?: unknown
  matricula?: unknown
  alumno?: unknown
  semestre?: unknown
  grupo?: unknown
  turno?: unknown
  laboratorio?: unknown
  maestro?: unknown
  materia?: unknown
  claveMateria?: unknown
  horario?: unknown
}

const COLUMNAS: { header: string; key: keyof FilaEntrada; width: number }[] = [
  { header: 'Fecha', key: 'fecha', width: 14 },
  { header: 'Hora', key: 'hora', width: 10 },
  { header: 'Matrícula', key: 'matricula', width: 16 },
  { header: 'Alumno', key: 'alumno', width: 32 },
  { header: 'Semestre', key: 'semestre', width: 12 },
  { header: 'Grupo', key: 'grupo', width: 12 },
  { header: 'Turno', key: 'turno', width: 14 },
  { header: 'Laboratorio', key: 'laboratorio', width: 18 },
  { header: 'Maestro', key: 'maestro', width: 28 },
  { header: 'Materia', key: 'materia', width: 36 },
  { header: 'Clave', key: 'claveMateria', width: 14 },
  { header: 'Horario', key: 'horario', width: 16 },
]

function texto(value: unknown) {
  return value == null ? '' : String(value)
}

export async function construirExcel(body: unknown) {
  const payload = body && typeof body === 'object' ? (body as { filas?: unknown; filtros?: unknown }) : {}
  if (!Array.isArray(payload.filas)) throw new Error('No se recibieron registros para exportar.')
  if (payload.filas.length > 5000) throw new Error('La exportación supera el máximo de 5000 registros.')

  const filas = payload.filas.map((fila) => {
    const item = fila && typeof fila === 'object' ? (fila as FilaEntrada) : {}
    return {
      fecha: texto(item.fecha),
      hora: texto(item.hora),
      matricula: texto(item.matricula),
      alumno: texto(item.alumno),
      semestre: Number(item.semestre) || '',
      grupo: texto(item.grupo),
      turno: texto(item.turno),
      laboratorio: texto(item.laboratorio),
      maestro: texto(item.maestro),
      materia: texto(item.materia),
      claveMateria: texto(item.claveMateria),
      horario: texto(item.horario),
    }
  })

  const filtros = Array.isArray(payload.filtros) ? payload.filtros.map((item) => texto(item)).filter(Boolean) : []
  const ahora = new Date()
  const sello = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}`

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'LAB CONTROL'
  workbook.created = ahora

  const info = workbook.addWorksheet('Información')
  info.addRows([
    ['LAB CONTROL'],
    ['Tipo de archivo', 'Exportación de demostración'],
    ['Persistido en base de datos', 'No'],
    ['Nota', 'Los registros corresponden a los filtros aplicados en pantalla sobre datos de demostración. No son un archivo oficial hasta que la base de datos esté conectada.'],
    ['Generado', ahora.toLocaleString('es-MX')],
    ['Filtros', filtros.join(' | ') || 'Sin filtros'],
    ['Registros', filas.length],
  ])
  info.getColumn(1).width = 32
  info.getColumn(2).width = 110
  info.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF0B1F3A' } }

  const sheet = workbook.addWorksheet('Ingresos')
  sheet.columns = COLUMNAS
  sheet.addRows(filas)
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNAS.length },
  }
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1F3A' } }
    cell.alignment = { vertical: 'middle' }
  })
  sheet.getRow(1).height = 22

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  return { buffer, filename: `LAB-CONTROL-ingresos-${sello}.xlsx` }
}
