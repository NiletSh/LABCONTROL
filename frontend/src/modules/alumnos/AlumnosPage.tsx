import { useState } from 'react'
import { Eye, FileUp, Pencil, Plus } from 'lucide-react'
import { leerCsvAlumnos } from '@shared/csv-alumnos'
import type { AlumnoCarga } from '@shared/csv-alumnos'
import { GRUPOS, SEMESTRES, nombreTurno } from '@shared/academico'
import type { Alumno, EstadoAlumno, TurnoId } from '@shared/types'
import { DataTable } from '../../components/DataTable'
import { Button, Field, FormNote, LocalBadge, Modal, PageHeader } from '../../components/ui'
import { incluye } from '../../format'
import { mapaErrores, nuevoId } from '../../forms'
import { AlumnoEstado } from '../../labels'
import { useApp, useData } from '../../state'

const VACIO = { matricula: '', nombre: '', plantel: '', semestre: '1', grupo: 'A', turnoId: 'matutino' as TurnoId, estado: 'activo' as EstadoAlumno }

export function AlumnosPage() {
  const data = useData()
  const { puede, guardar, esCambioLocal } = useApp()
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('todos')
  const [modo, setModo] = useState<'crear' | 'editar' | 'ver' | null>(null)
  const [actual, setActual] = useState<Alumno | null>(null)
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [carga, setCarga] = useState<{ filas: AlumnoCarga[]; errores: { linea: number; message: string }[] } | null>(null)
  const [avisoCarga, setAvisoCarga] = useState('')
  const editar = puede('alumnos.editar')

  const filas = data.alumnos.filter((alumno) => {
    const texto = `${alumno.matricula} ${alumno.nombre} ${alumno.plantel ?? ''} ${alumno.semestre} ${alumno.grupo} ${nombreTurno(alumno.turnoId)}`
    return (estado === 'todos' || alumno.estado === estado) && incluye(texto, busqueda)
  })

  const abrir = (next: 'crear' | 'editar' | 'ver', alumno?: Alumno) => {
    setModo(next)
    setActual(alumno ?? null)
    setErrores({})
    setForm(alumno ? {
      matricula: alumno.matricula,
      nombre: alumno.nombre,
      plantel: alumno.plantel ?? '',
      semestre: String(alumno.semestre),
      grupo: alumno.grupo,
      turnoId: alumno.turnoId,
      estado: alumno.estado,
    } : VACIO)
  }

  const guardarAlumno = async () => {
    const id = actual?.id ?? nuevoId('alu')
    const datos = { ...form, id: actual?.id }
    const resultado = await guardar({
      tipo: 'alumno',
      datos,
      accion: actual ? `Actualizó los datos de ${form.nombre}.` : `Preparó el alta de ${form.nombre}.`,
      ids: [id],
      aplicar: (draft) => {
        const record: Alumno = {
          id,
          matricula: form.matricula.trim(),
          nombre: form.nombre.trim(),
          plantel: form.plantel.trim() || undefined,
          semestre: Number(form.semestre),
          grupo: form.grupo.trim().toUpperCase(),
          turnoId: form.turnoId,
          estado: form.estado,
        }
        const index = draft.alumnos.findIndex((alumno) => alumno.id === id)
        if (index >= 0) draft.alumnos[index] = record
        else draft.alumnos.unshift(record)
      },
    })
    if (!resultado.ok) {
      setErrores(mapaErrores(resultado.errors))
      return
    }
    setModo(null)
  }

  const leerArchivo = async (archivo: File | undefined) => {
    setAvisoCarga('')
    if (!archivo) return
    const texto = await archivo.text()
    const hoy = new Date()
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    const leido = leerCsvAlumnos(texto, fecha, () => nuevoId('alu'))
    const filas = leido.filas.map((fila) => {
      const previo = data.alumnos.find((alumno) => alumno.matricula.toUpperCase() === fila.matricula)
      return previo ? { ...fila, id: previo.id } : fila
    })
    setCarga({ filas, errores: leido.errores })
  }

  const confirmarCarga = async () => {
    if (!carga?.filas.length) return
    const resultado = await guardar({
      tipo: 'alumnos.carga',
      datos: { filas: carga.filas },
      accion: `Cargó ${carga.filas.length} alumnos desde un archivo.`,
      ids: carga.filas.map((fila) => fila.id),
      aplicar: (draft) => {
        for (const fila of carga.filas) {
          const record: Alumno = {
            id: fila.id,
            matricula: fila.matricula,
            nombre: fila.nombre,
            plantel: fila.plantel || undefined,
            semestre: fila.semestre,
            grupo: fila.grupo,
            turnoId: fila.turnoId,
            estado: fila.estado,
          }
          const previo = draft.alumnos.findIndex((alumno) => alumno.matricula.toUpperCase() === fila.matricula || alumno.id === fila.id)
          if (previo >= 0) draft.alumnos[previo] = record
          else draft.alumnos.unshift(record)
        }
      },
    })
    if (!resultado.ok) {
      setAvisoCarga(resultado.message)
      return
    }
    setCarga(null)
  }

  const descargarPlantilla = () => {
    const csv = 'matricula,nombre,plantel,semestre,grupo,turno,estado\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = 'alumnos.csv'
    enlace.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="page">
      <PageHeader
        title="Alumnos"
        description="Consulta la matrícula, el semestre, el grupo y el turno. El alta y la edición quedan reservadas al administrador."
        actions={editar ? (
          <>
            <Button type="button" variant="secondary" onClick={() => { setAvisoCarga(''); setCarga({ filas: [], errores: [] }) }}><FileUp size={18} /> Cargar CSV</Button>
            <Button type="button" onClick={() => abrir('crear')}><Plus size={18} /> Agregar alumno</Button>
          </>
        ) : null}
      />
      <div className="filters">
        <Field label="Buscar">
          <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Nombre, matrícula o grupo" />
        </Field>
        <Field label="Estado">
          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
          </select>
        </Field>
      </div>
      <article className="panel">
        <DataTable
          rows={filas}
          getId={(row) => row.id}
          caption="Alumnos registrados"
          empty="Ningún alumno coincide con la búsqueda."
          resetKey={`${busqueda}|${estado}`}
          columns={[
            { id: 'matricula', header: 'Matrícula', cell: (row) => row.matricula },
            { id: 'nombre', header: 'Nombre', primary: true, cell: (row) => <span className="name-cell">{row.nombre} <LocalBadge show={esCambioLocal(row.id)} /></span> },
            { id: 'semestre', header: 'Semestre', cell: (row) => `${row.semestre}°` },
            { id: 'grupo', header: 'Grupo', cell: (row) => row.grupo },
            { id: 'turno', header: 'Turno', cell: (row) => nombreTurno(row.turnoId) },
            { id: 'estado', header: 'Estado', cell: (row) => <AlumnoEstado estado={row.estado} /> },
            {
              id: 'acciones',
              header: 'Acciones',
              hideOnMobile: false,
              cell: (row) => (
                <div className="row-actions">
                  <Button type="button" variant="secondary" onClick={() => abrir('ver', row)}><Eye size={16} /> Ver</Button>
                  {editar ? <Button type="button" variant="secondary" onClick={() => abrir('editar', row)}><Pencil size={16} /> Editar</Button> : null}
                </div>
              ),
            },
          ]}
        />
      </article>
      {modo === 'ver' && actual ? (
        <Modal title="Alumno" onClose={() => setModo(null)} footer={<Button type="button" variant="secondary" onClick={() => setModo(null)}>Cerrar</Button>}>
          <dl className="dl-grid">
            <div><dt>Matrícula</dt><dd>{actual.matricula}</dd></div>
            <div><dt>Nombre</dt><dd>{actual.nombre}</dd></div>
            {actual.plantel ? <div><dt>Plantel</dt><dd>{actual.plantel}</dd></div> : null}
            <div><dt>Semestre</dt><dd>{actual.semestre}°</dd></div>
            <div><dt>Grupo</dt><dd>{actual.grupo}</dd></div>
            <div><dt>Turno</dt><dd>{nombreTurno(actual.turnoId)}</dd></div>
            <div><dt>Estado</dt><dd><AlumnoEstado estado={actual.estado} /></dd></div>
          </dl>
        </Modal>
      ) : null}
      {(modo === 'crear' || modo === 'editar') ? (
        <Modal
          title={modo === 'crear' ? 'Agregar alumno' : 'Editar alumno'}
          onClose={() => setModo(null)}
          footer={<><FormNote /><Button type="button" variant="secondary" onClick={() => setModo(null)}>Cancelar</Button><Button type="button" onClick={() => { void guardarAlumno() }}>Guardar</Button></>}
        >
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); void guardarAlumno() }}>
            <Field label="Matrícula" error={errores.matricula}><input value={form.matricula} onChange={(event) => setForm({ ...form, matricula: event.target.value })} inputMode="numeric" /></Field>
            <Field label="Nombre completo" error={errores.nombre}><input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></Field>
            <Field label="Plantel"><input value={form.plantel} onChange={(event) => setForm({ ...form, plantel: event.target.value })} /></Field>
            <Field label="Semestre" error={errores.semestre}>
              <select value={form.semestre} onChange={(event) => setForm({ ...form, semestre: event.target.value })}>
                {SEMESTRES.map((semestre) => <option key={semestre} value={semestre}>{semestre}°</option>)}
              </select>
            </Field>
            <Field label="Grupo" error={errores.grupo}>
              <select value={form.grupo} onChange={(event) => setForm({ ...form, grupo: event.target.value })}>
                {GRUPOS.map((grupo) => <option key={grupo} value={grupo}>{grupo}</option>)}
              </select>
            </Field>
            <Field label="Turno" error={errores.turnoId}>
              <select value={form.turnoId} onChange={(event) => setForm({ ...form, turnoId: event.target.value as TurnoId })}>
                {data.turnos.map((turno) => <option key={turno.id} value={turno.id}>{turno.nombre.replace('Turno ', '')}</option>)}
              </select>
            </Field>
            <Field label="Estado" error={errores.estado}>
              <select value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value as EstadoAlumno })}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </Field>
          </form>
        </Modal>
      ) : null}
      {carga ? (
        <Modal
          title="Cargar alumnos"
          onClose={() => setCarga(null)}
          footer={(
            <>
              <Button type="button" variant="secondary" onClick={() => setCarga(null)}>Cancelar</Button>
              <Button type="button" onClick={() => { void confirmarCarga() }} disabled={!carga.filas.length}>Guardar {carga.filas.length || ''}</Button>
            </>
          )}
        >
          <div className="stack">
            <p className="hint">En Excel elige Guardar como CSV. La primera fila lleva matrícula, nombre, plantel, semestre, grupo, turno y estado. Si el semestre va vacío, se calcula con el año del número de control. Una matrícula que ya existe se actualiza.</p>
            <div className="row-actions">
              <Button type="button" variant="secondary" onClick={descargarPlantilla}>Descargar plantilla</Button>
              <label className="btn btn-secondary">
                Elegir archivo
                <input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => { void leerArchivo(event.target.files?.[0]) }} />
              </label>
            </div>
            {avisoCarga ? <p className="hint">{avisoCarga}</p> : null}
            {carga.errores.length ? (
              <ul className="hint">
                {carga.errores.slice(0, 8).map((error) => <li key={`${error.linea}-${error.message}`}>Línea {error.linea}: {error.message}</li>)}
              </ul>
            ) : null}
            {carga.filas.length ? <p>{carga.filas.length} alumnos listos. {carga.filas.filter((fila) => data.alumnos.some((alumno) => alumno.matricula.toUpperCase() === fila.matricula)).length} ya estaban registrados y se van a actualizar.</p> : null}
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
