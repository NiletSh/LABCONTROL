import { useState } from 'react'
import { KeyRound, Pencil, Plus } from 'lucide-react'
import type { EstadoPersona, Rol, Usuario } from '@shared/types'
import { Button, Field, FormNote, FotoPerfil, LocalBadge, Modal, PageHeader } from '../../components/ui'
import { incluye } from '../../format'
import { mapaErrores, nuevoId } from '../../forms'
import { PersonaEstado } from '../../labels'
import { rolLabel } from '../../permissions'
import { useApp, useData } from '../../state'

const VACIO = { nombre: '', correo: '', rol: 'encargado' as Rol, estado: 'activo' as EstadoPersona }

interface Entrega {
  nombre: string
  correo: string
  clave: string
}

export function UsuariosPage() {
  const data = useData()
  const { guardar, esCambioLocal, avisar } = useApp()
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [actual, setActual] = useState<Usuario | null>(null)
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [confirmar, setConfirmar] = useState<Usuario | null>(null)
  const [entrega, setEntrega] = useState<Entrega | null>(null)
  const [generando, setGenerando] = useState(false)
  const filas = data.usuarios.filter((usuario) => incluye(`${usuario.nombre} ${usuario.correo} ${usuario.rol}`, busqueda))

  const abrir = (usuario?: Usuario) => {
    setActual(usuario ?? null)
    setErrores({})
    setForm(usuario ? { nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol, estado: usuario.estado } : VACIO)
    setAbierto(true)
  }

  const guardarUsuario = async () => {
    const id = actual?.id ?? nuevoId('usr')
    const nuevo = !actual
    const resultado = await guardar({
      tipo: 'usuario',
      datos: { ...form, id: actual?.id, generarTemporal: nuevo },
      accion: nuevo ? `Preparó el usuario ${form.nombre} con una contraseña temporal.` : `Actualizó al usuario ${form.nombre}.`,
      ids: [id],
      aplicar: (draft) => {
        const record: Usuario = {
          id,
          nombre: form.nombre.trim(),
          correo: form.correo.trim().toLowerCase(),
          rol: form.rol,
          estado: form.estado,
        }
        const index = draft.usuarios.findIndex((usuario) => usuario.id === id)
        if (index >= 0) draft.usuarios[index] = record
        else draft.usuarios.unshift(record)
      },
    })
    if (!resultado.ok) {
      setErrores(mapaErrores(resultado.errors))
      return
    }
    setAbierto(false)
    if (resultado.claveTemporal) {
      setEntrega({ nombre: form.nombre.trim(), correo: form.correo.trim().toLowerCase(), clave: resultado.claveTemporal })
    }
  }

  const generarTemporal = async (usuario: Usuario) => {
    setGenerando(true)
    const resultado = await guardar({
      tipo: 'usuario',
      datos: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        rol: usuario.rol,
        estado: usuario.estado,
        generarTemporal: true,
      },
      accion: `Generó una contraseña temporal para ${usuario.nombre}.`,
      ids: [usuario.id],
      aplicar: () => undefined,
    })
    setGenerando(false)
    setConfirmar(null)
    if (!resultado.ok || !resultado.claveTemporal) {
      avisar(resultado.ok ? 'No se pudo generar la contraseña.' : resultado.message, 'danger')
      return
    }
    setEntrega({ nombre: usuario.nombre, correo: usuario.correo, clave: resultado.claveTemporal })
  }

  const copiar = async (clave: string) => {
    try {
      await navigator.clipboard.writeText(clave)
      avisar('Contraseña copiada.', 'ok')
    } catch {
      avisar('No se pudo copiar. Anótala desde la pantalla.', 'warn')
    }
  }

  return (
    <section className="page">
      <PageHeader
        title="Usuarios y permisos"
        description="Desde aquí decides quién puede entrar. Al dar de alta a alguien, o si olvidó su contraseña, el sistema genera una temporal. Se la entregas y, al entrar, tendrá que elegir la suya."
        actions={<Button type="button" onClick={() => abrir()}><Plus size={18} /> Agregar usuario</Button>}
      />
      <div className="filters">
        <Field label="Buscar"><input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Nombre o correo" /></Field>
      </div>
      {filas.length ? (
        <div className="people-grid">
          {filas.map((usuario) => (
            <article className="panel person-card" key={usuario.id}>
              <div className="person-top">
                <FotoPerfil nombre={usuario.nombre} />
                <div>
                  <strong>{usuario.nombre}</strong>
                  <span>{rolLabel(usuario.rol)}</span>
                </div>
              </div>
              <div className="person-badges">
                <PersonaEstado estado={usuario.estado} />
                <LocalBadge show={esCambioLocal(usuario.id)} />
              </div>
              <dl className="person-facts">
                <div><dt>Correo</dt><dd>{usuario.correo}</dd></div>
                <div><dt>Rol</dt><dd>{rolLabel(usuario.rol)}</dd></div>
              </dl>
              <div className="row-actions">
                <Button type="button" variant="secondary" onClick={() => abrir(usuario)}><Pencil size={16} /> Editar</Button>
                <Button type="button" variant="secondary" onClick={() => setConfirmar(usuario)}><KeyRound size={16} /> Contraseña temporal</Button>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="people-empty">Ningún usuario coincide con la búsqueda.</p>}
      {abierto ? (
        <Modal
          title={actual ? 'Editar usuario' : 'Agregar usuario'}
          onClose={() => setAbierto(false)}
          footer={<><FormNote /><Button type="button" variant="secondary" onClick={() => setAbierto(false)}>Cancelar</Button><Button type="button" onClick={() => { void guardarUsuario() }}>Guardar</Button></>}
        >
          <div className="form-grid">
            <Field label="Nombre completo" error={errores.nombre}><input value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></Field>
            <Field label="Correo electrónico" error={errores.correo}><input type="email" value={form.correo} onChange={(event) => setForm({ ...form, correo: event.target.value })} /></Field>
            <Field label="Rol" error={errores.rol}>
              <select value={form.rol} onChange={(event) => setForm({ ...form, rol: event.target.value as Rol })}>
                <option value="administrador">Administrador</option>
                <option value="encargado">Encargado</option>
              </select>
            </Field>
            <Field label="Estado" error={errores.estado}>
              <select value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value as EstadoPersona })}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </Field>
          </div>
          {actual ? null : <p className="hint">Al guardar, el sistema crea una contraseña temporal. Se muestra una sola vez para que se la entregues. Al entrar, la persona deberá cambiarla.</p>}
        </Modal>
      ) : null}
      {confirmar ? (
        <Modal
          title="Contraseña temporal"
          onClose={() => setConfirmar(null)}
          footer={<><Button type="button" variant="secondary" onClick={() => setConfirmar(null)}>Cancelar</Button><Button type="button" disabled={generando} onClick={() => { void generarTemporal(confirmar) }}>{generando ? 'Generando…' : 'Generar'}</Button></>}
        >
          <p>La contraseña actual de {confirmar.nombre} dejará de servir. Entrégale la nueva y, al entrar con su correo, el sistema le pedirá que elija otra.</p>
        </Modal>
      ) : null}
      {entrega ? (
        <Modal
          title="Entrégale esta contraseña"
          onClose={() => setEntrega(null)}
          footer={<><Button type="button" variant="secondary" onClick={() => { void copiar(entrega.clave) }}>Copiar</Button><Button type="button" onClick={() => setEntrega(null)}>Ya la entregué</Button></>}
        >
          <p>{entrega.nombre} entra con <strong>{entrega.correo}</strong> y esta contraseña temporal. Solo se muestra ahora.</p>
          <p className="clave-temporal">{entrega.clave}</p>
          <p className="hint">Al entrar, tendrá que cambiarla por una propia. Si la olvida después, genera otra desde su cuadro.</p>
        </Modal>
      ) : null}
    </section>
  )
}
