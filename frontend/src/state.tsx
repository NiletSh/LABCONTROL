import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { DemoData, Rol } from '@shared/types'
import { revisar } from '@shared/validate'
import type { Revision } from '@shared/validate'
import { cambiarClaveEnServidor, operarEnServidor, rutaApi } from './api'
import { can } from './permissions'
import { borrarToken, guardarToken, leerToken } from './sesion'

export interface ToastItem {
  id: string
  message: string
  tone: 'info' | 'ok' | 'warn' | 'danger'
}

interface GuardarOpciones {
  tipo: string
  datos: unknown
  accion: string
  ids: string[]
  aplicar: (draft: DemoData) => void
  silencioso?: boolean
}

interface AppContextValue {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  data: DemoData | null
  role: Rol
  usuarioId: string | null
  sesionActiva: boolean
  debeCambiarClave: boolean
  entrar: (correo: string, clave: string, recordar?: boolean) => Promise<{ ok: true } | { ok: false; message: string }>
  cerrarSesion: () => void
  cambiarClavePropia: (nueva: string, actual: string) => Promise<{ ok: boolean; message: string }>
  apiOnline: boolean
  cambiosLocales: string[]
  toasts: ToastItem[]
  dismissToast: (id: string) => void
  reload: () => void
  puede: (permiso: string) => boolean
  esCambioLocal: (id: string) => boolean
  usuarioNombre: string
  guardar: (opciones: GuardarOpciones) => Promise<Revision & { claveTemporal?: string }>
  avisar: (message: string, tone?: ToastItem['tone']) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppContextValue['status']>('loading')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DemoData | null>(null)
  const [usuarioId, setUsuarioId] = useState<string | null>(null)
  const [debeCambiarClave, setDebeCambiarClave] = useState(false)
  const [apiOnline, setApiOnline] = useState(false)
  const [cambiosLocales, setCambiosLocales] = useState<string[]>([])
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const avisar = useCallback((message: string, tone: ToastItem['tone'] = 'info') => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 7000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const load = useCallback(async () => {
    setStatus('loading')
    setError(null)
    if (!leerToken()) {
      setData(null)
      setUsuarioId(null)
      setApiOnline(true)
      setStatus('ready')
      return
    }
    for (let intento = 0; intento < 12; intento += 1) {
      try {
        const response = await fetch(rutaApi('/api/bootstrap'), { headers: { Authorization: `Bearer ${leerToken()}` } })
        if (response.status === 401) {
          borrarToken()
          setData(null)
          setUsuarioId(null)
          setStatus('ready')
          return
        }
        if (!response.ok) throw new Error('sin respuesta')
        const json = await response.json() as { data: DemoData; usuario: { id: string }; debeCambiar: boolean }
        if (json?.data?.meta?.fuente !== 'demostracion') throw new Error('fuente')
        setData(json.data)
        setUsuarioId(json.usuario.id)
        setDebeCambiarClave(json.debeCambiar)
        setCambiosLocales([])
        setApiOnline(true)
        setStatus('ready')
        return
      } catch {
        await new Promise((resolve) => window.setTimeout(resolve, 500))
      }
    }
    setApiOnline(false)
    setStatus('error')
    setError('No se pudo cargar la información. Inicia el proyecto con npm run dev para levantar la interfaz y la API.')
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const usuario = data?.usuarios.find((item) => item.id === usuarioId && item.estado === 'activo') ?? null
  const role: Rol = usuario?.rol ?? 'encargado'
  const usuarioNombre = usuario?.nombre ?? ''

  const entrar = useCallback(async (correo: string, clave: string, recordar = false) => {
    try {
      const response = await fetch(rutaApi('/api/sesion/entrar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, clave }),
      })
      const body = await response.json() as { ok: boolean; message?: string; token?: string; usuario?: { id: string }; debeCambiar?: boolean; data?: DemoData }
      if (!response.ok || !body.token || !body.usuario || !body.data) {
        return { ok: false as const, message: body.message ?? 'No se pudo iniciar sesión.' }
      }
      guardarToken(body.token, recordar)
      setUsuarioId(body.usuario.id)
      setDebeCambiarClave(Boolean(body.debeCambiar))
      setData(body.data)
      setApiOnline(true)
      setStatus('ready')
      return { ok: true as const }
    } catch {
      return { ok: false as const, message: 'No hay conexión con el servidor.' }
    }
  }, [])

  const cerrarSesion = useCallback(() => {
    const token = leerToken()
    if (token) {
      void fetch(rutaApi('/api/sesion/cerrar'), { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    }
    borrarToken()
    setUsuarioId(null)
    setDebeCambiarClave(false)
    setData(null)
  }, [])

  const cambiarClavePropia = useCallback(async (nueva: string, actual: string) => {
    const resultado = await cambiarClaveEnServidor(nueva, actual)
    if (resultado.body.ok) setDebeCambiarClave(false)
    return { ok: resultado.body.ok, message: resultado.body.message ?? (resultado.body.ok ? 'Clave actualizada.' : 'No se pudo cambiar la clave.') }
  }, [])

  const guardar = useCallback(async (opciones: GuardarOpciones) => {
    if (!data) return { ok: false as const, errors: [{ field: 'form', message: 'Todavía no hay datos en pantalla.' }], message: 'Sin datos' }
    const local = revisar(opciones.tipo, opciones.datos, data)
    if (!local.ok) return local
    try {
      const remoto = await operarEnServidor(opciones.tipo, opciones.datos, opciones.ids, opciones.accion)
      if (remoto.status === 401) {
        borrarToken()
        setUsuarioId(null)
        setData(null)
        return { ok: false as const, errors: [{ field: 'form', message: 'La sesión expiró.' }], message: 'La sesión expiró.' }
      }
      if (!remoto.body.ok || !remoto.body.data) {
        setApiOnline(true)
        return remoto.body.ok
          ? { ok: false as const, errors: [{ field: 'form', message: 'El servidor no devolvió los datos.' }], message: 'No se pudo guardar.' }
          : remoto.body
      }
      setApiOnline(true)
      setData(remoto.body.data)
      setCambiosLocales((current) => [...new Set([...opciones.ids, ...current])])
      if (!opciones.silencioso) avisar('Guardado en el servidor.', 'ok')
      return { ok: true as const, message: remoto.body.message ?? 'Guardado.', claveTemporal: remoto.body.claveTemporal }
    } catch {
      setApiOnline(false)
      return { ok: false as const, errors: [{ field: 'form', message: 'No hay conexión con el servidor. El cambio no se guardó.' }], message: 'No hay conexión con el servidor. El cambio no se guardó.' }
    }
  }, [avisar, data])

  const value = useMemo<AppContextValue>(() => ({
    status,
    error,
    data,
    role,
    usuarioId,
    sesionActiva: Boolean(usuario),
    debeCambiarClave,
    entrar,
    cerrarSesion,
    cambiarClavePropia,
    apiOnline,
    cambiosLocales,
    toasts,
    dismissToast,
    reload: () => { void load() },
    puede: (permiso: string) => can(role, permiso),
    esCambioLocal: (id: string) => cambiosLocales.includes(id),
    usuarioNombre,
    guardar,
    avisar,
  }), [apiOnline, avisar, cambiarClavePropia, cambiosLocales, cerrarSesion, data, debeCambiarClave, dismissToast, entrar, error, guardar, load, role, status, toasts, usuario, usuarioId, usuarioNombre])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp debe usarse dentro del proveedor')
  return context
}

export function useData() {
  const { data } = useApp()
  if (!data) throw new Error('Los datos todavía no están disponibles')
  return data
}
