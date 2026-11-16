import { useState } from 'react'
import { Plus } from 'lucide-react'
import { etiquetaGrupo, nombreTurno } from '@shared/academico'
import type { Reservacion } from '@shared/types'
import { DataTable } from '../../components/DataTable'
import { Button, Field, FormNote, LabPicker, LocalBadge, Modal, PageHeader } from '../../components/ui'
import { fechaCorta } from '../../format'
import { mapaErrores, nuevoId } from '../../forms'
import { ReservaEstado } from '../../labels'
import { useApp, useData } from '../../state'

const BASE = { laboratorioId: 'lab-1', maestroId: '', materiaId: '', grupo: '', fecha: '', horaInicio: '16:00', horaFin: '17:00' }

export function ReservacionesPage() {
  const data = useData()
  const { guardar, esCambioLocal } = useApp()
  const [estado, setEstado] = useState('todos')
  const [abierto, setAbierto] = useState(false)
  const [rechazo, setRechazo] = useState<Reservacion | null>(null)
  const [motivo, setMotivo] = useState('')
  const [form, setForm] = useState({ ...BASE, fecha: data.meta.escenarioFecha })
  const [errores, setErrores] = useState<Record<string, string>>({})

  const filas = data.reservaciones.filter((item) => estado === 'todos' || item.estado === estado)
    .sort((a, b) => `${a.fecha}${a.horaInicio}`.localeCompare(`${b.fecha}${b.horaInicio}`))

  const crear = async () => {
    const id = nuevoId('res')
    const resultado = await guardar({
      tipo: 'reservacion',
      datos: form,
      accion: `Preparó una reservación para el ${form.fecha}.`,
      ids: [id],
      aplicar: (draft) => {
        draft.reservaciones.unshift({
          id,
          laboratorioId: form.laboratorioId,
          maestroId: form.maestroId,
          materiaId: form.materiaId,
          grupo: form.grupo.trim(),
          fecha: form.fecha,
          horaInicio: form.horaInicio,
          horaFin: form.horaFin,
          estado: 'pendiente',
        })
      },
    })
    if (!resultado.ok) {
      setErrores(mapaErrores(resultado.errors))
      return
    }
    setAbierto(false)
  }

  const resolver = async (reserva: Reservacion, next: 'aceptada' | 'rechazada', razon = '') => {
    const resultado = await guardar({
      tipo: 'reservacion.estado',
      datos: { id: reserva.id, estado: next, motivo: razon },
      accion: next === 'aceptada' ? `Aceptó la reservación del ${reserva.fecha}.` : `Rechazó la reservación del ${reserva.fecha}.`,
      ids: [reserva.id],
      aplicar: (draft) => {
        const item = draft.reservaciones.find((row) => row.id === reserva.id)
        if (!item) return
        item.estado = next
        if (razon.trim()) item.motivo = razon.trim()
      },
    })
    if (resultado.ok) setRechazo(null)
  }

  const elegirMateria = (materiaId: string) => {
    const materia = data.materias.find((item) => item.id === materiaId)
    setForm((current) => ({
      ...current,
      materiaId,
      grupo: materia?.grupo ?? current.grupo,
      maestroId: materia?.maestroId ?? current.maestroId,
    }))
  }

  return (
    <section className="page">
      <PageHeader
        title="Reservaciones"
        description="Consulta la disponibilidad y resuelve solicitudes. Un horario ocupado por una sesión o por otra reservación no se acepta."
        actions={<Button type="button" onClick={() => { setErrores({}); setAbierto(true) }}><Plus size={18} /> Solicitar reservación</Button>}
      />
      <div className="filters">
        <Field label="Estado">
          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="todos">Todas</option>
            <option value="pendiente">Pendientes</option>
            <option value="aceptada">Aceptadas</option>
            <option value="rechazada">Rechazadas</option>
          </select>
        </Field>
      </div>
      <article className="panel">
        <DataTable
          rows={filas}
          getId={(row) => row.id}
          caption="Reservaciones"
          empty="No hay reservaciones en esta vista."
          resetKey={estado}
          columns={[
            { id: 'fecha', header: 'Fecha', cell: (row) => fechaCorta(row.fecha) },
            { id: 'horario', header: 'Horario', cell: (row) => `${row.horaInicio}–${row.horaFin}` },
            { id: 'lab', header: 'Laboratorio', primary: true, cell: (row) => <span className="name-cell">{data.laboratorios.find((lab) => lab.id === row.laboratorioId)?.nombre} <LocalBadge show={esCambioLocal(row.id)} /></span> },
            { id: 'maestro', header: 'Maestro', cell: (row) => data.maestros.find((item) => item.id === row.maestroId)?.nombre },
            { id: 'materia', header: 'Materia', cell: (row) => data.materias.find((item) => item.id === row.materiaId)?.nombre },
            { id: 'grupo', header: 'Semestre y grupo', cell: (row) => {
              const materia = data.materias.find((item) => item.id === row.materiaId)
              return materia ? etiquetaGrupo(materia.semestre, materia.grupo) : row.grupo
            } },
            { id: 'estado', header: 'Estado', cell: (row) => <ReservaEstado estado={row.estado} /> },
            {
              id: 'acciones',
              header: 'Acciones',
              cell: (row) => row.estado === 'pendiente' ? (
                <div className="row-actions">
                  <Button type="button" onClick={() => { void resolver(row, 'aceptada') }}>Aceptar</Button>
                  <Button type="button" variant="danger" onClick={() => { setMotivo(''); setRechazo(row) }}>Rechazar</Button>
                </div>
              ) : <span className="hint">{row.motivo ?? 'Resuelta'}</span>,
            },
          ]}
        />
      </article>
      {abierto ? (
        <Modal title="Solicitar reservación" onClose={() => setAbierto(false)} footer={<><FormNote /><Button type="button" variant="secondary" onClick={() => setAbierto(false)}>Cancelar</Button><Button type="button" onClick={() => { void crear() }}>Guardar</Button></>}>
          <div className="stack">
            <Field label="Laboratorio" error={errores.laboratorioId}>
              <LabPicker value={form.laboratorioId} labs={data.laboratorios} onChange={(id) => setForm({ ...form, laboratorioId: id })} />
            </Field>
            <div className="form-grid">
              <Field label="Materia" error={errores.materiaId}>
                <select value={form.materiaId} onChange={(event) => elegirMateria(event.target.value)}>
                  <option value="">Selecciona</option>
                  {data.materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.nombre} · {etiquetaGrupo(materia.semestre, materia.grupo)} · {nombreTurno(materia.turnoId)}</option>)}
                </select>
              </Field>
              <Field label="Maestro" error={errores.maestroId}>
                <select value={form.maestroId} onChange={(event) => setForm({ ...form, maestroId: event.target.value })}>
                  <option value="">Selecciona</option>
                  {data.maestros.map((maestro) => <option key={maestro.id} value={maestro.id}>{maestro.nombre}</option>)}
                </select>
              </Field>
              <Field label="Grupo" error={errores.grupo} hint="Se toma de la materia registrada."><input value={form.grupo} readOnly placeholder="Elige una materia" /></Field>
              <Field label="Fecha" error={errores.fecha}><input type="date" value={form.fecha} onChange={(event) => setForm({ ...form, fecha: event.target.value })} /></Field>
              <Field label="Hora de inicio" error={errores.horaInicio}><input type="time" value={form.horaInicio} onChange={(event) => setForm({ ...form, horaInicio: event.target.value.slice(0, 5) })} /></Field>
              <Field label="Hora de fin" error={errores.horaFin}><input type="time" value={form.horaFin} onChange={(event) => setForm({ ...form, horaFin: event.target.value.slice(0, 5) })} /></Field>
            </div>
          </div>
        </Modal>
      ) : null}
      {rechazo ? (
        <Modal title="Rechazar reservación" onClose={() => setRechazo(null)} footer={<><Button type="button" variant="secondary" onClick={() => setRechazo(null)}>Cancelar</Button><Button type="button" variant="danger" onClick={() => { void resolver(rechazo, 'rechazada', motivo) }}>Rechazar</Button></>}>
          <Field label="Motivo" hint="Visible en la tabla para quien consulte la solicitud.">
            <textarea value={motivo} onChange={(event) => setMotivo(event.target.value)} />
          </Field>
        </Modal>
      ) : null}
    </section>
  )
}
