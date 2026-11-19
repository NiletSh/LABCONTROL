import { useState } from 'react'
import { relojMexico } from '@shared/reloj'
import { sesionEnCurso } from '@shared/schedule'
import type { EstadoLaboratorio, Laboratorio } from '@shared/types'
import { Button, Field, FormNote, Modal, PageHeader } from '../../components/ui'
import { mapaErrores } from '../../forms'
import { LabEstado, SesionEstado } from '../../labels'
import { useApp, useData } from '../../state'

export function LaboratoriosPage() {
  const data = useData()
  const { puede, guardar, esCambioLocal } = useApp()
  const editar = puede('laboratorios.editar')
  const [actual, setActual] = useState<Laboratorio | null>(null)
  const [form, setForm] = useState({ ubicacion: '', descripcion: '', capacidad: '30', estado: 'operativo' as EstadoLaboratorio })
  const [errores, setErrores] = useState<Record<string, string>>({})

  const abrir = (laboratorio: Laboratorio) => {
    setActual(laboratorio)
    setErrores({})
    setForm({
      ubicacion: laboratorio.ubicacion,
      descripcion: laboratorio.descripcion,
      capacidad: String(laboratorio.capacidad),
      estado: laboratorio.estado,
    })
  }

  const guardarLab = async () => {
    if (!actual) return
    const resultado = await guardar({
      tipo: 'laboratorio',
      datos: { ...form, id: actual.id, capacidad: Number(form.capacidad) },
      accion: `Actualizó la información de ${actual.nombre}.`,
      ids: [actual.id],
      aplicar: (draft) => {
        const laboratorio = draft.laboratorios.find((item) => item.id === actual.id)
        if (!laboratorio) return
        laboratorio.ubicacion = form.ubicacion.trim()
        laboratorio.descripcion = form.descripcion.trim()
        laboratorio.capacidad = Number(form.capacidad)
        laboratorio.estado = form.estado
      },
    })
    if (!resultado.ok) {
      setErrores(mapaErrores(resultado.errors))
      return
    }
    setActual(null)
  }

  return (
    <section className="page">
      <PageHeader title="Laboratorios" description="Dos aulas de cómputo. La cantidad de equipos se calcula con el inventario." />
      <div className="lab-grid">
        {data.laboratorios.map((laboratorio) => {
          const reloj = relojMexico()
          const sesion = data.sesiones.find((item) => item.laboratorioId === laboratorio.id && sesionEnCurso(item, reloj.fecha, reloj.hora))
          const materia = data.materias.find((item) => item.id === sesion?.materiaId)
          const pendientes = data.incidencias.filter((item) => item.laboratorioId === laboratorio.id && item.estado !== 'resuelta').length
          return (
            <article key={laboratorio.id} className="lab-card is-clickable" onClick={() => abrir(laboratorio)}>
              <div className="name-cell">
                <h2>{laboratorio.nombre}</h2>
                <LabEstado estado={laboratorio.estado} />
                {esCambioLocal(laboratorio.id) ? <span className="badge badge-warn">Sin guardar</span> : null}
              </div>
              <p className="ubicacion">{laboratorio.ubicacion}</p>
              <p>{laboratorio.descripcion}</p>
              <div className="metrics">
                <div><strong>{laboratorio.capacidad}</strong><span>Capacidad</span></div>
                <div><strong>{laboratorio.cantidadEquipos}</strong><span>Equipos</span></div>
                <div><strong>{pendientes}</strong><span>Incidencias abiertas</span></div>
              </div>
              {sesion ? <p>Sesión en curso: {materia?.nombre} · {sesion.semestre}° {sesion.grupo} · {sesion.horaInicio}–{sesion.horaFin} <SesionEstado estado="activa" /></p> : <p className="hint">Sin sesión en curso.</p>}
              {editar ? <Button type="button" variant="secondary" onClick={() => abrir(laboratorio)}>Editar información</Button> : null}
            </article>
          )
        })}
      </div>
      {actual ? (
        <Modal
          title={actual.nombre}
          onClose={() => setActual(null)}
          footer={editar ? <><FormNote /><Button type="button" variant="secondary" onClick={() => setActual(null)}>Cancelar</Button><Button type="button" onClick={() => { void guardarLab() }}>Guardar</Button></> : <Button type="button" variant="secondary" onClick={() => setActual(null)}>Cerrar</Button>}
        >
          <div className="form-grid">
            <Field label="Ubicación" error={errores.ubicacion} className="full"><input value={form.ubicacion} disabled={!editar} onChange={(event) => setForm({ ...form, ubicacion: event.target.value })} /></Field>
            <Field label="Descripción" error={errores.descripcion} className="full"><textarea value={form.descripcion} disabled={!editar} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></Field>
            <Field label="Capacidad" error={errores.capacidad}><input value={form.capacidad} disabled={!editar} onChange={(event) => setForm({ ...form, capacidad: event.target.value })} inputMode="numeric" /></Field>
            <Field label="Estado general" error={errores.estado}>
              <select value={form.estado} disabled={!editar} onChange={(event) => setForm({ ...form, estado: event.target.value as EstadoLaboratorio })}>
                <option value="operativo">Operativo</option>
                <option value="parcial">Parcial</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </Field>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
