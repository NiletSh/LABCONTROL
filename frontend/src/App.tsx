import type { ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Shell } from './components/Shell'
import { Button, Mark } from './components/ui'
import { AccesoPage } from './modules/acceso/AccesoPage'
import { ClaveObligatoria, LoginPage } from './modules/acceso/LoginPage'
import { AlumnosPage } from './modules/alumnos/AlumnosPage'
import { BitacoraPage } from './modules/bitacora/BitacoraPage'
import { DashboardPage } from './modules/dashboard/DashboardPage'
import { EquiposPage } from './modules/equipos/EquiposPage'
import { EscaneoPage } from './modules/escaneo/EscaneoPage'
import { EstadisticasPage } from './modules/estadisticas/EstadisticasPage'
import { IncidenciasPage } from './modules/incidencias/IncidenciasPage'
import { LaboratoriosPage } from './modules/laboratorios/LaboratoriosPage'
import { MaestrosPage } from './modules/maestros/MaestrosPage'
import { MateriasPage } from './modules/materias/MateriasPage'
import { ReportesPage } from './modules/reportes/ReportesPage'
import { ReservacionesPage } from './modules/reservaciones/ReservacionesPage'
import { SesionesPage } from './modules/sesiones/SesionesPage'
import { UsuariosPage } from './modules/usuarios/UsuariosPage'
import { AppStateProvider, useApp } from './state'

export function App() {
  return (
    <AppStateProvider>
      <Router />
    </AppStateProvider>
  )
}

function Router() {
  const { status, error, reload, sesionActiva, debeCambiarClave } = useApp()
  if (status !== 'ready') {
    return (
      <div className="boot">
        <section className="boot-card">
          <Mark className="boot-logo" />
          {status === 'loading' ? <p>Cargando LAB CONTROL…</p> : <p>{error}</p>}
          {status === 'error' ? <Button type="button" onClick={reload}>Reintentar</Button> : null}
        </section>
      </div>
    )
  }

  if (!sesionActiva) return <LoginPage />
  if (debeCambiarClave) return <ClaveObligatoria />

  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Guard permiso="dashboard"><DashboardPage /></Guard>} />
          <Route path="/escaneo" element={<Guard permiso="escaneo"><EscaneoPage /></Guard>} />
          <Route path="/alumnos" element={<Guard permiso="alumnos.ver"><AlumnosPage /></Guard>} />
          <Route path="/maestros" element={<Guard permiso="maestros"><MaestrosPage /></Guard>} />
          <Route path="/materias" element={<Guard permiso="materias"><MateriasPage /></Guard>} />
          <Route path="/sesiones" element={<Guard permiso="sesiones"><SesionesPage /></Guard>} />
          <Route path="/laboratorios" element={<Guard permiso="laboratorios.ver"><LaboratoriosPage /></Guard>} />
          <Route path="/equipos" element={<Guard permiso="equipos.ver"><EquiposPage /></Guard>} />
          <Route path="/incidencias" element={<Guard permiso="incidencias"><IncidenciasPage /></Guard>} />
          <Route path="/reservaciones" element={<Guard permiso="reservaciones"><ReservacionesPage /></Guard>} />
          <Route path="/estadisticas" element={<Guard permiso="estadisticas"><EstadisticasPage /></Guard>} />
          <Route path="/reportes" element={<Guard permiso="reportes"><ReportesPage /></Guard>} />
          <Route path="/bitacora" element={<Guard permiso="bitacora"><BitacoraPage /></Guard>} />
          <Route path="/usuarios" element={<Guard permiso="usuarios"><UsuariosPage /></Guard>} />
          <Route path="*" element={<AccesoPage titulo="Módulo no encontrado" texto="Esa dirección no forma parte de LAB CONTROL." />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}

function Guard({ permiso, children }: { permiso: string; children: ReactNode }) {
  const { puede } = useApp()
  if (!puede(permiso)) return <AccesoPage titulo="Módulo no incluido en esta cuenta" texto="La cuenta de encargado no incluye este apartado. Cierra sesión y entra con la cuenta de administrador." />
  return children
}
