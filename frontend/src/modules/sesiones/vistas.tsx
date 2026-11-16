import { Link } from 'react-router-dom'
import { alumnoDelGrupo, etiquetaGrupo } from '@shared/academico'
import type { DemoData, EstadoSesion, Laboratorio, Sesion, Turno } from '@shared/types'
import { bloquesDeJornada, celdasDelMes, diasDeSemana, rangosSeCruzan, toMinutes } from '@shared/schedule'
import type { BloqueAgenda, OcupacionAgenda } from '@shared/schedule'
import { Button } from '../../components/ui'
import { fechaDia, fechaLarga } from '../../format'
import { ReservaEstado, SesionEstado } from '../../labels'

export interface FiltroCalendario {
  laboratorioId: string
  maestroId: string
  materiaId: string
  semestre: string
  grupo: string
  estado: string
}

export type Seleccion = { tipo: 'sesion' | 'reservacion'; id: string }

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

const ESTADO: Record<EstadoSesion, string> = {
  programada: 'Programada',
  activa: 'En curso',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
}

export function filtroActivo(filtro: FiltroCalendario) {
  return Boolean(filtro.maestroId || filtro.materiaId || filtro.semestre || filtro.grupo || filtro.estado)
}

export function pasaFiltro(sesion: Sesion, filtro: FiltroCalendario) {
  if (filtro.laboratorioId !== 'todos' && sesion.laboratorioId !== filtro.laboratorioId) return false
  if (filtro.maestroId && sesion.maestroId !== filtro.maestroId) return false
  if (filtro.materiaId && sesion.materiaId !== filtro.materiaId) return false
  if (filtro.semestre && String(sesion.semestre) !== filtro.semestre) return false
  if (filtro.grupo && sesion.grupo !== filtro.grupo) return false
  if (filtro.estado && sesion.estado !== filtro.estado) return false
  return true
}

function coincideOcupacion(data: DemoData, ocupacion: OcupacionAgenda, filtro: FiltroCalendario) {
  if (ocupacion.tipo === 'reservacion') {
    if (filtro.estado) return false
    const reserva = data.reservaciones.find((item) => item.id === ocupacion.id)
    if (!reserva) return false
    if (filtro.maestroId && reserva.maestroId !== filtro.maestroId) return false
    if (filtro.materiaId && reserva.materiaId !== filtro.materiaId) return false
    if (filtro.semestre) {
      const materia = data.materias.find((item) => item.id === reserva.materiaId)
      if (String(materia?.semestre ?? '') !== filtro.semestre) return false
    }
    if (filtro.grupo && reserva.grupo !== filtro.grupo) return false
    return true
  }
  const sesion = data.sesiones.find((item) => item.id === ocupacion.id)
  return Boolean(sesion && pasaFiltro(sesion, filtro))
}

function inscritos(data: DemoData, sesion: Sesion) {
  return data.alumnos.filter((alumno) => alumnoDelGrupo(alumno, sesion)).length
}

function claseDe(data: DemoData, ocupaciones: OcupacionAgenda[]) {
  const sesionId = ocupaciones.find((item) => item.tipo === 'sesion')?.id
  if (!sesionId) return 'is-reservacion'
  return `is-${data.sesiones.find((item) => item.id === sesionId)?.estado ?? 'programada'}`
}

export function Leyenda() {
  return (
    <ul className="cal-legend" aria-label="Estados del horario">
      <li><i className="swatch-libre" /> Disponible</li>
      <li><i className="swatch-programada" /> Programada</li>
      <li><i className="swatch-activa" /> En curso</li>
      <li><i className="swatch-finalizada" /> Finalizada</li>
      <li><i className="swatch-cancelada" /> Cancelada</li>
      <li><i className="swatch-reservacion" /> Reservación</li>
    </ul>
  )
}

function FichaSesion({ data, sesion }: { data: DemoData; sesion: Sesion }) {
  const maestro = data.maestros.find((item) => item.id === sesion.maestroId)
  const materia = data.materias.find((item) => item.id === sesion.materiaId)
  const entradas = data.ingresos.filter((item) => item.sesionId === sesion.id).length
  return (
    <>
      <p>Maestro: {maestro?.nombre ?? 'Sin maestro'}</p>
      <p>Materia: {materia?.nombre ?? 'Sin materia'}</p>
      <p>Semestre y grupo: {etiquetaGrupo(sesion.semestre, sesion.grupo)}</p>
      <p>Inscritos: {inscritos(data, sesion)}</p>
      <p>Ingresaron al laboratorio: {entradas}</p>
    </>
  )
}

function TextoReserva(data: DemoData, id: string) {
  const reserva = data.reservaciones.find((item) => item.id === id)
  if (!reserva) return null
  const maestro = data.maestros.find((item) => item.id === reserva.maestroId)
  const materia = data.materias.find((item) => item.id === reserva.materiaId)
  return (
    <>
      <p>Reservación · {reserva.estado === 'pendiente' ? 'pendiente' : 'aceptada'}</p>
      <p>Maestro: {maestro?.nombre}</p>
      <p>Materia: {materia?.nombre}</p>
      <p>Semestre y grupo: {materia ? etiquetaGrupo(materia.semestre, materia.grupo) : reserva.grupo}</p>
    </>
  )
}

export function AgendaDia({
  data,
  fecha,
  turno,
  labs,
  filtro,
  onSeleccionar,
  onLibre,
}: {
  data: DemoData
  fecha: string
  turno: Turno
  labs: Laboratorio[]
  filtro: FiltroCalendario
  onSeleccionar: (seleccion: Seleccion) => void
  onLibre: (laboratorioId: string, horaInicio: string, horaFin: string) => void
}) {
  return (
    <div className="day-agendas">
      {labs.map((lab) => (
        <article className="panel" key={lab.id}>
          <h2>{lab.nombre}</h2>
          <AgendaLaboratorio
            data={data}
            fecha={fecha}
            turno={turno}
            lab={lab}
            filtro={filtro}
            onSeleccionar={onSeleccionar}
            onLibre={onLibre}
          />
        </article>
      ))}
    </div>
  )
}

function AgendaLaboratorio({
  data,
  fecha,
  turno,
  lab,
  filtro,
  onSeleccionar,
  onLibre,
}: {
  data: DemoData
  fecha: string
  turno: Turno
  lab: Laboratorio
  filtro: FiltroCalendario
  onSeleccionar: (seleccion: Seleccion) => void
  onLibre: (laboratorioId: string, horaInicio: string, horaFin: string) => void
}) {
  const propias = data.sesiones.filter((sesion) => sesion.laboratorioId === lab.id && sesion.fecha === fecha && sesion.turnoId === turno.id)
  if (!turno.configurado || !turno.horaInicio || !turno.horaFin) {
    return (
      <div className="stack">
        <p className="hint">Este turno no tiene horario configurado. No se calculan huecos disponibles.</p>
        {propias.length === 0 ? <p className="empty">No hay sesiones de este turno en el día.</p> : null}
        <div className="agenda-list">
          {propias.map((sesion) => (
            <button
              key={sesion.id}
              type="button"
              className={`agenda-card is-${sesion.estado}${filtroActivo(filtro) && !pasaFiltro(sesion, filtro) ? ' is-dim' : ''}`}
              onClick={() => onSeleccionar({ tipo: 'sesion', id: sesion.id })}
            >
              <header><strong>{sesion.horaInicio}–{sesion.horaFin}</strong><span>{ESTADO[sesion.estado]}</span></header>
              <FichaSesion data={data} sesion={sesion} />
            </button>
          ))}
        </div>
      </div>
    )
  }

  const inicio = turno.horaInicio
  const fin = turno.horaFin
  const ocupaciones: OcupacionAgenda[] = [
    ...data.sesiones
      .filter((sesion) => sesion.laboratorioId === lab.id && sesion.fecha === fecha && sesion.estado !== 'cancelada' && rangosSeCruzan(sesion.horaInicio, sesion.horaFin, inicio, fin))
      .map((sesion) => ({ tipo: 'sesion' as const, id: sesion.id, horaInicio: sesion.horaInicio, horaFin: sesion.horaFin })),
    ...data.reservaciones
      .filter((reserva) => reserva.laboratorioId === lab.id && reserva.fecha === fecha && reserva.estado !== 'rechazada' && rangosSeCruzan(reserva.horaInicio, reserva.horaFin, inicio, fin))
      .map((reserva) => ({ tipo: 'reservacion' as const, id: reserva.id, horaInicio: reserva.horaInicio, horaFin: reserva.horaFin })),
  ]
  const bloques = bloquesDeJornada(inicio, fin, ocupaciones)
  const canceladas = propias.filter((sesion) => sesion.estado === 'cancelada')
  const fuera = propias.filter((sesion) => !rangosSeCruzan(sesion.horaInicio, sesion.horaFin, inicio, fin))

  return (
    <div className="stack">
      <p className="hint">{turno.origen === 'demostracion' ? `Huecos calculados con el horario de demostración, de ${inicio} a ${fin}.` : `Huecos calculados con el horario configurado en esta visita, de ${inicio} a ${fin}.`}</p>
      <div className="agenda-list">
        {bloques.map((bloque) => (
          <BloqueDia
            key={`${bloque.horaInicio}-${bloque.libre}`}
            data={data}
            bloque={bloque}
            canceladas={canceladas}
            filtro={filtro}
            onSeleccionar={onSeleccionar}
            onLibre={() => onLibre(lab.id, bloque.horaInicio, bloque.horaFin)}
          />
        ))}
      </div>
      {fuera.length ? (
        <div className="stack">
          <h3 className="subhead">Fuera del horario del turno</h3>
          {fuera.map((sesion) => (
            <button key={sesion.id} type="button" className={`agenda-card is-${sesion.estado}`} onClick={() => onSeleccionar({ tipo: 'sesion', id: sesion.id })}>
              <header><strong>{sesion.horaInicio}–{sesion.horaFin}</strong><span>{ESTADO[sesion.estado]}</span></header>
              <FichaSesion data={data} sesion={sesion} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function BloqueDia({
  data,
  bloque,
  canceladas,
  filtro,
  onSeleccionar,
  onLibre,
}: {
  data: DemoData
  bloque: BloqueAgenda
  canceladas: Sesion[]
  filtro: FiltroCalendario
  onSeleccionar: (seleccion: Seleccion) => void
  onLibre: () => void
}) {
  const notas = canceladas.filter((sesion) => rangosSeCruzan(sesion.horaInicio, sesion.horaFin, bloque.horaInicio, bloque.horaFin))
  if (bloque.libre) {
    return (
      <div className="agenda-card is-libre">
        <header><strong>{bloque.horaInicio}–{bloque.horaFin}</strong><span>Disponible</span></header>
        <button type="button" className="text-link agenda-link" onClick={onLibre}>Usar este horario</button>
        {notas.map((sesion) => (
          <button key={sesion.id} type="button" className="cancel-note" onClick={() => onSeleccionar({ tipo: 'sesion', id: sesion.id })}>
            {sesion.horaInicio}–{sesion.horaFin} cancelada. El horario sigue disponible.
          </button>
        ))}
      </div>
    )
  }

  const atenuada = filtroActivo(filtro) && bloque.ocupaciones.every((item) => !coincideOcupacion(data, item, filtro))
  const principal = bloque.ocupaciones[0]
  return (
    <button
      type="button"
      className={`agenda-card ${claseDe(data, bloque.ocupaciones)}${atenuada ? ' is-dim' : ''}`}
      onClick={() => onSeleccionar({ tipo: principal.tipo, id: principal.id })}
    >
      <header>
        <strong>{bloque.horaInicio}–{bloque.horaFin}</strong>
        <span>{principal.tipo === 'reservacion' ? 'Reservación' : ESTADO[data.sesiones.find((item) => item.id === principal.id)?.estado ?? 'programada']}</span>
      </header>
      {bloque.ocupaciones.map((item) => (
        item.tipo === 'sesion'
          ? <FichaSesion key={item.id} data={data} sesion={data.sesiones.find((sesion) => sesion.id === item.id)!} />
          : <div key={item.id}>{TextoReserva(data, item.id)}</div>
      ))}
      {atenuada ? <p>No coincide con el filtro. El horario sigue ocupado.</p> : null}
    </button>
  )
}

export function VistaSemana({
  data,
  fecha,
  turno,
  labs,
  filtro,
  onSeleccionar,
  onDia,
}: {
  data: DemoData
  fecha: string
  turno: Turno
  labs: Laboratorio[]
  filtro: FiltroCalendario
  onSeleccionar: (seleccion: Seleccion) => void
  onDia: (iso: string) => void
}) {
  const dias = diasDeSemana(fecha)
  if (!turno.configurado || !turno.horaInicio || !turno.horaFin) {
    return <p className="hint">Configura el horario del {turno.nombre.toLowerCase()} para comparar la semana. Sin ese horario no se dibujan los huecos.</p>
  }
  const inicio = toMinutes(turno.horaInicio)
  const fin = toMinutes(turno.horaFin)
  const total = fin - inicio
  const altura = Math.max(280, (total / 60) * 52)
  const marcas: number[] = []
  for (let minuto = Math.ceil(inicio / 60) * 60; minuto < fin; minuto += 60) marcas.push(minuto)
  if (marcas[0] !== inicio) marcas.unshift(inicio)
  if (marcas.at(-1) !== fin) marcas.push(fin)

  return (
    <div className="week-pair">
      {labs.map((lab) => (
        <article className="panel" key={lab.id}>
          <h2>{lab.nombre}</h2>
          <div className="week-scroll">
            <div className="week-grid">
              <div />
              {dias.map((dia) => (
                <button key={dia} type="button" className={`week-head${dia === fecha ? ' is-selected' : ''}`} onClick={() => onDia(dia)}>
                  {fechaDia(dia)}
                </button>
              ))}
              <div className="week-times" style={{ height: altura }}>
                {marcas.map((minuto) => (
                  <span key={minuto} style={{ top: `${((minuto - inicio) / total) * 100}%` }}>
                    {`${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`}
                  </span>
                ))}
              </div>
              {dias.map((dia) => (
                <div key={dia} className={`week-track${dia === fecha ? ' is-selected' : ''}`} style={{ height: altura }}>
                  {data.sesiones
                    .filter((sesion) => sesion.laboratorioId === lab.id && sesion.fecha === dia && rangosSeCruzan(sesion.horaInicio, sesion.horaFin, turno.horaInicio!, turno.horaFin!))
                    .map((sesion) => {
                      const arriba = Math.max(toMinutes(sesion.horaInicio), inicio)
                      const abajo = Math.min(toMinutes(sesion.horaFin), fin)
                      const atenuada = filtroActivo(filtro) && !pasaFiltro(sesion, filtro)
                      return (
                        <button
                          key={sesion.id}
                          type="button"
                          className={`week-block is-${sesion.estado}${atenuada ? ' is-dim' : ''}`}
                          style={{ top: `${((arriba - inicio) / total) * 100}%`, height: `${((abajo - arriba) / total) * 100}%` }}
                          onClick={() => onSeleccionar({ tipo: 'sesion', id: sesion.id })}
                        >
                          <strong>{data.materias.find((item) => item.id === sesion.materiaId)?.nombre}</strong>
                          <span>{etiquetaGrupo(sesion.semestre, sesion.grupo)} · {sesion.horaInicio}–{sesion.horaFin}</span>
                        </button>
                      )
                    })}
                  {data.reservaciones
                    .filter((reserva) => reserva.laboratorioId === lab.id && reserva.fecha === dia && reserva.estado !== 'rechazada' && rangosSeCruzan(reserva.horaInicio, reserva.horaFin, turno.horaInicio!, turno.horaFin!))
                    .map((reserva) => {
                      const arriba = Math.max(toMinutes(reserva.horaInicio), inicio)
                      const abajo = Math.min(toMinutes(reserva.horaFin), fin)
                      return (
                        <button
                          key={reserva.id}
                          type="button"
                          className="week-block is-reservacion"
                          style={{ top: `${((arriba - inicio) / total) * 100}%`, height: `${((abajo - arriba) / total) * 100}%` }}
                          onClick={() => onSeleccionar({ tipo: 'reservacion', id: reserva.id })}
                        >
                          <strong>Reservación</strong>
                          <span>{reserva.horaInicio}–{reserva.horaFin}</span>
                        </button>
                      )
                    })}
                </div>
              ))}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

export function VistaMes({
  data,
  fecha,
  turno,
  filtro,
  hoy,
  onDia,
}: {
  data: DemoData
  fecha: string
  turno: Turno
  filtro: FiltroCalendario
  hoy: string
  onDia: (iso: string) => void
}) {
  const celdas = celdasDelMes(fecha)
  return (
    <div className="month-wrap">
      <div className="month-grid" aria-hidden="true">
        {DIAS.map((dia) => <div key={dia} className="month-dow">{dia}</div>)}
      </div>
      <div className="month-grid">
        {celdas.map((celda) => {
          const sesiones = data.sesiones.filter((sesion) => sesion.fecha === celda.iso && sesion.turnoId === turno.id && pasaFiltro(sesion, filtro))
          return (
            <button
              key={celda.iso}
              type="button"
              className={`month-day${celda.enMes ? '' : ' is-out'}${celda.iso === fecha ? ' is-selected' : ''}${celda.iso === hoy ? ' is-hoy' : ''}`}
              onClick={() => onDia(celda.iso)}
              aria-label={`${fechaLarga(celda.iso)}, ${sesiones.length} sesiones`}
            >
              <strong>{celda.dia}</strong>
              <span className="dots">
                {sesiones.slice(0, 4).map((sesion) => <i key={sesion.id} className={`dot-${sesion.estado}`} />)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PanelDetalle({
  data,
  seleccion,
  esLocal,
  onEstado,
}: {
  data: DemoData
  seleccion: Seleccion | null
  esLocal: boolean
  onEstado: (sesion: Sesion, estado: EstadoSesion) => void
}) {
  if (!seleccion) {
    return (
      <article className="panel side-panel">
        <h2>Sesión</h2>
        <p className="hint">Selecciona un horario ocupado para ver al maestro, la materia, el grupo y quién ingresó al laboratorio.</p>
      </article>
    )
  }

  if (seleccion.tipo === 'reservacion') {
    const reserva = data.reservaciones.find((item) => item.id === seleccion.id)
    if (!reserva) return null
    const materia = data.materias.find((item) => item.id === reserva.materiaId)
    const maestro = data.maestros.find((item) => item.id === reserva.maestroId)
    return (
      <article className="panel side-panel">
        <h2>Reservación</h2>
        <p className="hint">Este horario está apartado, pero todavía no es una sesión de clase.</p>
        <dl className="dl-grid">
          <div><dt>Laboratorio</dt><dd>{data.laboratorios.find((item) => item.id === reserva.laboratorioId)?.nombre}</dd></div>
          <div><dt>Estado</dt><dd><ReservaEstado estado={reserva.estado} /></dd></div>
          <div><dt>Maestro</dt><dd>{maestro?.nombre}</dd></div>
          <div><dt>Materia</dt><dd>{materia?.nombre}</dd></div>
          <div><dt>Semestre</dt><dd>{materia ? `${materia.semestre}°` : '—'}</dd></div>
          <div><dt>Grupo</dt><dd>{reserva.grupo}</dd></div>
          <div><dt>Fecha</dt><dd>{fechaLarga(reserva.fecha)}</dd></div>
          <div><dt>Horario</dt><dd>{reserva.horaInicio}–{reserva.horaFin}</dd></div>
        </dl>
        <Link className="text-link" to="/reservaciones">Abrir reservaciones</Link>
      </article>
    )
  }

  const sesion = data.sesiones.find((item) => item.id === seleccion.id)
  if (!sesion) return null
  const materia = data.materias.find((item) => item.id === sesion.materiaId)
  const maestro = data.maestros.find((item) => item.id === sesion.maestroId)
  const turno = data.turnos.find((item) => item.id === sesion.turnoId)
  const entradas = data.ingresos
    .filter((item) => item.sesionId === sesion.id)
    .flatMap((ingreso) => {
      const alumno = data.alumnos.find((item) => item.id === ingreso.alumnoId)
      return alumno ? [{ ingreso, alumno }] : []
    })
    .sort((a, b) => a.ingreso.hora.localeCompare(b.ingreso.hora) || a.alumno.nombre.localeCompare(b.alumno.nombre, 'es'))
  const totalIngresos = data.ingresos.filter((item) => item.sesionId === sesion.id).length

  return (
    <article className="panel side-panel">
      <div className="panel-head">
        <h2>Sesión</h2>
        {esLocal ? <span className="badge badge-warn">Sin guardar</span> : null}
      </div>
      <div className="row-actions">
        {sesion.estado === 'programada' ? <Button type="button" onClick={() => onEstado(sesion, 'activa')}>Iniciar</Button> : null}
        {sesion.estado === 'activa' ? <Button type="button" variant="danger" onClick={() => onEstado(sesion, 'finalizada')}>Finalizar</Button> : null}
        {sesion.estado === 'programada' || sesion.estado === 'activa'
          ? <Button type="button" variant="secondary" onClick={() => onEstado(sesion, 'cancelada')}>Cancelar sesión</Button>
          : null}
      </div>
      <dl className="dl-grid">
        <div><dt>Maestro</dt><dd>{maestro?.nombre}</dd></div>
        <div><dt>Materia</dt><dd>{materia?.nombre}</dd></div>
        <div><dt>Semestre</dt><dd>{sesion.semestre}°</dd></div>
        <div><dt>Grupo</dt><dd>{sesion.grupo}</dd></div>
        <div><dt>Laboratorio</dt><dd>{data.laboratorios.find((item) => item.id === sesion.laboratorioId)?.nombre}</dd></div>
        <div><dt>Turno</dt><dd>{turno?.nombre}</dd></div>
        <div><dt>Fecha</dt><dd>{fechaLarga(sesion.fecha)}</dd></div>
        <div><dt>Hora de inicio</dt><dd>{sesion.horaInicio}</dd></div>
        <div><dt>Hora de finalización</dt><dd>{sesion.horaFin}</dd></div>
        <div><dt>Estado</dt><dd><SesionEstado estado={sesion.estado} /></dd></div>
        <div><dt>Alumnos inscritos</dt><dd>{inscritos(data, sesion)}</dd></div>
        <div><dt>Ingresaron al laboratorio</dt><dd>{totalIngresos}</dd></div>
      </dl>
      <h3 className="subhead">Alumnos que ingresaron</h3>
      <p className="hint">Esta lista es la asistencia real de la sesión. Los inscritos que no han pasado no aparecen aquí.</p>
      {entradas.length === 0 ? <p className="empty">Nadie ha ingresado a esta sesión.</p> : (
        <ul className="ingreso-list">
          {entradas.map(({ ingreso, alumno }) => (
            <li key={ingreso.id}>
              <div>
                <strong>{alumno.nombre}</strong>
                <span>{alumno.matricula}</span>
              </div>
              <time>{ingreso.hora}</time>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
