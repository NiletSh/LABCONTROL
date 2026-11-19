import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import type { DemoData } from '@shared/types'
import { avisosDeClave } from '../api'
import type { AvisoClave } from '../api'
import { fechaHora } from '../format'

interface Aviso {
  id: string
  titulo: string
  detalle: string
  cuando: string
  to: string
  alerta?: boolean
}

function avisos(data: DemoData, puede: (permiso: string) => boolean, claves: AvisoClave[], alertas: AvisoClave[]) {
  const lista: Aviso[] = []
  if (puede('usuarios')) {
    for (const item of alertas) {
      lista.push({
        id: item.id,
        titulo: 'Alerta',
        detalle: `${item.nombre} dice que no pidió el cambio de contraseña. La temporal quedó cancelada.`,
        cuando: item.creado ? fechaHora(item.creado) : '',
        to: '/usuarios',
        alerta: true,
      })
    }
    for (const item of claves) {
      lista.push({
        id: item.id,
        titulo: 'Olvidó su contraseña',
        detalle: `${item.nombre} · ${item.correo}. En Usuarios pulsa Enviar por correo.`,
        cuando: item.creado ? fechaHora(item.creado) : '',
        to: '/usuarios',
      })
    }
  }
  const laboratorios = new Map(data.laboratorios.map((lab) => [lab.id, lab.nombre]))
  const materias = new Map(data.materias.map((materia) => [materia.id, materia.nombre]))

  for (const item of data.incidencias) {
    if (item.estado === 'resuelta') continue
    lista.push({
      id: item.id,
      titulo: item.estado === 'en_atencion' ? 'Incidencia en atención' : 'Incidencia pendiente',
      detalle: `${laboratorios.get(item.laboratorioId) ?? 'Laboratorio'}${item.equipoId ? ` · ${item.equipoId}` : ''}. ${item.descripcion}`,
      cuando: fechaHora(item.fechaHora),
      to: '/incidencias',
    })
  }

  for (const item of data.equipos) {
    if (item.estado !== 'mantenimiento' && item.estado !== 'fuera_de_servicio') continue
    lista.push({
      id: item.id,
      titulo: item.estado === 'mantenimiento' ? 'Equipo en mantenimiento' : 'Equipo fuera de servicio',
      detalle: `${item.id} · ${laboratorios.get(item.laboratorioId) ?? 'Laboratorio'}. ${item.descripcion}`,
      cuando: '',
      to: '/equipos',
    })
  }

  for (const item of data.laboratorios) {
    if (item.estado === 'operativo') continue
    lista.push({
      id: item.id,
      titulo: item.estado === 'cerrado' ? 'Laboratorio cerrado' : 'Laboratorio parcial',
      detalle: `${item.nombre}. ${item.descripcion}`,
      cuando: '',
      to: '/laboratorios',
    })
  }

  if (puede('reservaciones')) {
    for (const item of data.reservaciones) {
      if (item.estado !== 'pendiente') continue
      lista.push({
        id: item.id,
        titulo: 'Reservación por revisar',
        detalle: `${laboratorios.get(item.laboratorioId) ?? 'Laboratorio'} · ${materias.get(item.materiaId) ?? 'Materia'} · ${item.fecha} ${item.horaInicio}–${item.horaFin}`,
        cuando: '',
        to: '/reservaciones',
      })
    }
  }

  for (const item of data.sesiones) {
    if (item.estado !== 'activa') continue
    lista.push({
      id: item.id,
      titulo: 'Sesión en curso',
      detalle: `${laboratorios.get(item.laboratorioId) ?? 'Laboratorio'} · ${materias.get(item.materiaId) ?? 'Materia'} · ${item.horaInicio}–${item.horaFin}`,
      cuando: '',
      to: '/sesiones',
    })
  }

  return lista
}

export function Notificaciones({ data, puede }: { data: DemoData; puede: (permiso: string) => boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [claves, setClaves] = useState<AvisoClave[]>([])
  const [alertas, setAlertas] = useState<AvisoClave[]>([])
  const lista = avisos(data, puede, claves, alertas)

  useEffect(() => {
    if (!puede('usuarios')) return
    let vivo = true
    void avisosDeClave().then((listas) => {
      if (!vivo) return
      setClaves(listas.avisos)
      setAlertas(listas.alertas)
    }).catch(() => {
      if (!vivo) return
      setClaves([])
      setAlertas([])
    })
    return () => { vivo = false }
  }, [puede, data.bitacora])

  useEffect(() => {
    if (!abierto) return
    const cerrar = (event: MouseEvent) => {
      const destino = event.target
      if (destino instanceof Element && destino.closest('.notify')) return
      setAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  return (
    <div className="notify">
      <button
        type="button"
        className={abierto ? 'notify-btn is-open' : 'notify-btn'}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        aria-label={lista.length ? `Notificaciones, ${lista.length} pendientes` : 'Notificaciones'}
        onClick={() => setAbierto((value) => !value)}
      >
        <Bell size={20} />
        {lista.length ? <span className="notify-count">{lista.length > 9 ? '9+' : lista.length}</span> : null}
      </button>
      {abierto ? (
        <div className="notify-panel" role="dialog" aria-label="Notificaciones">
          <header>
            <strong>Notificaciones</strong>
            <span>{lista.length ? `${lista.length} pendientes` : 'Al día'}</span>
          </header>
          {lista.length ? (
            <div className="notify-list">
              {lista.map((aviso) => (
                <Link key={aviso.id} to={aviso.to} className={aviso.alerta ? 'notify-item is-alert' : 'notify-item'} onClick={() => setAbierto(false)}>
                  <strong>{aviso.titulo}</strong>
                  <span>{aviso.detalle}</span>
                  {aviso.cuando ? <small>{aviso.cuando}</small> : null}
                </Link>
              ))}
            </div>
          ) : <p className="notify-empty">No hay avisos pendientes.</p>}
        </div>
      ) : null}
    </div>
  )
}
