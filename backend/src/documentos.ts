import { AlignmentType, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import type { DocumentoInstitucional, TablaDocumento } from '../../shared/institucional.ts'
import type { FormatoInforme, Informe, Membrete } from '../../shared/informes.ts'

export interface LogoInforme {
  buffer: Buffer
  tipo: 'png' | 'jpg'
}

const NAVY = 'FF0B1F3A'
const CONTENT: Record<FormatoInforme, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv; charset=utf-8',
}

export function tipoContenido(formato: FormatoInforme) {
  return CONTENT[formato]
}

export function nombreArchivo(id: string, formato: FormatoInforme) {
  const ahora = new Date()
  const sello = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}`
  return `LAB-CONTROL-${id}-${sello}.${formato}`
}

export function leerLogo(value: unknown): LogoInforme | null {
  if (typeof value !== 'string' || !value) return null
  const match = value.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\r\n]+)$/)
  if (!match) throw new Error('El logotipo debe ser un archivo PNG o JPG.')
  const buffer = Buffer.from(match[2], 'base64')
  if (!buffer.length || buffer.length > 200_000) throw new Error('El logotipo debe pesar menos de 200 KB.')
  return { buffer, tipo: match[1] === 'png' ? 'png' : 'jpg' }
}

export async function exportarDocumento(documento: DocumentoInstitucional, formato: FormatoInforme, logo: LogoInforme | null, creado: string) {
  if (formato === 'xlsx') return libroInstitucional(documento, creado)
  if (formato === 'pdf') return pdfInstitucional(documento, logo, creado)
  if (formato === 'docx') return wordInstitucional(documento, logo, creado)
  return Buffer.from(`\uFEFF${textoInstitucional(documento)}`, 'utf8')
}

export async function exportarInforme(informe: Informe, formato: FormatoInforme, membrete: Membrete, logo: LogoInforme | null, creado: string) {
  if (formato === 'xlsx') return construirLibro(informe, membrete, creado)
  if (formato === 'pdf') return construirPdf(informe, membrete, logo, creado)
  if (formato === 'docx') return construirWord(informe, membrete, logo, creado)
  return construirCsv(informe)
}

async function construirLibro(informe: Informe, membrete: Membrete, creado: string) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'LAB CONTROL'
  workbook.created = new Date()
  workbook.title = membrete.titulo

  const info = workbook.addWorksheet('Información')
  info.addRows([
    ['LAB CONTROL'],
    ['Institución', membrete.institucion || 'Sin configurar'],
    ['Encargado', membrete.encargado || 'Sin configurar'],
    ['Área o departamento', membrete.departamento || 'Sin especificar'],
    ['Revisó', membrete.reviso || 'Sin especificar'],
    ['Autorizó', membrete.autorizo || 'Sin especificar'],
    ['Título', membrete.titulo],
    ['Periodo', informe.periodo],
    ['Fecha de generación', membrete.fecha],
    ['Archivo creado', creado],
    ['Fuente', informe.notaFuente],
    ['Aviso', informe.avisoPrivacidad || 'Este reporte no lista nombres de alumnos.'],
    ['Nota', informe.advertencia || 'Sin notas adicionales'],
    ['Filtros', informe.filtros.join(' | ') || 'Sin filtros adicionales'],
    ['Registros', informe.filas.length],
  ])
  info.getColumn(1).width = 28
  info.getColumn(2).width = 110
  info.getRow(1).font = { bold: true, size: 16, color: { argb: NAVY } }
  for (const par of [...informe.totales, ...informe.resumen]) info.addRow([par.etiqueta, par.valor])

  const sheet = workbook.addWorksheet('Registros')
  sheet.columns = informe.columnas.map((columna) => ({ header: columna.header, key: columna.key, width: columna.ancho }))
  for (const fila of informe.filas) {
    const row: Record<string, string | number | Date> = {}
    for (const columna of informe.columnas) {
      const value = fila[columna.key]
      row[columna.key] = esFecha(columna.key, value) ? fechaLocal(value) : value ?? ''
    }
    sheet.addRow(row)
  }
  for (const columna of informe.columnas) {
    if (columna.key === 'fecha' || columna.key === 'ultima') sheet.getColumn(columna.key).numFmt = 'dd/mm/yyyy'
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  if (informe.columnas.length) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: informe.columnas.length } }
  }
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  })
  sheet.getRow(1).height = 22

  const resumen = workbook.addWorksheet('Resumen')
  resumen.addRow(['Concepto', 'Valor'])
  for (const par of [...informe.totales, ...informe.resumen]) resumen.addRow([par.etiqueta, par.valor])
  resumen.getColumn(1).width = 36
  resumen.getColumn(2).width = 42
  resumen.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  resumen.getRow(1).eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  })
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

function construirPdf(informe: Informe, membrete: Membrete, logo: LogoInforme | null, creado: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 46, bufferPages: true, info: { Title: membrete.titulo, Author: 'LAB CONTROL' } })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    const left = 46
    const width = doc.page.width - 92
    const bottom = doc.page.height - 62
    const columnas = informe.columnas
    const totalAncho = columnas.reduce((sum, columna) => sum + columna.ancho, 0) || 1
    const anchos = columnas.map((columna) => (columna.ancho / totalAncho) * width)

    const encabezado = () => {
      if (logo) {
        try { doc.image(logo.buffer, left, 34, { fit: [42, 42] }) } catch { /* un archivo dañado no detiene el documento */ }
      }
      const x = logo ? left + 50 : left
      doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(11).text('LAB CONTROL', x, 36, { width: width - (logo ? 50 : 0), lineBreak: false })
      doc.font('Helvetica').fontSize(9).fillColor('#475569').text(membrete.institucion || 'Nombre de la preparatoria: sin configurar', x, 52, { width: width - (logo ? 50 : 0), lineBreak: false })
      doc.moveTo(left, 84).lineTo(left + width, 84).strokeColor('#CBD5E1').stroke()
      doc.y = 94
    }
    const filaEncabezado = () => {
      const y = doc.y
      doc.save()
      doc.rect(left, y, width, 16).fill('#0B1F3A')
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7)
      let x = left
      columnas.forEach((columna, index) => {
        doc.text(columna.header, x + 2, y + 4, { width: anchos[index] - 4, height: 10, lineBreak: false })
        x += anchos[index]
      })
      doc.restore()
      doc.y = y + 16
    }
    const saltar = () => {
      doc.addPage()
      encabezado()
      if (columnas.length) filaEncabezado()
    }

    encabezado()
    doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(15).text(membrete.titulo, left, doc.y, { width })
    doc.moveDown(0.35)
    doc.fillColor('#1E293B').font('Helvetica').fontSize(9)
    for (const linea of [
      `Periodo: ${informe.periodo}`,
      `Fecha de generación: ${membrete.fecha}`,
      `Archivo creado: ${creado}`,
      `Encargado: ${membrete.encargado || 'Sin configurar'}`,
      `Área o departamento: ${membrete.departamento || 'Sin especificar'}`,
      informe.notaFuente,
      informe.avisoPrivacidad,
      informe.advertencia,
      informe.filtros.length ? `Filtros: ${informe.filtros.join(' | ')}` : 'Filtros: sin filtros adicionales',
    ].filter(Boolean)) doc.text(linea, left, doc.y, { width })
    doc.moveDown(0.5)
    if (columnas.length) filaEncabezado()
    if (!informe.filas.length) doc.font('Helvetica').fontSize(9).fillColor('#1E293B').text('No hay registros con los filtros indicados.', left, doc.y + 6, { width })
    informe.filas.forEach((fila, index) => {
      if (doc.y + 15 > bottom) saltar()
      const y = doc.y
      if (index % 2 === 1) doc.rect(left, y, width, 14).fill('#F8FAFC')
      doc.fillColor('#0F172A').font('Helvetica').fontSize(7)
      let x = left
      columnas.forEach((columna, columnIndex) => {
        doc.text(recortar(String(fila[columna.key] ?? '')), x + 2, y + 3, { width: anchos[columnIndex] - 4, height: 10, lineBreak: false })
        x += anchos[columnIndex]
      })
      doc.y = y + 14
    })
    if (doc.y + 24 > bottom) saltar()
    doc.moveDown(0.6)
    doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(11).text('Totales y estadísticas', left, doc.y, { width })
    doc.moveDown(0.2)
    doc.font('Helvetica').fontSize(9).fillColor('#1E293B')
    for (const par of [...informe.totales, ...informe.resumen]) {
      if (doc.y + 14 > bottom) saltar()
      doc.text(`${par.etiqueta}: ${par.valor}`, left, doc.y, { width })
    }
    const range = doc.bufferedPageRange()
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index)
      const margen = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(`Página ${index + 1} de ${range.count}`, left, doc.page.height - 32, { width, align: 'right', lineBreak: false })
      doc.page.margins.bottom = margen
    }
    doc.end()
  })
}

async function construirWord(informe: Informe, membrete: Membrete, logo: LogoInforme | null, creado: string) {
  const encabezado: Paragraph[] = []
  if (logo) {
    encabezado.push(new Paragraph({
      children: [new ImageRun({ type: logo.tipo, data: logo.buffer, transformation: { width: 56, height: 56 }, altText: { title: 'Logotipo', description: 'Logotipo configurado para el informe', name: 'logotipo' } })],
    }))
  }
  encabezado.push(
    par('LAB CONTROL', true),
    par(membrete.institucion || 'Nombre de la preparatoria: sin configurar', true),
    par(membrete.titulo, true),
    par(`Periodo: ${informe.periodo}`),
    par(`Fecha de generación: ${membrete.fecha}`),
    par(`Archivo creado: ${creado}`),
    par(`Encargado: ${membrete.encargado || 'Sin configurar'}`),
    par(`Área o departamento: ${membrete.departamento || 'Sin especificar'}`),
    par(informe.notaFuente),
  )
  if (informe.avisoPrivacidad) encabezado.push(par(informe.avisoPrivacidad))
  if (informe.advertencia) encabezado.push(par(informe.advertencia))
  encabezado.push(par(informe.filtros.length ? `Filtros: ${informe.filtros.join(' | ')}` : 'Filtros: sin filtros adicionales'))
  encabezado.push(par(''))

  const anchos = informe.columnas.length ? Math.floor(9360 / informe.columnas.length) : 9360
  const tabla = new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: [
      new TableRow({
        tableHeader: true,
        children: informe.columnas.map((columna) => celda(columna.header, anchos, true)),
      }),
      ...(informe.filas.length ? informe.filas.map((fila) => new TableRow({
        children: informe.columnas.map((columna) => celda(String(fila[columna.key] ?? ''), anchos, false)),
      })) : [new TableRow({ children: [celda('No hay registros con los filtros indicados.', 9360, false)] })]),
    ],
  })
  const cierre = [par(''), par('Totales y estadísticas', true), ...[...informe.totales, ...informe.resumen].map((item) => par(`${item.etiqueta}: ${item.valor}`))]
  const document = new Document({
    creator: 'LAB CONTROL',
    title: membrete.titulo,
    description: informe.notaFuente,
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'LAB CONTROL', bold: true }), new TextRun({ text: `  ·  ${membrete.titulo}` })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun('Página '), new TextRun({ children: [PageNumber.CURRENT] }), new TextRun(' de '), new TextRun({ children: [PageNumber.TOTAL_PAGES] })] })] }) },
      children: [...encabezado, tabla, ...cierre],
    }],
  })
  return Packer.toBuffer(document)
}

function pdfInstitucional(documento: DocumentoInstitucional, logo: LogoInforme | null, creado: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54, bufferPages: true, info: { Title: documento.titulo, Author: documento.institucion } })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    const left = 54
    const width = doc.page.width - 108
    const bottom = doc.page.height - 64

    const correr = () => {
      doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(8).text('LABORATORIO DE CÓMPUTO', left, 32, { width: width * 0.62, lineBreak: false })
      doc.font('Helvetica').fontSize(8).fillColor('#475569').text(documento.institucion, left + width * 0.38, 32, { width: width * 0.62, align: 'right', lineBreak: false })
      doc.moveTo(left, 46).lineTo(left + width, 46).strokeColor('#0B1F3A').lineWidth(1).stroke()
      doc.y = 58
    }
    const asegurar = (alto: number) => {
      if (doc.y + alto <= bottom) return
      doc.addPage()
      correr()
    }
    const parrafo = (texto: string, size: number, font: string, color: string, despues = 6) => {
      doc.font(font).fontSize(size).fillColor(color)
      const alto = doc.heightOfString(texto, { width })
      asegurar(alto + despues)
      doc.text(texto, left, doc.y, { width })
      doc.moveDown(despues / 12)
    }
    const tabla = (datos: TablaDocumento) => {
      const total = datos.anchos.reduce((sum, item) => sum + item, 0) || 1
      const anchos = datos.anchos.map((item) => (item / total) * width)
      const dibujarEncabezado = () => {
        asegurar(18)
        const y = doc.y
        doc.save()
        doc.rect(left, y, width, 16).fill('#0B1F3A')
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7)
        let x = left
        datos.columnas.forEach((columna, index) => {
          doc.text(columna, x + 3, y + 4, { width: anchos[index] - 6, height: 10, lineBreak: false })
          x += anchos[index]
        })
        doc.restore()
        doc.y = y + 16
      }
      dibujarEncabezado()
      datos.filas.forEach((fila, index) => {
        doc.font('Helvetica').fontSize(7.5)
        const alto = Math.max(14, ...fila.map((celda, celdaIndex) => doc.heightOfString(celda || ' ', { width: anchos[celdaIndex] - 6 }) + 6))
        if (doc.y + alto > bottom) {
          doc.addPage()
          correr()
          dibujarEncabezado()
        }
        const y = doc.y
        if (index % 2 === 0) doc.rect(left, y, width, alto).fill('#EFF6FF')
        doc.fillColor('#0F172A').font('Helvetica').fontSize(7.5)
        let x = left
        fila.forEach((celda, celdaIndex) => {
          doc.text(celda || ' ', x + 3, y + 3, { width: anchos[celdaIndex] - 6, height: alto - 4 })
          x += anchos[celdaIndex]
        })
        doc.y = y + alto
      })
      if (datos.nota) parrafo(datos.nota, 8, 'Helvetica-Oblique', '#475569')
      doc.moveDown(0.3)
    }

    correr()
    if (logo) {
      try { doc.image(logo.buffer, left, doc.y, { fit: [48, 48] }) } catch { /* el logotipo dañado no detiene el informe */ }
    }
    const textoX = logo ? left + 58 : left
    const textoAncho = width - (logo ? 58 : 0)
    const yTitulo = doc.y
    doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(9).text(documento.departamento, textoX, yTitulo, { width: textoAncho })
    doc.font('Helvetica-Bold').fontSize(16).text(documento.titulo, textoX, doc.y, { width: textoAncho })
    doc.font('Helvetica').fontSize(9).fillColor('#1E293B').text(documento.laboratorio, textoX, doc.y + 2, { width: textoAncho })
    doc.y = Math.max(doc.y + 8, yTitulo + (logo ? 56 : 8))
    asegurar(20)
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).strokeColor('#BFDBFE').stroke()
    doc.moveDown(0.6)
    parrafo('Datos generales', 12, 'Helvetica-Bold', '#0B1F3A', 4)
    for (const dato of documento.datos) parrafo(`${dato.etiqueta}: ${dato.valor}`, 9, 'Helvetica', '#1E293B', 2)
    if (documento.filtros.length) parrafo(`Filtros: ${documento.filtros.join(' | ')}`, 8, 'Helvetica', '#475569', 2)
    documento.secciones.forEach((bloque, index) => {
      doc.moveDown(0.4)
      parrafo(`${index + 1}. ${bloque.titulo}`, 12, 'Helvetica-Bold', '#0B1F3A', 3)
      for (const texto of bloque.parrafos) parrafo(texto, 10, 'Helvetica', '#1E293B', 4)
      if (bloque.tabla) tabla(bloque.tabla)
    })
    doc.moveDown(0.5)
    parrafo('Firmas de validación', 12, 'Helvetica-Bold', '#0B1F3A', 4)
    parrafo('Los nombres aparecen solo si fueron escritos al elaborar el archivo. La firma y el sello quedan en blanco.', 8, 'Helvetica', '#475569', 8)
    const hueco = 78
    asegurar(hueco)
    const columna = (width - 24) / 3
    const yFirmas = doc.y
    documento.firmas.forEach((firma, index) => {
      const x = left + index * (columna + 12)
      doc.fillColor('#0B1F3A').font('Helvetica-Bold').fontSize(8).text(firma.rol, x, yFirmas, { width: columna })
      doc.moveTo(x, yFirmas + 36).lineTo(x + columna, yFirmas + 36).strokeColor('#0B1F3A').stroke()
      doc.font('Helvetica').fontSize(8).fillColor('#1E293B').text(firma.nombre || 'Nombre', x, yFirmas + 40, { width: columna })
      doc.fillColor('#475569').fontSize(7).text(firma.cargo, x, yFirmas + 52, { width: columna })
    })
    doc.y = yFirmas + hueco
    asegurar(70)
    doc.rect(left, doc.y, 150, 52).strokeColor('#93C5FD').stroke()
    doc.font('Helvetica').fontSize(8).fillColor('#475569').text('Espacio para sello institucional', left + 8, doc.y + 20, { width: 134 })
    doc.y += 64
    parrafo(`Fecha de elaboración: ${documento.fechaElaboracion}. Archivo creado: ${creado}.`, 8, 'Helvetica', '#475569', 3)
    parrafo(documento.notaFuente, 8, 'Helvetica', '#475569', 2)

    const range = doc.bufferedPageRange()
    for (let index = 0; index < range.count; index += 1) {
      doc.switchToPage(range.start + index)
      const margen = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      doc.font('Helvetica').fontSize(8).fillColor('#64748B')
        .text(`${documento.institucion}  ·  Laboratorio de cómputo  ·  Página ${index + 1} de ${range.count}`, left, doc.page.height - 36, { width, align: 'center', lineBreak: false })
      doc.page.margins.bottom = margen
    }
    doc.end()
  })
}

async function wordInstitucional(documento: DocumentoInstitucional, logo: LogoInforme | null, creado: string) {
  const children: (Paragraph | Table)[] = []
  if (logo) {
    children.push(new Paragraph({
      children: [new ImageRun({ type: logo.tipo, data: logo.buffer, transformation: { width: 52, height: 52 }, altText: { title: 'Logotipo', description: 'Logotipo del plantel', name: 'logotipo' } })],
    }))
  }
  children.push(
    par(documento.institucion, true),
    par(documento.departamento),
    par(documento.titulo, true),
    par(documento.laboratorio),
    par(''),
    par('Datos generales', true),
    ...documento.datos.map((dato) => par(`${dato.etiqueta}: ${dato.valor}`)),
  )
  if (documento.filtros.length) children.push(par(`Filtros: ${documento.filtros.join(' | ')}`))
  documento.secciones.forEach((bloque, index) => {
    children.push(par(''), par(`${index + 1}. ${bloque.titulo}`, true), ...bloque.parrafos.map((texto) => par(texto)))
    if (bloque.tabla) children.push(tablaWord(bloque.tabla), ...(bloque.tabla.nota ? [par(bloque.tabla.nota)] : []))
  })
  children.push(par(''), par('Firmas de validación', true), par('Los nombres aparecen solo si fueron escritos al elaborar el archivo. La firma y el sello quedan en blanco.'))
  for (const firma of documento.firmas) {
    children.push(par(''), par(firma.rol, true), par(firma.nombre || ' '), par('________________________________'), par(firma.cargo), par('Fecha: ____________________'))
  }
  children.push(par(''), par('Espacio para sello institucional'), par(`Fecha de elaboración: ${documento.fechaElaboracion}. Archivo creado: ${creado}.`), par(documento.notaFuente))
  const document = new Document({
    creator: 'LAB CONTROL',
    title: documento.titulo,
    description: documento.notaFuente,
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: 'LABORATORIO DE CÓMPUTO', bold: true, font: 'Calibri', color: '0B1F3A' }), new TextRun({ text: `    ${documento.institucion}`, font: 'Calibri', color: '475569' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${documento.institucion}  ·  Laboratorio de cómputo  ·  Página `, font: 'Calibri', size: 16, color: '64748B' }), new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 16, color: '64748B' }), new TextRun({ text: ' de ', font: 'Calibri', size: 16, color: '64748B' }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Calibri', size: 16, color: '64748B' })] })] }) },
      children,
    }],
  })
  return Packer.toBuffer(document)
}

async function libroInstitucional(documento: DocumentoInstitucional, creado: string) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'LAB CONTROL'
  workbook.created = new Date()
  workbook.title = documento.titulo
  const portada = workbook.addWorksheet('Informe')
  portada.addRows([
    [documento.titulo],
    ['Institución', documento.institucion],
    ['Área o departamento', documento.departamento],
    ['Laboratorio', documento.laboratorio],
    ['Responsable', documento.responsable],
    ['Periodo', documento.periodo],
    ['Fecha de elaboración', documento.fechaElaboracion],
    ['Archivo creado', creado],
    ['Fuente', documento.notaFuente],
    ['Filtros', documento.filtros.join(' | ') || 'Sin filtros adicionales'],
  ])
  portada.getColumn(1).width = 36
  portada.getColumn(2).width = 110
  portada.getRow(1).font = { bold: true, size: 16, color: { argb: NAVY } }
  for (const bloque of documento.secciones) {
    portada.addRow([])
    portada.addRow([bloque.titulo])
    const titulo = portada.lastRow
    if (titulo) titulo.font = { bold: true, color: { argb: NAVY } }
    for (const texto of bloque.parrafos) portada.addRow([texto])
  }
  portada.addRow([])
  portada.addRow(['Firmas de validación'])
  for (const firma of documento.firmas) portada.addRow([firma.rol, firma.nombre || 'Sin especificar', firma.cargo])
  const usados = new Set<string>(['Informe'])
  documento.secciones.forEach((bloque, index) => {
    if (!bloque.tabla) return
    let nombre = bloque.titulo.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || `Tabla ${index + 1}`
    while (usados.has(nombre)) nombre = `${nombre.slice(0, 24)} ${index + 1}`
    usados.add(nombre)
    const sheet = workbook.addWorksheet(nombre)
    sheet.addRow(bloque.tabla.columnas)
    for (const fila of bloque.tabla.filas) sheet.addRow(fila)
    if (bloque.tabla.nota) sheet.addRow([bloque.tabla.nota])
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    })
    bloque.tabla.columnas.forEach((_, columnIndex) => { sheet.getColumn(columnIndex + 1).width = 28 })
  })
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

function tablaWord(datos: TablaDocumento) {
  const anchos = datos.columnas.length ? Math.floor(9360 / datos.columnas.length) : 9360
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: datos.columnas.map((columna) => celda(columna, anchos, true)) }),
      ...(datos.filas.length
        ? datos.filas.map((fila) => new TableRow({ children: fila.map((valor) => celda(valor, anchos, false)) }))
        : [new TableRow({ children: [celda('Sin registros.', 9360, false)] })]),
    ],
  })
}

function textoInstitucional(documento: DocumentoInstitucional) {
  const lineas = [
    documento.titulo,
    documento.institucion,
    documento.periodo,
    ...documento.secciones.flatMap((bloque) => [
      bloque.titulo,
      ...bloque.parrafos,
      ...(bloque.tabla ? [bloque.tabla.columnas.join(','), ...bloque.tabla.filas.map((fila) => fila.join(',')), bloque.tabla.nota] : []),
    ]),
    documento.notaFuente,
  ]
  return lineas.filter(Boolean).join('\r\n')
}

function construirCsv(informe: Informe) {
  const lineas = [
    informe.columnas.map((columna) => csvCampo(columna.header)).join(','),
    ...informe.filas.map((fila) => informe.columnas.map((columna) => csvCampo(fila[columna.key] ?? '')).join(',')),
  ]
  return Buffer.from(`\uFEFF${lineas.join('\r\n')}`, 'utf8')
}

function par(text: string, strong = false) {
  return new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text, bold: strong, font: 'Calibri', size: strong ? 24 : 20 })] })
}

function celda(text: string, width: number, header: boolean) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: header ? { fill: '0B1F3A' } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: header, color: header ? 'FFFFFF' : '0F172A', font: 'Calibri', size: 16 })] })],
  })
}

function csvCampo(value: string | number) {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function esFecha(key: string, value: unknown): value is string {
  return (key === 'fecha' || key === 'ultima') && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function fechaLocal(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function recortar(value: string) {
  return value.length > 48 ? `${value.slice(0, 45)}...` : value
}
