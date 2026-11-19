import { useState } from 'react'
import { Eye, FileUp, Pencil, Plus } from 'lucide-react'
import { nombreTurno } from '@shared/academico'
import { leerCsvMaestros } from '@shared/csv-catalogo'
import type { MaestroCarga } from '@shared/csv-catalogo'
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
  const [carga, setCarga] = useState<{ filas: MaestroCarga[]; errores: { linea: number; message: string }[] } | null>(null)
  const [avisoCarga, setAvisoCarga] = useState('')
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

  const leerArchivo = async (archivo: File | undefined) => {
    if (!archivo) return
    const texto = await archivo.text()
    const resultado = leerCsvMaestros(texto, () => nuevoId('mae'))
    resultado.filas.forEach((fila) => {
      const previo = data.maestros.find((maestro) => maestro.numeroEmpleado.toUpperCase() === fila.numeroEmpleado)
      if (previo) fila.id = previo.id
    })
    setCarga(resultado)
    setAvisoCarga('')
  }

  const confirmarCarga = async () => {
    if (!carga) return
    const resultado = await guardar({
      tipo: 'maestros.carga',
      datos: { filas: carga.filas },
      accion: `Cargó ${carga.filas.length} maestros desde un archivo.`,
      ids: carga.filas.map((fila) => fila.id),
      aplicar: (draft) => {
        for (const fila of carga.filas) {
          const record: Maestro = { ...fila, materias: draft.maestros.find((maestro) => maestro.id === fila.id)?.materias ?? [] }
          const index = draft.maestros.findIndex((maestro) => maestro.numeroEmpleado.toUpperCase() === fila.numeroEmpleado || maestro.id === fila.id)
          if (index >= 0) draft.maestros[index] = record
          else draft.maestros.unshift(record)
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
    const csv = 'numeroEmpleado,nombre,correo,turno,estado\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = 'maestros.csv'
    enlace.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="page">
      <PageHeader
        title="Maestros"
        description="Número de empleado, contacto, materias que imparten y turno en el que trabajan."
        actions={(
          <>
            <Button type="button" variant="secondary" onClick={() => { setAvisoCarga(''); setCarga({ filas: [], errores: [] }) }}><FileUp size={18} /> Cargar CSV</Button>
            <Button type="button" onClick={() => abrir('crear')}><Plus size={18} /> Agregar maestro</Button>
          </>
        )}
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
      {carga ? (
        <Modal
          title="Cargar maestros"
          onClose={() => setCarga(null)}
          footer={(
            <>
              <Button type="button" variant="secondary" onClick={() => setCarga(null)}>Cancelar</Button>
              <Button type="button" onClick={() => { void confirmarCarga() }} disabled={!carga.filas.length}>Guardar {carga.filas.length || ''}</Button>
            </>
          )}
        >
          <div className="stack">
            <p className="hint">En Excel elige Guardar como CSV. La primera fila lleva numeroEmpleado, nombre, correo, turno y estado. El número va como EMP-0000. Si ya existe, se actualiza.</p>
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
            {carga.filas.length ? <p>{carga.filas.length} maestros listos. {carga.filas.filter((fila) => data.maestros.some((maestro) => maestro.numeroEmpleado.toUpperCase() === fila.numeroEmpleado)).length} ya estaban registrados y se van a actualizar.</p> : null}
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
