import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { mensajeClave } from '../../sesion'
import { useApp } from '../../state'

export function LoginPage() {
  const { entrar } = useApp()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [recordar, setRecordar] = useState(true)
  const [olvido, setOlvido] = useState(false)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const enviar = async (event: FormEvent) => {
    event.preventDefault()
    setOcupado(true)
    const resultado = await entrar(correo, clave, recordar)
    setOcupado(false)
    if (!resultado.ok) setError(resultado.message)
  }

  useEffect(() => {
    document.title = 'Iniciar sesión · LAB CONTROL'
  }, [])

  return (
    <LoginMarco>
      <form className="login-form" onSubmit={(event) => { void enviar(event) }}>
        <label className="login-input">
          <Mail size={18} aria-hidden />
          <span className="sr-only">Correo institucional</span>
          <input
            type="email"
            autoComplete="username"
            value={correo}
            placeholder="Correo institucional"
            onChange={(event) => { setCorreo(event.target.value); setError('') }}
            required
          />
        </label>
        <label className="login-input">
          <Lock size={18} aria-hidden />
          <span className="sr-only">Contraseña</span>
          <input
            type={verClave ? 'text' : 'password'}
            autoComplete="current-password"
            value={clave}
            placeholder="Contraseña"
            onChange={(event) => { setClave(event.target.value); setError('') }}
            required
          />
          <button type="button" className="login-eye" onClick={() => setVerClave((value) => !value)} aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
            {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </label>
        <div className="login-row">
          <label className="login-check">
            <input type="checkbox" checked={recordar} onChange={(event) => setRecordar(event.target.checked)} />
            Recordar mi sesión
          </label>
          <button type="button" className="login-forget" onClick={() => setOlvido((value) => !value)}>
            ¿No recuerdas tu clave?
          </button>
        </div>
        {olvido ? <p className="login-note">Pide al administrador una contraseña temporal. Al entrar con ella, el sistema te pedirá que la cambies.</p> : null}
        {error ? <p className="login-error">{error}</p> : null}
        <button type="submit" className="login-submit" disabled={ocupado}>
          <ArrowRight size={18} />
          {ocupado ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </form>
      <p className="login-foot"><span />Tu laboratorio, en control<span /></p>
    </LoginMarco>
  )
}

export function ClaveObligatoria() {
  const { cambiarClavePropia, cerrarSesion } = useApp()
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState('')

  const enviar = async (event: FormEvent) => {
    event.preventDefault()
    const formato = mensajeClave(nueva)
    if (formato) {
      setError(formato)
      return
    }
    if (nueva !== confirmacion) {
      setError('La confirmación no coincide.')
      return
    }
    const resultado = await cambiarClavePropia(nueva, '')
    if (!resultado.ok) setError(resultado.message)
  }

  return (
    <LoginMarco>
      <form className="login-form" onSubmit={(event) => { void enviar(event) }}>
        <p className="login-cambio">Cambia tu contraseña</p>
        <p className="login-note">Entraste con una contraseña temporal. Por seguridad, elige una propia para continuar.</p>
        <label className="login-input">
          <Lock size={18} aria-hidden />
          <span className="sr-only">Contraseña nueva</span>
          <input type={verClave ? 'text' : 'password'} value={nueva} placeholder="Contraseña nueva" onChange={(event) => setNueva(event.target.value)} required />
        </label>
        <label className="login-input">
          <Lock size={18} aria-hidden />
          <span className="sr-only">Confirmar contraseña</span>
          <input type={verClave ? 'text' : 'password'} value={confirmacion} placeholder="Confirmar contraseña" onChange={(event) => setConfirmacion(event.target.value)} required />
          <button type="button" className="login-eye" onClick={() => setVerClave((value) => !value)} aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
            {verClave ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button type="submit" className="login-submit">Guardar contraseña</button>
      </form>
      <button type="button" className="login-forget" onClick={cerrarSesion}>Cerrar sesión</button>
    </LoginMarco>
  )
}

function LoginMarco({ children }: { children: ReactNode }) {
  return (
    <div className="login-screen">
      <section className="login-box">
        <header className="login-head">
          <img className="login-logo" src="/logo.png" alt="LAB CONTROL, administración de laboratorios" />
        </header>
        {children}
      </section>
    </div>
  )
}

