import { useState } from 'react'
import { FileUp, Pencil, Plus } from 'lucide-react'
import { GRUPOS, SEMESTRES, etiquetaGrupo, nombreTurno } from '@shared/academico'
import { leerCsvMaterias } from '@shared/csv-catalogo'
import type { MateriaCarga } from '@shared/csv-catalogo'
import type { Materia, TurnoId } from '@shared/types'
import { DataTable } from '../../components/DataTable'
import { Button, Field, FormNote, LocalBadge, Modal, PageHeader } from '../../components/ui'
import { incluye } from '../../format'
import { mapaErrores, nuevoId } from '../../forms'
import { useApp, useData } from '../../state'

const VACIO = { clave: '', nombre: '', semestre: '1', grupo: 'A', turnoId: 'matutino' as TurnoId, maestroId: '' }

function sincronizarMaterias(maestros: { id: string; materias: string[] }[], materias: Materia[]) {
  for (const maestro of maestros) {
    maestro.materias = materias
      .filter((materia) => materia.maestroId === maestro.id)
      .map((materia) => `${materia.nombre} · ${etiquetaGrupo(materia.semestre, materia.grupo)}`)
  }
}

export function MateriasPage() {
  const data = useData()
  const { guardar, esCambioLocal } = useApp()
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [actual, setActual] = useState<Materia | null>(null)
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [carga, setCarga] = useState<{ filas: MateriaCarga[]; errores: { linea: number; message: string }[] } | null>(null)
  const [avisoCarga, setAvisoCarga] = useState('')

  const filas = data.materias.filter((materia) => {
    const maestro = data.maestros.find((item) => item.id === materia.maestroId)?.nombre ?? ''
    return incluye(`${materia.clave} ${materia.nombre} ${materia.semestre} ${materia.grupo} ${nombreTurno(materia.turnoId)} ${maestro}`, busqueda)
  })
  const maestrosDelTurno = data.maestros.filter((maestro) => maestro.turnoId === form.turnoId)

  const abrir = (materia?: Materia) => {
    setActual(materia ?? null)
    setErrores({})
    const turnoId = materia?.turnoId ?? 'matutino'
    const disponibles = data.maestros.filter((maestro) => maestro.turnoId === turnoId)
    setForm(materia ? {
      clave: materia.clave,
      nombre: materia.nombre,
      semestre: String(materia.semestre),
      grupo: materia.grupo,
      turnoId: materia.turnoId,
      maestroId: materia.maestroId,
    } : { ...VACIO, maestroId: disponibles[0]?.id ?? '' })
    setAbierto(true)
  }

  const cambiarTurno = (turnoId: TurnoId) => {
    const maestro = data.maestros.find((item) => item.id === form.maestroId)
    setForm({
      ...form,
      turnoId,
      maestroId: maestro?.turnoId === turnoId ? form.maestroId : '',
    })
  }

  const guardarMateria = async () => {
    const id = actual?.id ?? nuevoId('mat')
    const resultado = await guardar({
      tipo: 'materia',
      datos: { ...form, id: actual?.id },
      accion: actual ? `Actualizó la materia ${form.nombre}.` : `Preparó la materia ${form.nombre}.`,
      ids: [id],
      aplicar: (draft) => {
        const record: Materia = {
          id,
          clave: form.clave.trim().toUpperCase(),
          nombre: form.nombre.trim(),
          semestre: Number(form.semestre),
          grupo: form.grupo.trim().toUpperCase(),
          turnoId: form.turnoId,
          maestroId: form.maestroId,
        }
        const index = draft.materias.findIndex((materia) => materia.id === id)
        if (index >= 0) draft.materias[index] = record
        else draft.materias.unshift(record)
        sincronizarMaterias(draft.maestros, draft.materias)
      },
    })
    if (!resultado.ok) {
      setErrores(mapaErrores(resultado.errors))
      return
    }
    setAbierto(false)
  }

  const leerArchivo = async (archivo: File | undefined) => {
    if (!archivo) return
    const texto = await archivo.text()
    const resultado = leerCsvMaterias(texto, data.maestros, () => nuevoId('mat'))
    resultado.filas.forEach((fila) => {
      const previo = data.materias.find((materia) => materia.clave === fila.clave && materia.semestre === fila.semestre && materia.grupo === fila.grupo && materia.turnoId === fila.turnoId)
      if (previo) fila.id = previo.id
    })
    setCarga(resultado)
    setAvisoCarga('')
  }

  const confirmarCarga = async () => {
    if (!carga) return
    const resultado = await guardar({
      tipo: 'materias.carga',
      datos: { filas: carga.filas },
      accion: `Cargó ${carga.filas.length} materias desde un archivo.`,
      ids: carga.filas.map((fila) => fila.id),
      aplicar: (draft) => {
        for (const fila of carga.filas) {
          const record: Materia = { id: fila.id, clave: fila.clave, nombre: fila.nombre, semestre: fila.semestre, grupo: fila.grupo, turnoId: fila.turnoId, maestroId: fila.maestroId }
          const index = draft.materias.findIndex((materia) => materia.clave === fila.clave && materia.semestre === fila.semestre && materia.grupo === fila.grupo && materia.turnoId === fila.turnoId)
          if (index >= 0) draft.materias[index] = record
          else draft.materias.unshift(record)
        }
        sincronizarMaterias(draft.maestros, draft.materias)
      },
    })
    if (!resultado.ok) {
      setAvisoCarga(resultado.message)
      return
    }
    setCarga(null)
  }

  const descargarPlantilla = () => {
    const csv = 'clave,nombre,semestre,grupo,turno,maestro\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = 'materias.csv'
    enlace.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="page">
      <PageHeader
        title="Materias y grupos"
        description="Cada fila es una materia asignada a un semestre, un grupo, un turno y un maestro. La misma materia puede repetirse en otros grupos."
        actions={(
          <>
            <Button type="button" variant="secondary" onClick={() => { setAvisoCarga(''); setCarga({ filas: [], errores: [] }) }}><FileUp size={18} /> Cargar CSV</Button>
            <Button type="button" onClick={() => abrir()}><Plus size={18} /> Agregar materia</Button>
          </>
        )}
      />
      <div className="filters">
        <Field label="Buscar">
          <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Materia, clave, grupo o maestro" />
        </Field>
      </div>
      <article className="panel">
        <DataTable
          rows={filas}
          getId={(row) => row.id}
          caption="Materias y grupos"
          empty="Ninguna materia coincide con la búsqueda."
          resetKey={busqueda}
          columns={[
            { id: 'clave', header: 'Clave', cell: (row) => row.clave },
            { id: 'nombre', header: 'Materia', primary: true, cell: (row) => <span className="name-cell">{row.nombre} <LocalBadge show={esCambioLocal(row.id)} /></span> },
            { id: 'semestre', header: 'Semestre', cell: (row) => `${row.semestre}°` },
            { id: 'grupo', header: 'Grupo', cell: (row) => row.grupo },
            { id: 'turno', header: 'Turno', cell: (row) => nombreTurno(row.turnoId) },
            { id: 'maestro', header: 'Maestro', cell: (row) => data.maestros.find((maestro) => maestro.id === row.maestroId)?.nombre ?? 'Sin asignar' },
            { id: 'acciones', header: 'Acciones', cell: (row) => <Button type="button" variant="secondary" onClick={() => abrir(row)}><Pencil size={16} /> Editar</Button> },
          ]}
        />
      </article>
      {abierto ? (
        <Modal
          title={actual ? 'Editar materia' : 'Agregar materia'}
          onClose={() => setAbierto(false)}
          footer={<><FormNote /><Button type="button" variant="secondary" onClick={() => setAbierto(false)}>Cancelar</Button><Button type="button" onClick={() => { void guardarMateria() }}>Guardar</Button></>}
        >
          <div className="form-grid">
            <Field label="Nombre" error={errores.nombre} className="full"><input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></Field>
            <Field label="Clave" error={errores.clave} hint="Ejemplo: INF-101"><input value={form.clave} onChange={(event) => setForm({ ...form, clave: event.target.value })} /></Field>
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
              <select value={form.turnoId} onChange={(event) => cambiarTurno(event.target.value as TurnoId)}>
                {data.turnos.map((turno) => <option key={turno.id} value={turno.id}>{turno.nombre.replace('Turno ', '')}</option>)}
              </select>
            </Field>
            <Field label="Maestro responsable" error={errores.maestroId} hint="Solo aparecen maestros de ese turno.">
              <select value={form.maestroId} onChange={(event) => setForm({ ...form, maestroId: event.target.value })}>
                <option value="">Selecciona</option>
                {maestrosDelTurno.map((maestro) => <option key={maestro.id} value={maestro.id}>{maestro.nombre}</option>)}
              </select>
            </Field>
          </div>
        </Modal>
      ) : null}
      {carga ? (
        <Modal
          title="Cargar materias y grupos"
          onClose={() => setCarga(null)}
          footer={(
            <>
              <Button type="button" variant="secondary" onClick={() => setCarga(null)}>Cancelar</Button>
              <Button type="button" onClick={() => { void confirmarCarga() }} disabled={!carga.filas.length}>Guardar {carga.filas.length || ''}</Button>
            </>
          )}
        >
          <div className="stack">
            <p className="hint">En Excel elige Guardar como CSV. La primera fila lleva clave, nombre, semestre, grupo, turno y maestro. En maestro escribe su número EMP-0000. Si esa materia ya está en el mismo grupo y turno, se actualiza.</p>
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
            {carga.filas.length ? <p>{carga.filas.length} materias listas.</p> : null}
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
