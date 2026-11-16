import { useState } from 'react'
import { Button, Field, FotoPerfil, Modal } from '../../components/ui'
import { mapaErrores } from '../../forms'
import { mensajeClave } from '../../sesion'
import { useApp, useData } from '../../state'

export function EditorPerfil({ onClose }: { onClose: () => void }) {
  const data = useData()
  const { usuarioId, guardar, avisar, cambiarClavePropia } = useApp()
  const usuario = data.usuarios.find((item) => item.id === usuarioId)
  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [correo, setCorreo] = useState(usuario?.correo ?? '')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [errorClave, setErrorClave] = useState('')

  if (!usuario) return null

  const guardarPerfil = async () => {
    const resultado = await guardar({
      tipo: 'usuario',
      datos: { id: usuario.id, nombre, correo, rol: usuario.rol, estado: usuario.estado },
      accion: 'Actualizó su perfil.',
      ids: [usuario.id],
      aplicar: (draft) => {
        const record = draft.usuarios.find((item) => item.id === usuario.id)
        if (!record) return
        record.nombre = nombre.trim()
        record.correo = correo.trim().toLowerCase()
      },
    })
    if (!resultado.ok) {
      setErrores(mapaErrores(resultado.errors))
      return
    }
    setErrores({})
    avisar('El perfil quedó guardado.', 'ok')
    onClose()
  }

  const guardarNuevaClave = async () => {
    const formato = mensajeClave(nueva)
    if (formato) {
      setErrorClave(formato)
      return
    }
    if (nueva !== confirmacion) {
      setErrorClave('La confirmación no coincide con la clave nueva.')
      return
    }
    const resultado = await cambiarClavePropia(nueva, actual)
    if (!resultado.ok) {
      setErrorClave(resultado.message)
      return
    }
    setActual('')
    setNueva('')
    setConfirmacion('')
    setErrorClave('')
    avisar('La clave quedó actualizada.', 'ok')
  }

  return (
    <Modal
      className="perfil-modal"
      title="Editar perfil"
      onClose={onClose}
      footer={(
        <>
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={() => { void guardarPerfil() }}>Guardar</Button>
        </>
      )}
    >
      <FotoPerfil nombre={usuario.nombre} />
      <div className="form-grid">
        <Field label="Nombre completo" error={errores.nombre}>
          <input value={nombre} onChange={(event) => setNombre(event.target.value)} />
        </Field>
        <Field label="Correo electrónico" error={errores.correo}>
          <input type="email" value={correo} onChange={(event) => setCorreo(event.target.value)} />
        </Field>
        <Field label="Rol">
          <input value={usuario.rol === 'administrador' ? 'Administrador' : 'Encargado'} readOnly />
        </Field>
      </div>
      <h3 className="perfil-clave">Clave de acceso</h3>
      <div className="form-grid">
        <Field label="Clave actual" className="full">
          <input type="password" autoComplete="current-password" value={actual} onChange={(event) => setActual(event.target.value)} />
        </Field>
        <Field label="Clave nueva" error={errorClave}>
          <input type="password" autoComplete="new-password" value={nueva} onChange={(event) => { setNueva(event.target.value); setErrorClave('') }} />
        </Field>
        <Field label="Confirmar clave nueva">
          <input type="password" autoComplete="new-password" value={confirmacion} onChange={(event) => setConfirmacion(event.target.value)} />
        </Field>
      </div>
      <div className="row-actions">
        <Button type="button" variant="secondary" onClick={() => { void guardarNuevaClave() }}>Guardar clave</Button>
      </div>
    </Modal>
  )
}
