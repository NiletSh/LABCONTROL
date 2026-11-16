import { Badge } from './components/ui'
import type { EstadoAlumno, EstadoEquipo, EstadoIncidencia, EstadoPersona, EstadoReservacion, EstadoSesion, EstadoLaboratorio } from '@shared/types'

export function AlumnoEstado({ estado }: { estado: EstadoAlumno }) {
  return estado === 'activo' ? <Badge tone="ok">Activo</Badge> : <Badge tone="neutral">Inactivo</Badge>
}

export function PersonaEstado({ estado }: { estado: EstadoPersona }) {
  return estado === 'activo' ? <Badge tone="ok">Activo</Badge> : <Badge tone="neutral">Inactivo</Badge>
}

export function EquipoEstado({ estado }: { estado: EstadoEquipo }) {
  const map = {
    disponible: ['ok', 'Disponible'],
    ocupada: ['info', 'Ocupada'],
    mantenimiento: ['warn', 'Mantenimiento'],
    fuera_de_servicio: ['danger', 'Fuera de servicio'],
  } as const
  const [tone, label] = map[estado]
  return <Badge tone={tone}>{label}</Badge>
}

export function SesionEstado({ estado }: { estado: EstadoSesion }) {
  if (estado === 'activa') return <Badge tone="ok">En curso</Badge>
  if (estado === 'programada') return <Badge tone="info">Programada</Badge>
  if (estado === 'cancelada') return <Badge tone="danger">Cancelada</Badge>
  return <Badge tone="neutral">Finalizada</Badge>
}

export function IncidenciaEstado({ estado }: { estado: EstadoIncidencia }) {
  if (estado === 'pendiente') return <Badge tone="danger">Pendiente</Badge>
  if (estado === 'en_atencion') return <Badge tone="warn">En atención</Badge>
  return <Badge tone="ok">Resuelta</Badge>
}

export function ReservaEstado({ estado }: { estado: EstadoReservacion }) {
  if (estado === 'aceptada') return <Badge tone="ok">Aceptada</Badge>
  if (estado === 'pendiente') return <Badge tone="warn">Pendiente</Badge>
  return <Badge tone="danger">Rechazada</Badge>
}

export function LabEstado({ estado }: { estado: EstadoLaboratorio }) {
  if (estado === 'operativo') return <Badge tone="ok">Operativo</Badge>
  if (estado === 'parcial') return <Badge tone="warn">Parcial</Badge>
  return <Badge tone="danger">Cerrado</Badge>
}
