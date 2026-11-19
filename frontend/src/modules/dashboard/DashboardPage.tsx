import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, GraduationCap, Monitor, ScanLine, Users } from 'lucide-react'
import { sesionEnCurso } from '@shared/schedule'
import { relojMexico } from '@shared/reloj'
import { PageHeader } from '../../components/ui'
import { GroupedBars } from '../../components/Charts'
import { fechaCorta, fechaHora, fechaLarga, horaDe } from '../../format'
import { IncidenciaEstado } from '../../labels'
import { serieDiaria } from '../../metrics'
import { useApp, useData } from '../../state'

function useReloj() {
  const [marca, setMarca] = useState(() => relojMexico())
  useEffect(() => {
    const id = window.setInterval(() => setMarca(relojMexico()), 15000)
    return () => window.clearInterval(id)
  }, [])
  return marca
}

export function DashboardPage() {
  const data = useData()
  const { puede } = useApp()
  const reloj = useReloj()
  const hoy = reloj.fecha
  const dia = fechaLarga(hoy)
  const ingresosHoy = data.ingresos.filter((ingreso) => ingreso.fecha === hoy)
  const activas = data.sesiones.filter((sesion) => sesionEnCurso(sesion, hoy, reloj.hora))
  const pendientes = data.incidencias.filter((incidencia) => incidencia.estado === 'pendiente')
  const libres = data.laboratorios.filter((lab) => lab.estado === 'operativo')
  const dentro = new Set(ingresosHoy.filter((ingreso) => activas.some((sesion) => sesion.id === ingreso.sesionId)).map((ingreso) => ingreso.alumnoId)).size
  const disponibles = data.equipos.filter((equipo) => equipo.estado === 'disponible').length
  const mantenimiento = data.equipos.filter((equipo) => equipo.estado === 'mantenimiento' || equipo.estado === 'fuera_de_servicio').length
  const activos = data.alumnos.filter((alumno) => alumno.estado === 'activo').length
  const serie = serieDiaria(data, 7)
  const alumnos = new Map(data.alumnos.map((alumno) => [alumno.id, alumno]))
  const recientes = [...ingresosHoy].sort((a, b) => b.hora.localeCompare(a.hora)).slice(0, 6)

  return (
    <section className="page">
      <PageHeader
        title="Dashboard"
        description={`${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${reloj.hora}.`}
      />
      <div className="stats">
        <article className="stat-card tone-indigo">
          <div className="stat-top"><span>Alumnos registrados</span><span className="stat-icon"><GraduationCap size={18} /></span></div>
          <strong>{data.alumnos.length}</strong>
          <small>{activos} activos</small>
        </article>
        <article className="stat-card tone-teal">
          <div className="stat-top"><span>Ingresos del día</span><span className="stat-icon"><Users size={18} /></span></div>
          <strong>{ingresosHoy.length}</strong>
          <small>{fechaCorta(hoy)}</small>
        </article>
        <article className="stat-card tone-sky">
          <div className="stat-top"><span>Laboratorios disponibles</span><span className="stat-icon"><Monitor size={18} /></span></div>
          <strong>{libres.length}</strong>
          <small>En estado operativo</small>
        </article>
        <article className="stat-card tone-emerald">
          <div className="stat-top"><span>Dentro ahora</span><span className="stat-icon"><Users size={18} /></span></div>
          <strong>{dentro}</strong>
          <small>Con ingreso en una sesión activa</small>
        </article>
        <article className="stat-card tone-amber">
          <div className="stat-top"><span>Equipos disponibles</span><span className="stat-icon"><Monitor size={18} /></span></div>
          <strong>{disponibles}</strong>
          <small>{mantenimiento} en mantenimiento o fuera de servicio</small>
        </article>
        <article className="stat-card tone-violet">
          <div className="stat-top"><span>Sesiones activas</span><span className="stat-icon"><CalendarClock size={18} /></span></div>
          <strong>{activas.length}</strong>
          <small>En curso a las {reloj.hora}</small>
        </article>
        <article className="stat-card tone-rose">
          <div className="stat-top"><span>Incidencias pendientes</span><span className="stat-icon"><AlertTriangle size={18} /></span></div>
          <strong>{pendientes.length}</strong>
          <small>Por atender</small>
        </article>
      </div>
      <div className="quick-actions">
        <Link to="/escaneo"><ScanLine size={22} /> Escanear credencial</Link>
        <Link to="/sesiones"><CalendarClock size={22} /> Sesiones de hoy</Link>
        <Link to="/incidencias"><AlertTriangle size={22} /> Reportar incidencia</Link>
      </div>
      <div className="dashboard-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Utilización de los laboratorios</h2>
          </div>
          <p className="hint">Lo más lleno que estuvo cada laboratorio en los últimos 7 días, respecto a su capacidad.</p>
          <div className="chart-box">
          <GroupedBars
            labels={serie.labels}
            series={[
              { name: 'Laboratorio 1', color: '#1D4ED8', values: serie.lab1 },
              { name: 'Laboratorio 2', color: '#38BDF8', values: serie.lab2 },
            ]}
          />
          </div>
        </article>
        <article className="panel">
          <div className="panel-head">
            <h2>Sesiones activas</h2>
            <Link className="text-link" to="/sesiones">Ver</Link>
          </div>
          <div className="session-list">
            {activas.map((sesion) => {
              const materia = data.materias.find((item) => item.id === sesion.materiaId)
              const maestro = data.maestros.find((item) => item.id === sesion.maestroId)
              const lab = data.laboratorios.find((item) => item.id === sesion.laboratorioId)
              const asistencia = data.ingresos.filter((ingreso) => ingreso.sesionId === sesion.id).length
              return (
                <div key={sesion.id} className="session-item">
                  <strong>{lab?.nombre}</strong>
                  <span>{materia?.nombre} · {sesion.semestre}° {sesion.grupo}</span>
                  <p>{maestro?.nombre} · {sesion.horaInicio}–{sesion.horaFin}</p>
                  <p>{asistencia} ingresos en la sesión</p>
                </div>
              )
            })}
          </div>
        </article>
      </div>
      <div className="dashboard-grid">
        <article className="panel">
          <div className="panel-head">
            <h2>Incidencias pendientes</h2>
            <Link className="text-link" to="/incidencias">Ver</Link>
          </div>
          {pendientes.length === 0 ? <p className="empty">No hay incidencias pendientes.</p> : (
            <ul className="feed">
              {pendientes.map((incidencia) => {
                const lab = data.laboratorios.find((item) => item.id === incidencia.laboratorioId)
                return (
                  <li key={incidencia.id}>
                    <strong>{incidencia.equipoId ?? lab?.nombre}</strong>
                    <span>{incidencia.descripcion}</span>
                    <time>{fechaHora(incidencia.fechaHora)}</time>
                    <IncidenciaEstado estado={incidencia.estado} />
                  </li>
                )
              })}
            </ul>
          )}
        </article>
        <article className="panel">
          <div className="panel-head">
            <h2>Actividad reciente</h2>
            {puede('reportes') ? <Link className="text-link" to="/reportes">Reportes</Link> : null}
          </div>
          <ul className="feed">
            {recientes.map((ingreso) => {
              const alumno = alumnos.get(ingreso.alumnoId)
              const sesion = data.sesiones.find((item) => item.id === ingreso.sesionId)
              const lab = data.laboratorios.find((item) => item.id === sesion?.laboratorioId)
              return (
                <li key={ingreso.id}>
                  <strong>{alumno?.nombre}</strong>
                  <span>{alumno?.matricula} · {lab?.nombre}</span>
                  <time>{horaDe(ingreso.hora)}</time>
                </li>
              )
            })}
          </ul>
          <div className="panel-head" style={{ marginTop: 8 }}>
            <h2>Acciones registradas</h2>
          </div>
          <ul className="feed">
            {data.bitacora.slice(0, 3).map((entry) => (
              <li key={entry.id}>
                <strong>{entry.usuario}</strong>
                <span>{entry.accion}</span>
                <time>{fechaHora(entry.fechaHora)}</time>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  )
}
