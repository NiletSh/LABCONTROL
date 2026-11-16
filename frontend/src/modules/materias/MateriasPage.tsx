import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { GRUPOS, SEMESTRES, etiquetaGrupo, nombreTurno } from '@shared/academico'
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

  return (
    <section className="page">
      <PageHeader
        title="Materias y grupos"
        description="Cada fila es una materia asignada a un semestre, un grupo, un turno y un maestro. La misma materia puede repetirse en otros grupos."
        actions={<Button type="button" onClick={() => abrir()}><Plus size={18} /> Agregar materia</Button>}
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
    </section>
  )
}
