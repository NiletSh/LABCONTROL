import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { CalendarClock, Info, LayoutDashboard, LogOut, Menu, ScanLine, X } from 'lucide-react'
import { NAV } from '../nav'
import { can, rolLabel } from '../permissions'
import { useApp } from '../state'
import { EditorPerfil } from '../modules/acceso/PerfilPage'
import { Notificaciones } from './Notificaciones'
import { FotoPerfil, Mark } from './ui'

const TONO: Record<string, string> = {
  '/': 'tone-indigo',
  '/escaneo': 'tone-teal',
  '/sesiones': 'tone-violet',
  '/incidencias': 'tone-rose',
  '/alumnos': 'tone-sky',
  '/maestros': 'tone-amber',
  '/materias': 'tone-indigo',
  '/laboratorios': 'tone-teal',
  '/equipos': 'tone-sky',
  '/reservaciones': 'tone-amber',
  '/estadisticas': 'tone-violet',
  '/reportes': 'tone-emerald',
  '/bitacora': 'tone-rose',
  '/usuarios': 'tone-indigo',
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function Shell({ children }: { children: ReactNode }) {
  const { role, cerrarSesion, apiOnline, toasts, dismissToast, usuarioId, usuarioNombre, data, puede } = useApp()
  const [open, setOpen] = useState(false)
  const [cuentaAbierta, setCuentaAbierta] = useState(false)
  const [editandoPerfil, setEditandoPerfil] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const location = useLocation()

  useEffect(() => {
    setOpen(false)
    setCuentaAbierta(false)
  }, [location.pathname])

  useEffect(() => {
    if (!cuentaAbierta) return
    const cerrar = (event: MouseEvent) => {
      const destino = event.target
      if (destino instanceof Element && destino.closest('.account')) return
      setCuentaAbierta(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [cuentaAbierta])

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const escenario = data?.meta.escenarioTexto ?? 'escenario de demostración'
  const tono = TONO[location.pathname] ?? 'tone-indigo'
  const cuenta = data?.usuarios.find((item) => item.id === usuarioId)
  const grupos = NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(role, item.permiso)),
  })).filter((group) => group.items.length)

  return (
    <div className={`app-shell ${tono}`}>
      {open ? <button type="button" className="backdrop" aria-label="Cerrar menú" onClick={() => setOpen(false)} /> : null}
      <aside className={open ? 'sidebar is-open' : 'sidebar'}>
        <div className="brand">
          <Mark className="brand-logo" />
        </div>
        <nav className="nav" aria-label="Módulos">
          {grupos.map((group) => (
            <div key={group.label}>
              <div className="nav-group">{group.label}</div>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <button type="button" className="btn btn-secondary" onClick={cerrarSesion}>
            <LogOut size={16} />
            Cerrar sesión
          </button>
          <p>La sesión es de esta visita. Para ver el otro rol, cierra sesión y entra con la otra cuenta.</p>
          <div className={apiOnline ? 'api-state is-on' : 'api-state'}>
            <span />
            {apiOnline ? 'API en línea · sin base de datos' : 'API sin conexión'}
          </div>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <div className="topbar-title">
            <button type="button" className="icon-btn menu-btn" aria-label="Abrir menú" onClick={() => setOpen(true)}>
              <Menu size={22} />
            </button>
            <strong>LAB CONTROL</strong>
          </div>
          <div className="topbar-actions">
          {data ? <Notificaciones data={data} puede={puede} /> : null}
          <div className="account">
            <button
              type="button"
              className={cuentaAbierta ? 'who is-open' : 'who'}
              aria-expanded={cuentaAbierta}
              aria-haspopup="menu"
              onClick={() => setCuentaAbierta((value) => !value)}
            >
              <FotoPerfil nombre={usuarioNombre} />
              <div>
                <strong>{usuarioNombre}</strong>
                <span>{rolLabel(role)}</span>
              </div>
            </button>
            {cuentaAbierta ? (
              <div className="account-menu" role="menu">
                <div className="account-card">
                  <FotoPerfil nombre={usuarioNombre} />
                  <div>
                    <strong>{usuarioNombre}</strong>
                    <span>{rolLabel(role)}</span>
                  </div>
                </div>
                {cuenta ? <p className="account-mail">{cuenta.correo}</p> : null}
                <button
                  type="button"
                  className="account-edit"
                  role="menuitem"
                  onClick={() => {
                    setCuentaAbierta(false)
                    setEditandoPerfil(true)
                  }}
                >
                  Editar perfil
                </button>
              </div>
            ) : null}
          </div>
          </div>
        </header>
        <div className="demo-banner">
          <Info size={18} />
          <span>{data?.meta.persistido ? `Escenario del ${escenario}. Los registros se guardan en el servidor y se ven desde cualquier dispositivo conectado a esta API.` : `Datos de demostración del ${escenario}.`}</span>
        </div>
        {installEvent ? (
          <div className="install-hint">
            <span>Puedes instalar LAB CONTROL en la pantalla de inicio.</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                void installEvent.prompt()
                setInstallEvent(null)
              }}
            >
              Instalar
            </button>
          </div>
        ) : null}
        <div className="page-slot">{children}</div>
        {editandoPerfil ? <EditorPerfil onClose={() => setEditandoPerfil(false)} /> : null}
      </div>
      <nav className="bottom-nav" aria-label="Accesos rápidos">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <LayoutDashboard size={20} />
          Inicio
        </NavLink>
        <NavLink to="/escaneo" className={({ isActive }) => (isActive ? 'active' : '')}>
          <ScanLine size={20} />
          Escanear
        </NavLink>
        <NavLink to="/sesiones" className={({ isActive }) => (isActive ? 'active' : '')}>
          <CalendarClock size={20} />
          Sesiones
        </NavLink>
        <button type="button" onClick={() => setOpen(true)}>
          <Menu size={20} />
          Menú
        </button>
      </nav>
      <div className="toaster" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <span>{toast.message}</span>
            <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Cerrar aviso">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

