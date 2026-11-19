import { useState } from 'react'
import { rechazarClave } from '../../api'

export function AlertaPage() {
  const token = window.location.pathname.split('/').filter(Boolean)[1] ?? ''
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const avisar = async () => {
    setOcupado(true)
    try {
      const resultado = await rechazarClave(token)
      setMensaje(resultado.body.message ?? 'No se pudo registrar el aviso.')
    } catch {
      setMensaje('No hay conexión con el servidor.')
    }
    setOcupado(false)
  }

  return (
    <div className="login-screen">
      <section className="login-box">
        <header className="login-head">
          <img className="login-logo" src="/logo.png" alt="LAB CONTROL, administración de laboratorios" />
        </header>
        <p className="login-cambio">No pedí este cambio</p>
        <p className="login-note">Si tú no solicitaste la contraseña temporal, avisa al administrador. Esa contraseña dejará de servir.</p>
        {mensaje ? <p className="login-note">{mensaje}</p> : (
          <button type="button" className="login-submit" disabled={ocupado || !token} onClick={() => { void avisar() }}>
            {ocupado ? 'Enviando…' : 'Avisar al administrador'}
          </button>
        )}
      </section>
    </div>
  )
}
