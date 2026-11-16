import { useState } from 'react'
import { Eye, Pencil, Plus } from 'lucide-react'
import { nombreTurno } from '@shared/academico'
import type { EstadoPersona, Maestro, TurnoId } from '@shared/types'
import { Button, Field, FormNote, FotoPerfil, LocalBadge, Modal, PageHeader } from '../../components/ui'
import { incluye } from '../../format'
import { mapaErrores, nuevoId } from '../../forms'
import { PersonaEstado } from '../../labels'
import { useApp, useData } from '../../state'

const VACIO = { numeroEmpleado: 'EMP-', nombre: '', correo: '', turnoId: 'matutino' as TurnoId, estado: 'activo' as EstadoPersona }

export function MaestrosPage() {
  const data = useData()
  const { guardar, esCambioLocal } = useApp()
  const [busqueda, setBusqueda] = useState('')
  const [modo, setModo] = useState<'crear' | 'editar' | 'ver' | null>(null)
  const [actual, setActual] = useState<Maestro | null>(null)
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const filas = data.maestros.filter((maestro) => incluye(`${maestro.numeroEmpleado} ${maestro.nombre} ${maestro.correo} ${maestro.materias.join(' ')}`, busqueda))

  const abrir = (next: 'crear' | 'editar' | 'ver', maestro?: Maestro) => {
    setModo(next)
    setActual(maestro ?? null)
    setErrores({})
    setForm(maestro ? {
      numeroEmpleado: maestro.numeroEmpleado,
      nombre: maestro.nombre,
      correo: maestro.correo,
      turnoId: maestro.turnoId,
      estado: maestro.estado,
    } : VACIO)
  }

  const guardarMaestro = async () => {
    const id = actual?.id ?? nuevoId('mae')
    const resultado = await guardar({
      tipo: 'maestro',
      datos: { ...form, id: actual?.id },
      accion: actual ? `Actualizó al maestro ${form.nombre}.` : `Preparó el alta del maestro ${form.nombre}.`,
      ids: [id],
      aplicar: (draft) => {
        const previo = draft.maestros.find((maestro) => maestro.id === id)
        const record: Maestro = {
          id,
          numeroEmpleado: form.numeroEmpleado.trim().toUpperCase(),
          nombre: form.nombre.trim(),
          correo: form.correo.trim().toLowerCase(),
          turnoId: form.turnoId,
          estado: form.estado,
          materias: previo?.materias ?? [],
        }
        const index = draft.maestros.findIndex((maestro) => maestro.id === id)
        if (index >= 0) draft.maestros[index] = record
        else draft.maestros.unshift(record)
      },
    })
    if (!resultado.ok) {
      setErrores(mapaErrores(resultado.errors))
      return
    }
    setModo(null)
  }

  return (
    <section className="page">
      <PageHeader
        title="Maestros"
        description="Número de empleado, contacto, materias que imparten y turno en el que trabajan."
        actions={<Button type="button" onClick={() => abrir('crear')}><Plus size={18} /> Agregar maestro</Button>}
      />
      <div className="filters">
        <Field label="Buscar">
          <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Nombre, correo o materia" />
        </Field>
      </div>
      {filas.length ? (
        <div className="people-grid">
          {filas.map((maestro) => (
            <article className="panel person-card" key={maestro.id}>
              <div className="person-top">
                <FotoPerfil nombre={maestro.nombre} />
                <div>
                  <strong>{maestro.nombre}</strong>
                  <span>{maestro.numeroEmpleado}</span>
                </div>
              </div>
              <div className="person-badges">
                <PersonaEstado estado={maestro.estado} />
                <LocalBadge show={esCambioLocal(maestro.id)} />
              </div>
              <dl className="person-facts">
                <div><dt>Correo</dt><dd>{maestro.correo}</dd></div>
                <div><dt>Turno</dt><dd>{nombreTurno(maestro.turnoId)}</dd></div>
                <div><dt>Materias</dt><dd>{maestro.materias.length ? maestro.materias.join(', ') : 'Sin materias asignadas'}</dd></div>
              </dl>
              <div className="row-actions">
                <Button type="button" variant="secondary" onClick={() => abrir('ver', maestro)}><Eye size={16} /> Ver</Button>
                <Button type="button" variant="secondary" onClick={() => abrir('editar', maestro)}><Pencil size={16} /> Editar</Button>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="people-empty">Ningún maestro coincide con la búsqueda.</p>}
      {modo === 'ver' && actual ? (
        <Modal title="Maestro" onClose={() => setModo(null)} footer={<Button type="button" variant="secondary" onClick={() => setModo(null)}>Cerrar</Button>}>
          <FotoPerfil nombre={actual.nombre} />
          <dl className="dl-grid">
            <div><dt>No. empleado</dt><dd>{actual.numeroEmpleado}</dd></div>
            <div><dt>Nombre</dt><dd>{actual.nombre}</dd></div>
            <div><dt>Correo</dt><dd>{actual.correo}</dd></div>
            <div><dt>Turno</dt><dd>{nombreTurno(actual.turnoId)}</dd></div>
            <div><dt>Estado</dt><dd><PersonaEstado estado={actual.estado} /></dd></div>
            <div className="full"><dt>Materias</dt><dd>{actual.materias.length ? actual.materias.join(', ') : 'Sin materias asignadas'}</dd></div>
          </dl>
        </Modal>
      ) : null}
      {(modo === 'crear' || modo === 'editar') ? (
        <Modal
          title={modo === 'crear' ? 'Agregar maestro' : 'Editar maestro'}
          onClose={() => setModo(null)}
          footer={<><FormNote /><Button type="button" variant="secondary" onClick={() => setModo(null)}>Cancelar</Button><Button type="button" onClick={() => { void guardarMaestro() }}>Guardar</Button></>}
        >
          <div className="form-grid">
            <Field label="Número de empleado" error={errores.numeroEmpleado} hint="Formato EMP-0000">
              <input value={form.numeroEmpleado} onChange={(event) => setForm({ ...form, numeroEmpleado: event.target.value })} />
            </Field>
            <Field label="Nombre completo" error={errores.nombre}><input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></Field>
            <Field label="Correo electrónico" error={errores.correo} className="full"><input type="email" value={form.correo} onChange={(event) => setForm({ ...form, correo: event.target.value })} /></Field>
            <Field label="Turno" error={errores.turnoId}>
              <select value={form.turnoId} onChange={(event) => setForm({ ...form, turnoId: event.target.value as TurnoId })}>
                {data.turnos.map((turno) => <option key={turno.id} value={turno.id}>{turno.nombre.replace('Turno ', '')}</option>)}
              </select>
            </Field>
            <Field label="Estado" error={errores.estado}>
              <select value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value as EstadoPersona })}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </Field>
          </div>
          <p className="hint">Las materias se asignan en el módulo Materias y grupos.</p>
        </Modal>
      ) : null}
    </section>
  )
}
