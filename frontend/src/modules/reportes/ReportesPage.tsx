import { useMemo, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react'
import { CATEGORIAS, CATALOGO, filtrosIniciales, tableroReportes } from '@shared/informes'
import { relojMexico } from '@shared/reloj'
import type { CategoriaInforme, FiltrosInforme, FormatoInforme, Membrete, VistaInforme } from '@shared/informes'
import { EXTENSIONES, rangoSugerido, TIPOS_INSTITUCIONALES } from '@shared/institucional'
import type { DocumentoInstitucional, ExtensionInforme, TipoInstitucional } from '@shared/institucional'
import { descargarInforme, vistaInforme, vistaInstitucional } from '../../api'
import { MeterList } from '../../components/Charts'
import { Button, Field, PageHeader, Segments } from '../../components/ui'
import { useApp, useData } from '../../state'

export function ReportesPage() {
  const data = useData()
  const { avisar } = useApp()
  const [categoria, setCategoria] = useState<CategoriaInforme>('asistencia')
  const [reporteId, setReporteId] = useState('asistencia-diaria')
  const [filtros, setFiltros] = useState<FiltrosInforme>(() => filtrosIniciales(relojMexico().fecha))
  const [modo, setModo] = useState<'datos' | 'direccion'>('datos')
  const [tipoInst, setTipoInst] = useState<TipoInstitucional>('mensual')
  const [extension, setExtension] = useState<ExtensionInforme>('detallado')
  const [institucion, setInstitucion] = useState('')
  const [encargado, setEncargado] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [reviso, setReviso] = useState('')
  const [autorizo, setAutorizo] = useState('')
  const [titulo, setTitulo] = useState('')
  const [fecha, setFecha] = useState(() => relojMexico().fecha)
  const [logo, setLogo] = useState('')
  const [vista, setVista] = useState<VistaInforme | null>(null)
  const [documento, setDocumento] = useState<DocumentoInstitucional | null>(null)
  const [firmaVista, setFirmaVista] = useState('')
  const [ocupado, setOcupado] = useState<'vista' | FormatoInforme | null>(null)
  const opciones = CATALOGO.filter((item) => item.categoria === categoria)
  const reporte = CATALOGO.find((item) => item.id === reporteId) ?? opciones[0]
  const firma = JSON.stringify({ modo, reporteId, tipoInst, extension, filtros, institucion, encargado, departamento, reviso, autorizo, titulo, fecha })
  const tablero = useMemo(() => tableroReportes(data, filtros), [data, filtros])
  const vistaVisible = vista && firmaVista === firma ? vista : null
  const documentoVisible = documento && firmaVista === firma ? documento : null
  const tipoNombre = TIPOS_INSTITUCIONALES.find((item) => item.id === tipoInst)?.nombre ?? 'Informe'
  const membrete = (): Membrete => ({
    institucion: institucion.trim(),
    encargado: encargado.trim(),
    titulo: titulo.trim() || (modo === 'direccion' ? tipoNombre : reporte.nombre),
    fecha,
    departamento: departamento.trim(),
    reviso: reviso.trim(),
    autorizo: autorizo.trim(),
  })

  const cambiar = (patch: Partial<FiltrosInforme>) => setFiltros({ ...filtros, ...patch })
  const elegirCategoria = (id: string) => {
    const next = id as CategoriaInforme
    setCategoria(next)
    const primero = CATALOGO.find((item) => item.categoria === next)
    if (primero) setReporteId(primero.id)
  }

  const elegirModo = (id: string) => {
    const next = id === 'direccion' ? 'direccion' : 'datos'
    setModo(next)
    if (next === 'direccion') {
      const rango = rangoSugerido(tipoInst, filtros.desde || relojMexico().fecha)
      if (rango) setFiltros({ ...filtros, ...rango })
    }
  }
  const elegirTipo = (tipo: TipoInstitucional) => {
    setTipoInst(tipo)
    const rango = rangoSugerido(tipo, relojMexico().fecha)
    if (rango) setFiltros({ ...filtros, ...rango })
  }

  const preparar = async () => {
    setOcupado('vista')
    try {
      if (modo === 'direccion') {
        setDocumento(await vistaInstitucional(tipoInst, extension, filtros, membrete()))
      } else {
        setVista(await vistaInforme(reporte.id, filtros))
      }
      setFirmaVista(firma)
    } catch (error) {
      avisar(error instanceof Error ? error.message : 'No se pudo preparar la vista previa.', 'danger')
    } finally {
      setOcupado(null)
    }
  }

  const descargar = async (formato: FormatoInforme) => {
    setOcupado(formato)
    try {
      await descargarInforme(modo === 'direccion' ? tipoInst : reporte.id, formato, filtros, membrete(), logo, modo === 'direccion' ? { tipo: tipoInst, extension } : undefined)
      avisar(formato === 'csv'
        ? 'Se descargó el CSV en UTF-8. Trae la tabla, sin portada, para poder importarlo.'
        : modo === 'direccion'
          ? formato === 'xlsx'
            ? 'Se descargó el control en Excel. El resumen se calcula con las otras hojas.'
            : 'Se descargó el informe. Revisa los nombres y deja las firmas para imprimir.'
          : 'Se descargó el archivo.', 'ok')
    } catch (error) {
      avisar(error instanceof Error ? error.message : 'No se pudo generar el archivo.', 'danger')
    } finally {
      setOcupado(null)
    }
  }

  const cargarLogo = (file: File | undefined) => {
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      avisar('El logotipo debe ser PNG o JPG.', 'warn')
      return
    }
    if (file.size > 200_000) {
      avisar('El logotipo debe pesar menos de 200 KB.', 'warn')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setLogo(typeof reader.result === 'string' ? reader.result : '')
    reader.readAsDataURL(file)
  }

  return (
    <section className="page">
      <PageHeader
        title="Reportes"
        description="Tablas de consulta o un informe para la dirección. Solo entran los datos registrados; lo que no está capturado se dice con claridad."
      />
      <p className="hint no-print">Escribe el nombre de la preparatoria, el área y quien elabora, revisa y autoriza. Si un nombre queda vacío, el documento no lo inventa.</p>

      <div className="stats no-print">
        <article className="stat-card"><span>Ingresos</span><strong>{tablero.ingresos}</strong><small>{tablero.alumnosDistintos} alumnos distintos</small></article>
        <article className="stat-card"><span>Laboratorio con más actividad</span><strong className="stat-text">{tablero.labMayor}</strong><small>Según los filtros de fecha, laboratorio y turno</small></article>
        <article className="stat-card"><span>Incidencias</span><strong>{tablero.incidencias}</strong><small>{tablero.incidenciasPendientes} pendientes o en atención</small></article>
        <article className="stat-card"><span>Equipos</span><strong>{tablero.equipos.reduce((sum, item) => sum + item.value, 0)}</strong><small>Estado actual, no depende de las fechas</small></article>
      </div>
      <div className="report-board no-print">
        <article className="panel">
          <div className="panel-head"><h2>Alumnos con más ingresos</h2></div>
          <p className="hint">Nombre y matrícula solo para la administración del laboratorio.</p>
          <MeterList items={tablero.alumnosTop} />
        </article>
        <article className="panel">
          <div className="panel-head"><h2>Uso por turno</h2></div>
          <MeterList items={tablero.porTurno} />
        </article>
        <article className="panel">
          <div className="panel-head"><h2>Materias con más ingresos</h2></div>
          <MeterList items={tablero.materiasTop} />
        </article>
        <article className="panel">
          <div className="panel-head"><h2>Estado de los equipos</h2></div>
          <MeterList items={tablero.equipos} />
        </article>
      </div>

      <article className="panel no-print">
        <div className="panel-head"><h2>Datos del documento</h2></div>
        <div className="form-grid">
          <Field label="Nombre de la preparatoria" hint="Si lo dejas vacío, el archivo dice que no está configurado.">
            <input value={institucion} onChange={(event) => setInstitucion(event.target.value)} placeholder="Sin configurar" />
          </Field>
          <Field label="Nombre del encargado">
            <input value={encargado} onChange={(event) => setEncargado(event.target.value)} placeholder="Sin especificar" />
          </Field>
          <Field label="Área o departamento">
            <input value={departamento} onChange={(event) => setDepartamento(event.target.value)} placeholder="Sin especificar" />
          </Field>
          <Field label="Revisó" hint="Jefatura o responsable del área. Se deja en blanco si no lo escribes.">
            <input value={reviso} onChange={(event) => setReviso(event.target.value)} placeholder="Sin especificar" />
          </Field>
          <Field label="Autorizó" hint="Dirección del plantel. Se deja en blanco si no lo escribes.">
            <input value={autorizo} onChange={(event) => setAutorizo(event.target.value)} placeholder="Sin especificar" />
          </Field>
          <Field label="Título del documento" hint="Si lo dejas vacío, se usa el nombre del reporte.">
            <input value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder={modo === 'direccion' ? tipoNombre : reporte.nombre} />
          </Field>
          <Field label="Fecha de generación">
            <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
          </Field>
          <Field label="Logotipo" hint="PNG o JPG, máximo 200 KB. Solo entra en PDF y Word." className="full">
            <input type="file" accept="image/png,image/jpeg" onChange={(event) => cargarLogo(event.target.files?.[0])} />
          </Field>
        </div>
        {logo ? <div className="logo-row"><img src={logo} alt="Logotipo seleccionado" /><Button type="button" variant="secondary" onClick={() => setLogo('')}>Quitar logotipo</Button></div> : null}
      </article>

      <div className="no-print">
        <Segments value={modo} onChange={elegirModo} options={[{ id: 'datos', label: 'Tablas' }, { id: 'direccion', label: 'Informe para dirección' }]} />
      </div>
      {modo === 'datos' ? (
        <div className="no-print">
          <Segments value={categoria} onChange={elegirCategoria} options={CATEGORIAS.map((item) => ({ id: item.id, label: item.nombre }))} />
        </div>
      ) : null}
      <div className="filters no-print">
        {modo === 'direccion' ? (
          <>
            <Field label="Tipo de informe" className="full">
              <select value={tipoInst} onChange={(event) => elegirTipo(event.target.value as TipoInstitucional)}>
                {TIPOS_INSTITUCIONALES.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </Field>
            <Field label="Extensión">
              <select value={extension} onChange={(event) => setExtension(event.target.value as ExtensionInforme)}>
                {EXTENSIONES.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
              </select>
            </Field>
          </>
        ) : (
          <Field label="Reporte" className="full">
            <select value={reporte.id} onChange={(event) => setReporteId(event.target.value)}>
              {opciones.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
            </select>
          </Field>
        )}
        <Field label="Desde"><input type="date" value={filtros.desde} onChange={(event) => cambiar({ desde: event.target.value })} /></Field>
        <Field label="Hasta"><input type="date" value={filtros.hasta} onChange={(event) => cambiar({ hasta: event.target.value })} /></Field>
        <Field label="Alumno"><input value={filtros.alumno} onChange={(event) => cambiar({ alumno: event.target.value })} placeholder="Nombre" /></Field>
        <Field label="Matrícula"><input value={filtros.matricula} onChange={(event) => cambiar({ matricula: event.target.value })} placeholder="Matrícula" /></Field>
        <Field label="Semestre">
          <select value={filtros.semestre} onChange={(event) => cambiar({ semestre: event.target.value })}>
            <option value="">Todos</option>
            {[1, 2, 3, 4, 5, 6].map((item) => <option key={item} value={item}>{item}°</option>)}
          </select>
        </Field>
        <Field label="Grupo">
          <select value={filtros.grupo} onChange={(event) => cambiar({ grupo: event.target.value })}>
            <option value="">Todos</option>
            {[...new Set(data.materias.map((item) => item.grupo))].sort().map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
        <Field label="Maestro">
          <select value={filtros.maestroId} onChange={(event) => cambiar({ maestroId: event.target.value })}>
            <option value="">Todos</option>
            {data.maestros.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </Field>
        <Field label="Materia">
          <select value={filtros.materiaId} onChange={(event) => cambiar({ materiaId: event.target.value })}>
            <option value="">Todas</option>
            {data.materias.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.semestre}° {item.grupo}</option>)}
          </select>
        </Field>
        <Field label="Laboratorio">
          <select value={filtros.laboratorioId} onChange={(event) => cambiar({ laboratorioId: event.target.value })}>
            <option value="">Ambos</option>
            {data.laboratorios.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </Field>
        <Field label="Turno">
          <select value={filtros.turnoId} onChange={(event) => cambiar({ turnoId: event.target.value })}>
            <option value="">Ambos</option>
            <option value="matutino">Matutino</option>
            <option value="vespertino">Vespertino</option>
          </select>
        </Field>
        <Field label="Estado de sesión">
          <select value={filtros.estadoSesion} onChange={(event) => cambiar({ estadoSesion: event.target.value })}>
            <option value="">Todos</option>
            <option value="programada">Programada</option>
            <option value="activa">En curso</option>
            <option value="finalizada">Finalizada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </Field>
        <Field label="Estado de incidencia">
          <select value={filtros.estadoIncidencia} onChange={(event) => cambiar({ estadoIncidencia: event.target.value })}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_atencion">En atención</option>
            <option value="resuelta">Resuelta</option>
          </select>
        </Field>
        <Field label="Estado del equipo">
          <select value={filtros.estadoEquipo} onChange={(event) => cambiar({ estadoEquipo: event.target.value })}>
            <option value="">Todos</option>
            <option value="disponible">Disponible</option>
            <option value="ocupada">Ocupado</option>
            <option value="mantenimiento">En mantenimiento</option>
            <option value="fuera_de_servicio">Fuera de servicio</option>
          </select>
        </Field>
      </div>
      <p className="hint no-print">{modo === 'direccion'
        ? 'Al elegir mensual, trimestral, semestral o anual, las fechas cubren ese calendario a partir de hoy. El semestre es enero–junio o julio–diciembre. Puedes corregir Desde y Hasta antes de generar.'
        : reporte.descripcion}</p>
      <div className="row-actions no-print">
        <Button type="button" onClick={() => { void preparar() }} disabled={ocupado !== null}><FileText size={18} /> Ver vista previa</Button>
      </div>

      {documentoVisible ? (
        <article className="panel informe-sheet doc-inst" id="informe-imprimir">
          <div className="informe-head">
            {logo ? <img src={logo} alt="" /> : null}
            <div>
              <p className="informe-kicker">Laboratorio de cómputo</p>
              <h2>{documentoVisible.titulo}</h2>
              <p>{documentoVisible.institucion}</p>
              <p>{documentoVisible.laboratorio}</p>
            </div>
          </div>
          <dl className="dl-grid">
            {documentoVisible.datos.map((dato) => <div key={dato.etiqueta}><dt>{dato.etiqueta}</dt><dd>{dato.valor}</dd></div>)}
          </dl>
          {documentoVisible.secciones.map((bloque, index) => (
            <section key={bloque.titulo}>
              <h3>{index + 1}. {bloque.titulo}</h3>
              {bloque.parrafos.map((texto, parrafo) => <p key={`${bloque.titulo}-${parrafo}`}>{texto}</p>)}
              {bloque.tabla ? (
                <div className="informe-table-wrap">
                  <table className="data">
                    <thead><tr>{bloque.tabla.columnas.map((columna) => <th key={columna}>{columna}</th>)}</tr></thead>
                    <tbody>
                      {bloque.tabla.filas.map((fila, filaIndex) => (
                        <tr key={`${bloque.titulo}-${filaIndex}`}>{fila.map((valor, valorIndex) => <td key={`${valorIndex}-${valor}`}>{valor}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                  {bloque.tabla.nota ? <p className="hint">{bloque.tabla.nota}</p> : null}
                </div>
              ) : null}
            </section>
          ))}
          <h3>Firmas de validación</h3>
          <div className="doc-firmas">
            {documentoVisible.firmas.map((firmaItem) => (
              <div key={firmaItem.rol}>
                <strong>{firmaItem.rol}</strong>
                <span className="doc-linea" />
                <p>{firmaItem.nombre || 'Nombre'}</p>
                <small>{firmaItem.cargo}</small>
                <small>Fecha: ____________________</small>
              </div>
            ))}
            <div className="doc-sello">Espacio para sello institucional</div>
          </div>
          <p className="hint">{documentoVisible.notaFuente}</p>
          <div className="row-actions no-print">
            <Button type="button" onClick={() => { void descargar('xlsx') }} disabled={ocupado !== null}><FileSpreadsheet size={18} /> Descargar control en Excel</Button>
            <Button type="button" variant="secondary" onClick={() => { void descargar('csv') }} disabled={ocupado !== null}><Download size={18} /> Descargar CSV</Button>
            <Button type="button" variant="secondary" onClick={() => { void descargar('pdf') }} disabled={ocupado !== null}><Download size={18} /> Descargar PDF</Button>
            <Button type="button" variant="secondary" onClick={() => { void descargar('docx') }} disabled={ocupado !== null}><Download size={18} /> Descargar Word</Button>
            <Button type="button" variant="secondary" onClick={() => window.print()} disabled={ocupado !== null}><Printer size={18} /> Imprimir</Button>
          </div>
        </article>
      ) : null}

      {vistaVisible ? (
        <article className="panel informe-sheet" id="informe-imprimir">
          <div className="informe-head">
            {logo ? <img src={logo} alt="" /> : null}
            <div>
              <p className="informe-kicker">LAB CONTROL</p>
              <h2>{titulo.trim() || reporte.nombre}</h2>
              <p>{institucion.trim() || 'Nombre de la preparatoria: sin configurar'}</p>
              <p>Encargado: {encargado.trim() || 'Sin configurar'}</p>
            </div>
          </div>
          <dl className="dl-grid">
            <div><dt>Reporte</dt><dd>{vistaVisible.nombre}</dd></div>
            <div><dt>Registros</dt><dd>{vistaVisible.total}</dd></div>
            <div><dt>Periodo</dt><dd>{vistaVisible.periodo}</dd></div>
            <div><dt>Fecha de generación</dt><dd>{fecha}</dd></div>
            <div className="full"><dt>Se incluirá</dt><dd>{vistaVisible.columnas.map((columna) => columna.header).join(', ') || 'Sin columnas'}</dd></div>
            <div className="full"><dt>Filtros</dt><dd>{vistaVisible.filtros.length ? vistaVisible.filtros.join(' · ') : 'Sin filtros adicionales'}</dd></div>
          </dl>
          {vistaVisible.advertencia ? <p className="hint">{vistaVisible.advertencia}</p> : null}
          <p className="hint">{vistaVisible.notaFuente}</p>
          {vistaVisible.avisoPrivacidad ? <p className="hint">{vistaVisible.avisoPrivacidad}</p> : null}
          <div className="informe-table-wrap">
            <table className="data">
              <thead>
                <tr>{vistaVisible.columnas.map((columna) => <th key={columna.key}>{columna.header}</th>)}</tr>
              </thead>
              <tbody>
                {vistaVisible.muestra.length ? vistaVisible.muestra.map((fila, index) => (
                  <tr key={`${vistaVisible.id}-${index}`}>
                    {vistaVisible.columnas.map((columna) => <td key={columna.key}>{String(fila[columna.key] ?? '')}</td>)}
                  </tr>
                )) : <tr><td colSpan={Math.max(vistaVisible.columnas.length, 1)}>No hay registros con esos filtros.</td></tr>}
              </tbody>
            </table>
          </div>
          {vistaVisible.total > vistaVisible.muestra.length ? <p className="hint no-print">La vista muestra {vistaVisible.muestra.length} de {vistaVisible.total}. El archivo incluye todos.</p> : null}
          {vistaVisible.totales.length || vistaVisible.resumen.length ? (
            <ul className="informe-totals">
              {[...vistaVisible.totales, ...vistaVisible.resumen].map((item) => <li key={item.etiqueta}><span>{item.etiqueta}</span><strong>{item.valor}</strong></li>)}
            </ul>
          ) : null}
          <div className="row-actions no-print">
            <Button type="button" onClick={() => { void descargar('xlsx') }} disabled={ocupado !== null}><FileSpreadsheet size={18} /> Descargar Excel</Button>
            <Button type="button" variant="secondary" onClick={() => { void descargar('csv') }} disabled={ocupado !== null}><Download size={18} /> Descargar CSV</Button>
            <Button type="button" variant="secondary" onClick={() => { void descargar('pdf') }} disabled={ocupado !== null}><Download size={18} /> Descargar PDF</Button>
            <Button type="button" variant="secondary" onClick={() => { void descargar('docx') }} disabled={ocupado !== null}><Download size={18} /> Descargar Word</Button>
            <Button type="button" variant="secondary" onClick={() => window.print()} disabled={ocupado !== null}><Printer size={18} /> Imprimir</Button>
          </div>
        </article>
      ) : null}
    </section>
  )
}
