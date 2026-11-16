import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { etiquetaGrupo } from '@shared/academico'
import type { EstadoSesion, Sesion, TurnoId } from '@shared/types'
import { diasDeSemana, inicioDeSemana, sumarDias, tituloMes } from '@shared/schedule'
import { Button, Field, FormNote, LabPicker, Modal, PageHeader, Segments } from '../../components/ui'
import { fechaCorta, fechaLarga } from '../../format'
import { mapaErrores, nuevoId } from '../../forms'
import { useApp, useData } from '../../state'
import { AgendaDia, Leyenda, PanelDetalle, VistaMes, VistaSemana } from './vistas'
import type { FiltroCalendario, Seleccion } from './vistas'

type Vista = 'dia' | 'semana' | 'mes'

interface FormSesion {
  fecha: string
  turnoId: TurnoId
  laboratorioId: string
  maestroId: string
  materiaId: string
  semestre: string
  grupo: string
  horaInicio: string
  horaFin: string
}

const FORM_BASE: FormSesion = {
  fecha: '',
  turnoId: 'matutino',
  laboratorioId: 'lab-1',
  maestroId: '',
  materiaId: '',
  semestre: '',
  grupo: '',
  horaInicio: '',
  horaFin: '',
}

function useEstrecho() {
  const [estrecho, setEstrecho] = useState(() => window.matchMedia('(max-width: 960px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)')
    const actualizar = () => setEstrecho(media.matches)
    media.addEventListener('change', actualizar)
    return () => media.removeEventListener('change', actualizar)
  }, [])
  return estrecho
}

export function SesionesPage() {
  const data = useData()
  const { guardar, esCambioLocal, puede } = useApp()
  const configuraTurnos = puede('usuarios')
  const estrecho = useEstrecho()
  const hoy = data.meta.escenarioFecha
  const [vista, setVista] = useState<Vista>('dia')
  const [fecha, setFecha] = useState(hoy)
  const [turnoId, setTurnoId] = useState<TurnoId>('matutino')
  const [filtro, setFiltro] = useState<FiltroCalendario>({
    laboratorioId: 'todos',
    maestroId: '',
    materiaId: '',
    semestre: '',
    grupo: '',
    estado: '',
  })
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState<FormSesion>({ ...FORM_BASE, fecha: hoy })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [horarios, setHorarios] = useState<Record<TurnoId, { horaInicio: string; horaFin: string }>>({
    matutino: { horaInicio: '', horaFin: '' },
    vespertino: { horaInicio: '', horaFin: '' },
  })
  const [errorTurno, setErrorTurno] = useState<{ id: TurnoId; field: string; message: string } | null>(null)

  useEffect(() => {
    setHorarios({
      matutino: {
        horaInicio: data.turnos.find((turno) => turno.id === 'matutino')?.horaInicio ?? '',
        horaFin: data.turnos.find((turno) => turno.id === 'matutino')?.horaFin ?? '',
      },
      vespertino: {
        horaInicio: data.turnos.find((turno) => turno.id === 'vespertino')?.horaInicio ?? '',
        horaFin: data.turnos.find((turno) => turno.id === 'vespertino')?.horaFin ?? '',
      },
    })
  }, [data.turnos])

  const turno = data.turnos.find((item) => item.id === turnoId) ?? data.turnos[0]
  const labs = data.laboratorios.filter((lab) => filtro.laboratorioId === 'todos' || lab.id === filtro.laboratorioId)
  const materias = data.materias.filter((materia) => materia.turnoId === form.turnoId)
  const grupos = [...new Set(data.materias.map((materia) => materia.grupo))].sort()
  const semana = diasDeSemana(fecha)
  const titulo = vista === 'mes'
    ? tituloMes(fecha)
    : vista === 'semana'
      ? `${fechaCorta(inicioDeSemana(fecha))} – ${fechaCorta(semana[6])}`
      : fechaLarga(fecha)

  const mover = (direccion: number) => {
    if (vista === 'mes') {
      const [year, month] = fecha.split('-').map(Number)
      const cursor = new Date(year, month - 1 + direccion, 1)
      const day = Math.min(Number(fecha.slice(8, 10)), new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate())
      const p = (value: number) => String(value).padStart(2, '0')
      setFecha(`${cursor.getFullYear()}-${p(cursor.getMonth() + 1)}-${p(day)}`)
      return
    }
    setFecha(sumarDias(fecha, vista === 'semana' ? direccion * 7 : direccion))
  }

  const abrirNueva = (extra?: Partial<FormSesion>) => {
    setErrores({})
    setForm({
      ...FORM_BASE,
      fecha,
      turnoId,
      laboratorioId: filtro.laboratorioId === 'todos' ? data.laboratorios[0]?.id ?? 'lab-1' : filtro.laboratorioId,
      ...extra,
    })
    setAbierto(true)
  }

  const elegirMateria = (materiaId: string) => {
    const materia = data.materias.find((item) => item.id === materiaId)
    setForm((current) => ({
      ...current,
      materiaId,
      semestre: materia ? String(materia.semestre) : '',
      grupo: materia?.grupo ?? '',
      maestroId: materia?.maestroId ?? '',
    }))
  }

  const crear = async () => {
    const id = nuevoId('ses')
    const resultado = await guardar({
      tipo: 'sesion',
      datos: form,
      accion: `Preparó una sesión para el ${form.fecha}.`,
      ids: [id],
      aplicar: (draft) => {
        draft.sesiones.unshift({
          id,
          laboratorioId: form.laboratorioId,
          maestroId: form.maestroId,
          materiaId: form.materiaId,
          semestre: Number(form.semestre),
          grupo: form.grupo.trim(),
          turnoId: form.turnoId,
          fecha: form.fecha,
          horaInicio: form.horaInicio,
          horaFin: form.horaFin,
          estado: 'programada',
        })
      },
    })
    if (!resultado.ok) {
      setErrores(mapaErrores(resultado.errors))
      return
    }
    setAbierto(false)
    setFecha(form.fecha)
    setTurnoId(form.turnoId)
    setSeleccion({ tipo: 'sesion', id })
  }

  const cambiarEstado = async (sesion: Sesion, estado: EstadoSesion) => {
    const materia = data.materias.find((item) => item.id === sesion.materiaId)?.nombre ?? 'sesión'
    const lab = data.laboratorios.find((item) => item.id === sesion.laboratorioId)?.nombre ?? 'laboratorio'
    const accion = estado === 'activa'
      ? `Inició la sesión de ${materia} en ${lab}.`
      : estado === 'cancelada'
        ? `Canceló la sesión de ${materia} en ${lab}.`
        : `Finalizó la sesión de ${materia} en ${lab}.`
    const resultado = await guardar({
      tipo: 'sesion.estado',
      datos: { id: sesion.id, estado },
      accion,
      ids: [sesion.id],
      aplicar: (draft) => {
        const item = draft.sesiones.find((row) => row.id === sesion.id)
        if (item) item.estado = estado
      },
    })
    if (!resultado.ok) return
  }

  const guardarTurno = async (id: TurnoId, configurado: boolean) => {
    const nombre = data.turnos.find((item) => item.id === id)?.nombre ?? 'turno'
    const horario = horarios[id]
    const resultado = await guardar({
      tipo: 'turno',
      datos: configurado
        ? { id, configurado: true, horaInicio: horario.horaInicio, horaFin: horario.horaFin }
        : { id, configurado: false },
      accion: configurado ? `Configuró el horario del ${nombre}.` : `Dejó sin horario el ${nombre}.`,
      ids: [id],
      aplicar: (draft) => {
        const item = draft.turnos.find((row) => row.id === id)
        if (!item) return
        item.configurado = configurado
        item.horaInicio = configurado ? horario.horaInicio : null
        item.horaFin = configurado ? horario.horaFin : null
        item.origen = 'sesion'
      },
    })
    if (!resultado.ok) {
      const primero = resultado.errors[0]
      setErrorTurno(primero ? { id, field: primero.field, message: primero.message } : null)
      return
    }
    setErrorTurno(null)
  }

  const detalle = (
    <PanelDetalle
      data={data}
      seleccion={seleccion}
      esLocal={seleccion?.tipo === 'sesion' ? esCambioLocal(seleccion.id) : false}
      onEstado={(sesion, estado) => { void cambiarEstado(sesion, estado) }}
    />
  )

  return (
    <section className="page">
      <PageHeader
        title="Sesiones y horarios"
        description="Calendario de ocupación de los dos laboratorios. Los horarios de turno cargados ahora son de demostración: cámbialos cuando la institución defina la jornada real."
        actions={<Button type="button" onClick={() => abrirNueva()}><Plus size={18} /> Nueva sesión</Button>}
      />
      <div className="cal-toolbar">
        <Segments
          value={vista}
          onChange={(value) => setVista(value as Vista)}
          options={[
            { id: 'dia', label: 'Día' },
            { id: 'semana', label: 'Semana' },
            { id: 'mes', label: 'Mes' },
          ]}
        />
        <Segments
          value={turnoId}
          onChange={(value) => setTurnoId(value as TurnoId)}
          options={data.turnos.map((item) => ({ id: item.id, label: item.nombre.replace('Turno ', '') }))}
        />
      </div>
      <div className="filters">
        <Field label="Fecha">
          <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
        </Field>
        <Field label="Turno">
          <select value={turnoId} onChange={(event) => setTurnoId(event.target.value as TurnoId)}>
            {data.turnos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
        </Field>
        <Field label="Laboratorio">
          <select value={filtro.laboratorioId} onChange={(event) => setFiltro({ ...filtro, laboratorioId: event.target.value })}>
            <option value="todos">Ambos</option>
            {data.laboratorios.map((lab) => <option key={lab.id} value={lab.id}>{lab.nombre}</option>)}
          </select>
        </Field>
        <Field label="Maestro">
          <select value={filtro.maestroId} onChange={(event) => setFiltro({ ...filtro, maestroId: event.target.value })}>
            <option value="">Todos</option>
            {data.maestros.map((maestro) => <option key={maestro.id} value={maestro.id}>{maestro.nombre}</option>)}
          </select>
        </Field>
        <Field label="Materia">
          <select value={filtro.materiaId} onChange={(event) => setFiltro({ ...filtro, materiaId: event.target.value })}>
            <option value="">Todas</option>
            {data.materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.nombre} · {etiquetaGrupo(materia.semestre, materia.grupo)}</option>)}
          </select>
        </Field>
        <Field label="Semestre">
          <select value={filtro.semestre} onChange={(event) => setFiltro({ ...filtro, semestre: event.target.value })}>
            <option value="">Todos</option>
            {[1, 2, 3, 4, 5, 6].map((semestre) => <option key={semestre} value={semestre}>{semestre}°</option>)}
          </select>
        </Field>
        <Field label="Grupo">
          <select value={filtro.grupo} onChange={(event) => setFiltro({ ...filtro, grupo: event.target.value })}>
            <option value="">Todos</option>
            {grupos.map((grupo) => <option key={grupo} value={grupo}>{grupo}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select value={filtro.estado} onChange={(event) => setFiltro({ ...filtro, estado: event.target.value })}>
            <option value="">Todos</option>
            <option value="programada">Programada</option>
            <option value="activa">En curso</option>
            <option value="finalizada">Finalizada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </Field>
      </div>
      <Leyenda />
      <p className="hint">Los puntos del mes siguen el filtro. En el día y la semana, un horario ocupado se atenúa si no coincide, pero el laboratorio sigue bloqueado.</p>
      <div className="cal-nav">
        <Button type="button" variant="secondary" aria-label="Anterior" onClick={() => mover(-1)}><ChevronLeft size={18} /></Button>
        <strong>{titulo}</strong>
        <Button type="button" variant="secondary" aria-label="Siguiente" onClick={() => mover(1)}><ChevronRight size={18} /></Button>
        <Button type="button" variant="ghost" onClick={() => setFecha(hoy)}>Hoy</Button>
      </div>
      <div className={vista === 'mes' ? 'cal-layout is-month' : 'cal-layout'}>
        <div className="cal-main">
          {vista === 'dia' ? (
            <AgendaDia
              data={data}
              fecha={fecha}
              turno={turno}
              labs={labs}
              filtro={filtro}
              onSeleccionar={setSeleccion}
              onLibre={(laboratorioId, horaInicio, horaFin) => abrirNueva({ laboratorioId, horaInicio, horaFin })}
            />
          ) : null}
          {vista === 'semana' ? (
            <VistaSemana
              data={data}
              fecha={fecha}
              turno={turno}
              labs={labs}
              filtro={filtro}
              onSeleccionar={setSeleccion}
              onDia={(iso) => { setFecha(iso); setVista('dia') }}
            />
          ) : null}
          {vista === 'mes' ? (
            <VistaMes
              data={data}
              fecha={fecha}
              turno={turno}
              filtro={filtro}
              hoy={hoy}
              onDia={(iso) => { setFecha(iso); setVista('dia') }}
            />
          ) : null}
        </div>
        {vista !== 'mes' && !estrecho ? detalle : null}
      </div>

      <details className="panel turno-panel">
        <summary>Configurar horarios de los turnos</summary>
        <p className="hint">
          Las horas que aparecen al entrar son una jornada de demostración, no el horario oficial de la institución.
          {configuraTurnos ? ' El administrador puede cambiarlas y el cambio queda guardado.' : ' Solo el administrador puede modificarlas.'}
        </p>
        <div className="turno-grid">
          {data.turnos.map((item) => (
            <div className="stack" key={item.id}>
              <strong>{item.nombre}</strong>
              <p className="hint">{item.configurado ? `${item.horaInicio}–${item.horaFin}` : 'Sin horario configurado'} · {item.origen === 'demostracion' ? 'demostración' : 'horario guardado'}</p>
              <div className="form-grid">
                <Field label="Hora de inicio" error={errorTurno?.id === item.id && errorTurno.field === 'horaInicio' ? errorTurno.message : undefined}>
                  <input
                    type="time"
                    disabled={!configuraTurnos}
                    value={horarios[item.id].horaInicio}
                    onChange={(event) => setHorarios({ ...horarios, [item.id]: { ...horarios[item.id], horaInicio: event.target.value.slice(0, 5) } })}
                  />
                </Field>
                <Field label="Hora de fin" error={errorTurno?.id === item.id && errorTurno.field === 'horaFin' ? errorTurno.message : undefined}>
                  <input
                    type="time"
                    disabled={!configuraTurnos}
                    value={horarios[item.id].horaFin}
                    onChange={(event) => setHorarios({ ...horarios, [item.id]: { ...horarios[item.id], horaFin: event.target.value.slice(0, 5) } })}
                  />
                </Field>
              </div>
              {configuraTurnos ? (
                <div className="row-actions">
                  <Button type="button" onClick={() => { void guardarTurno(item.id, true) }}>Guardar horario</Button>
                  <Button type="button" variant="secondary" onClick={() => { void guardarTurno(item.id, false) }}>Dejar sin horario</Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </details>

      {estrecho && seleccion && !abierto ? (
        <Modal title="Detalle" onClose={() => setSeleccion(null)} footer={<Button type="button" variant="secondary" onClick={() => setSeleccion(null)}>Cerrar</Button>}>
          {detalle}
        </Modal>
      ) : null}

      {abierto ? (
        <Modal
          title="Nueva sesión"
          onClose={() => setAbierto(false)}
          footer={<><FormNote /><Button type="button" variant="secondary" onClick={() => setAbierto(false)}>Cancelar</Button><Button type="button" onClick={() => { void crear() }}>Guardar</Button></>}
        >
          <div className="stack">
            <div className="form-grid">
              <Field label="Fecha" error={errores.fecha}>
                <input type="date" value={form.fecha} onChange={(event) => setForm({ ...form, fecha: event.target.value })} />
              </Field>
              <Field label="Turno" error={errores.turnoId}>
                <select
                  value={form.turnoId}
                  onChange={(event) => {
                    const turnoId = event.target.value as TurnoId
                    const materia = data.materias.find((item) => item.id === form.materiaId)
                    const sigue = materia?.turnoId === turnoId
                    setForm({
                      ...form,
                      turnoId,
                      materiaId: sigue ? form.materiaId : '',
                      semestre: sigue ? form.semestre : '',
                      grupo: sigue ? form.grupo : '',
                      maestroId: sigue ? form.maestroId : '',
                    })
                  }}
                >
                  {data.turnos.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Laboratorio" error={errores.laboratorioId}>
              <LabPicker value={form.laboratorioId} labs={data.laboratorios} onChange={(id) => setForm({ ...form, laboratorioId: id })} />
            </Field>
            <div className="form-grid">
              <Field label="Materia" error={errores.materiaId}>
                <select value={form.materiaId} onChange={(event) => elegirMateria(event.target.value)}>
                  <option value="">Selecciona</option>
                  {materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.clave} · {materia.nombre} · {etiquetaGrupo(materia.semestre, materia.grupo)}</option>)}
                </select>
              </Field>
              <Field label="Maestro" error={errores.maestroId}>
                <select value={form.maestroId} onChange={(event) => setForm({ ...form, maestroId: event.target.value })}>
                  <option value="">Selecciona</option>
                  {data.maestros.filter((maestro) => maestro.estado === 'activo' || maestro.id === form.maestroId).map((maestro) => (
                    <option key={maestro.id} value={maestro.id}>{maestro.nombre}</option>
                  ))}
                </select>
              </Field>
              <Field label="Semestre" error={errores.semestre} hint="Se toma de la materia registrada.">
                <input value={form.semestre ? `${form.semestre}°` : ''} readOnly placeholder="Elige una materia" />
              </Field>
              <Field label="Grupo" error={errores.grupo} hint="Se toma de la materia registrada.">
                <input value={form.grupo} readOnly placeholder="Elige una materia" />
              </Field>
              <Field label="Hora de inicio" error={errores.horaInicio}>
                <input type="time" value={form.horaInicio} onChange={(event) => setForm({ ...form, horaInicio: event.target.value.slice(0, 5) })} />
              </Field>
              <Field label="Hora de fin" error={errores.horaFin}>
                <input type="time" value={form.horaFin} onChange={(event) => setForm({ ...form, horaFin: event.target.value.slice(0, 5) })} />
              </Field>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
