import { useEffect, useState } from 'react'
import { KeyRound, Mail, Pencil, Plus } from 'lucide-react'
import type { EstadoPersona, Rol, Usuario } from '@shared/types'
import { textoClaveTemporal } from '@shared/mensajes-correo'
import { avisosDeClave, enviarClavePorCorreo } from '../../api'
import type { AvisoClave } from '../../api'
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
  modo: 'mano' | 'correo'
  enviado: boolean
  enlaceRechazo?: string
}

function enlaceGmail(correo: string, nombre: string, clave: string, enlaceRechazo = '') {
  const asunto = 'LAB CONTROL · Contraseña temporal'
  const cuerpo = textoClaveTemporal(nombre, correo, clave, enlaceRechazo)
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(correo)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
}

export function UsuariosPage() {
  const data = useData()
  const { guardar, esCambioLocal, avisar, reemplazarDatos } = useApp()
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [actual, setActual] = useState<Usuario | null>(null)
  const [form, setForm] = useState(VACIO)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [confirmar, setConfirmar] = useState<Usuario | null>(null)
  const [envio, setEnvio] = useState<Usuario | null>(null)
  const [correoDestino, setCorreoDestino] = useState('')
  const [entrega, setEntrega] = useState<Entrega | null>(null)
  const [generando, setGenerando] = useState(false)
  const [avisos, setAvisos] = useState<AvisoClave[]>([])
  const [alertas, setAlertas] = useState<AvisoClave[]>([])
  const filas = data.usuarios.filter((usuario) => incluye(`${usuario.nombre} ${usuario.correo} ${usuario.rol}`, busqueda))

  const cargarAvisos = () => {
    void avisosDeClave().then((listas) => {
      setAvisos(listas.avisos)
      setAlertas(listas.alertas)
    }).catch(() => {
      setAvisos([])
      setAlertas([])
    })
  }

  useEffect(() => {
    cargarAvisos()
  }, [])

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
      setEntrega({ nombre: form.nombre.trim(), correo: form.correo.trim().toLowerCase(), clave: resultado.claveTemporal, modo: 'mano', enviado: false })
    }
  }

  const abrirEnvio = (usuario: Usuario) => {
    setCorreoDestino(usuario.correo)
    setEnvio(usuario)
  }

  const generarEnMano = async (usuario: Usuario) => {
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
    setAlertas((lista) => lista.filter((aviso) => aviso.usuarioId !== usuario.id))
    setEntrega({ nombre: usuario.nombre, correo: usuario.correo, clave: resultado.claveTemporal, modo: 'mano', enviado: false })
  }

  const generarTemporal = async (usuario: Usuario) => {
    setGenerando(true)
    try {
      const resultado = await enviarClavePorCorreo(usuario.id, correoDestino)
      setGenerando(false)
      if (resultado.status === 401) {
        avisar('La sesión expiró.', 'danger')
        return
      }
      if (!resultado.body.ok || !resultado.body.claveTemporal) {
        avisar(resultado.body.message ?? 'No se pudo generar la contraseña.', 'danger')
        return
      }
      if (resultado.body.data) reemplazarDatos(resultado.body.data)
      setEnvio(null)
      setAvisos((lista) => lista.filter((aviso) => aviso.usuarioId !== usuario.id))
      setAlertas((lista) => lista.filter((aviso) => aviso.usuarioId !== usuario.id))
      setEntrega({
        nombre: resultado.body.nombre ?? usuario.nombre,
        correo: resultado.body.correo ?? correoDestino.trim().toLowerCase(),
        clave: resultado.body.claveTemporal,
        modo: 'correo',
        enviado: Boolean(resultado.body.enviado),
        enlaceRechazo: resultado.body.enlaceRechazo,
      })
      avisar(resultado.body.message ?? 'Contraseña generada.', resultado.body.enviado ? 'ok' : 'warn')
    } catch {
      setGenerando(false)
      avisar('No hay conexión con el servidor.', 'danger')
    }
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
        description="Si la persona está contigo, genera la contraseña temporal y entrégasela. Si pidió ayuda por correo, pulsa Enviar por correo: se manda sola a la dirección que escribas."
        actions={<Button type="button" onClick={() => abrir()}><Plus size={18} /> Agregar usuario</Button>}
      />
      {alertas.length ? (
        <div className="panel alerta-caja">
          <h2>Alertas</h2>
          <ul className="feed">
            {alertas.map((alerta) => (
              <li key={alerta.id}>
                <strong>Alerta</strong>
                <span>{alerta.nombre} dice que no pidió el cambio de contraseña. La temporal quedó cancelada. {alerta.correo}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {avisos.length ? (
        <div className="panel">
          <h2>Pidieron una contraseña</h2>
          <ul className="feed">
            {avisos.map((aviso) => (
              <li key={aviso.id}>
                <strong>{aviso.nombre}</strong>
                <span>{aviso.correo}</span>
                <Button type="button" onClick={() => {
                  const usuario = data.usuarios.find((item) => item.id === aviso.usuarioId)
                  if (usuario) abrirEnvio(usuario)
                }}><Mail size={16} /> Enviar por correo</Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
              <div className="person-actions">
                <button type="button" className="person-action" onClick={() => abrir(usuario)}><Pencil size={14} /> Editar</button>
                <button type="button" className="person-action" onClick={() => setConfirmar(usuario)}><KeyRound size={14} /> En persona</button>
                <button type="button" className="person-action is-mail" onClick={() => abrirEnvio(usuario)}><Mail size={14} /> Por correo</button>
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
          footer={<><Button type="button" variant="secondary" onClick={() => setConfirmar(null)}>Cancelar</Button><Button type="button" disabled={generando} onClick={() => { void generarEnMano(confirmar) }}>{generando ? 'Generando…' : 'Generar'}</Button></>}
        >
          <p>La contraseña actual de {confirmar.nombre} dejará de servir. Se muestra aquí para que se la entregues. Al entrar, tendrá que elegir otra.</p>
        </Modal>
      ) : null}
      {envio ? (
        <Modal
          title="Enviar por correo"
          onClose={() => setEnvio(null)}
          footer={<><Button type="button" variant="secondary" onClick={() => setEnvio(null)}>Cancelar</Button><Button type="button" disabled={generando} onClick={() => { void generarTemporal(envio) }}>{generando ? 'Enviando…' : 'Enviar por correo'}</Button></>}
        >
          <p>La contraseña actual de {envio.nombre} dejará de servir. Se genera una temporal y se envía a este correo. Si lo cambias, con ese correo entrará. Al entrar, tendrá que elegir otra.</p>
          <Field label="Correo de la persona">
            <input type="email" value={correoDestino} onChange={(event) => setCorreoDestino(event.target.value)} />
          </Field>
        </Modal>
      ) : null}
      {entrega ? (
        <Modal
          title={entrega.modo === 'correo' ? 'Contraseña enviada' : 'Entrégale esta contraseña'}
          onClose={() => setEntrega(null)}
          footer={<><Button type="button" variant="secondary" onClick={() => { void copiar(entrega.clave) }}>Copiar</Button><Button type="button" onClick={() => setEntrega(null)}>Ya la entregué</Button></>}
        >
          {entrega.modo === 'correo' ? <p>{entrega.enviado ? `Ya se envió a ${entrega.correo}.` : `Gmail del servidor aún no está conectado. Abre Gmail para mandársela a ${entrega.correo}.`}</p> : <p>Entrégasela a {entrega.nombre}. Solo se muestra ahora.</p>}
          <p>{entrega.nombre} entra con <strong>{entrega.correo}</strong> y esta contraseña temporal.</p>
          <p className="clave-temporal">{entrega.clave}</p>
          {entrega.modo === 'correo' && !entrega.enviado ? <p className="row-actions"><a className="btn btn-secondary" href={enlaceGmail(entrega.correo, entrega.nombre, entrega.clave, entrega.enlaceRechazo)} target="_blank" rel="noreferrer">Abrir Gmail</a></p> : null}
          <p className="hint">Al entrar, tendrá que cambiarla por una propia.</p>
        </Modal>
      ) : null}
    </section>
  )
}
