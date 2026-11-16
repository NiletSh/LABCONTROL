import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  Cpu,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  Monitor,
  ScanLine,
  ScrollText,
  Shield,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  permiso: string
  end?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    label: 'Operación',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, permiso: 'dashboard', end: true },
      { to: '/escaneo', label: 'Escaneo', icon: ScanLine, permiso: 'escaneo' },
      { to: '/sesiones', label: 'Sesiones', icon: CalendarClock, permiso: 'sesiones' },
      { to: '/incidencias', label: 'Incidencias', icon: AlertTriangle, permiso: 'incidencias' },
    ],
  },
  {
    label: 'Comunidad académica',
    items: [
      { to: '/alumnos', label: 'Alumnos', icon: GraduationCap, permiso: 'alumnos.ver' },
      { to: '/maestros', label: 'Maestros', icon: Users, permiso: 'maestros' },
      { to: '/materias', label: 'Materias y grupos', icon: BookOpen, permiso: 'materias' },
    ],
  },
  {
    label: 'Infraestructura',
    items: [
      { to: '/laboratorios', label: 'Laboratorios', icon: Monitor, permiso: 'laboratorios.ver' },
      { to: '/equipos', label: 'Equipos', icon: Cpu, permiso: 'equipos.ver' },
      { to: '/reservaciones', label: 'Reservaciones', icon: CalendarCheck, permiso: 'reservaciones' },
    ],
  },
  {
    label: 'Consulta',
    items: [
      { to: '/estadisticas', label: 'Estadísticas', icon: BarChart3, permiso: 'estadisticas' },
      { to: '/reportes', label: 'Reportes', icon: FileSpreadsheet, permiso: 'reportes' },
      { to: '/bitacora', label: 'Bitácora', icon: ScrollText, permiso: 'bitacora' },
      { to: '/usuarios', label: 'Usuarios', icon: Shield, permiso: 'usuarios' },
    ],
  },
]

