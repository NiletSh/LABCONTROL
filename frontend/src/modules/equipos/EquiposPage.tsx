import { useRef, useState } from 'react'
import { ImagePlus, Plus } from 'lucide-react'
import type { Equipo, EstadoEquipo } from '@shared/types'
import { DataTable } from '../../components/DataTable'
import { Button, Field, FormNote, LocalBadge, Modal, PageHeader } from '../../components/ui'
import { fechaCorta, incluye } from '../../format'
import { mapaErrores, nuevoId } from '../../forms'
import { EquipoEstado } from '../../labels'
import { prepararFoto } from '../../foto'
import { useApp, useData } from '../../state'

export function EquiposPage() {
  const data = useData()
  const { puede, guardar, esCambioLocal, usuarioNombre } = useApp()
  const editar = puede('equipos.editar')
  const [busqueda, setBusqueda] = useState('')
  const [laboratorioId, setLaboratorioId] = useState('todos')
  const [estado, setEstado] = useState('todos')
  const [detalle, setDetalle] = useState<Equipo | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [nota, setNota] = useState(false)
  const [form, setForm] = useState({ id: 'LAB1-PC', laboratorioId: 'lab-1', estado: 'disponible' as EstadoEquipo, descripcion: '', foto: '' })
  const archivoNuevo = useRef<HTMLInputElement>(null)
  const archivoDetalle = useRef<HTMLInputElement>(null)
  const [mantenimiento, setMantenimiento] = useState({ fecha: data.meta.escenarioFecha, descripcion: '' })
  const [errores, setErrores] = useState<Record<string, string>>({})

  const filas = data.equipos.filter((equipo) => {
    const coincide = incluye(`${equipo.id} ${equipo.descripcion}`, busqueda)
    return coincide && (laboratorioId === 'todos' || equipo.laboratorioId === laboratorioId) && (estado === 'todos' || equipo.estado === estado)
  })
  const historial = data.mantenimientos.filter((item) => item.equipoId === detalle?.id).sort((a, b) => b.fecha.localeCompare(a.fecha))
  const equipoActual = detalle ? data.equipos.find((item) => item.id === detalle.id) ?? detalle : null

  const elegirFoto = async (archivo: File | undefined, alRecibir: (foto: string) => void) => {
    if (!archivo) return
    try {
      alRecibir(await prepararFoto(archivo))
      setErrores((actual) => ({ ...actual, foto: '' }))
    } catch (error) {
      setErrores((actual) => ({ ...actual, foto: error instanceof Error ? error.message : 'No se pudo usar esa foto.' }))
    }
  }

  const guardarFoto = async (equipo: Equipo, foto: string) => {
    const resultado = await guardar({
      tipo: 'equipo.foto',
      datos: { id: equipo.id, foto },
      accion: foto ? `Agregó una foto a ${equipo.id}.` : `Quitó la foto de ${equipo.id}.`,
      ids: [equipo.id],
      aplicar: (draft) => {
        const item = draft.equipos.find((row) => row.id === equipo.id)
        if (!item) return
        if (foto) item.foto = foto
        else delete item.foto
      },
    })
    if (!resultado.ok) setErrores(mapaErrores(resultado.errors))
  }

  const cambiarEstado = async (equipo: Equipo, next: EstadoEquipo) => {
    const resultado = await guardar({
      tipo: 'equipo.estado',
      datos: { id: equipo.id, estado: next },
      accion: `Cambió ${equipo.id} a ${next.replaceAll('_', ' ')}.`,
      ids: [equipo.id],
      aplicar: (draft) => {
        const item = draft.equipos.find((row) => row.id === equipo.id)
        if (item) item.estado = next
      },
    })
    if (resultado.ok) setDetalle(null)
  }

  const crear = async () => {
    const id = form.id.trim().toUpperCase()
    const resultado = await guardar({
      tipo: 'equipo',
      datos: { ...form, id, foto: form.foto },
      accion: `Preparó el equipo ${id}.`,
      ids: [id],
      aplicar: (draft) => {
        draft.equipos.push({ id, laboratorioId: form.laboratorioId, estado: form.estado, descripcion: form.descripcion.trim(), ...(form.foto ? { foto: form.foto } : {}) })
        draft.equipos.sort((a, b) => a.id.localeCompare(b.id))
        for (const laboratorio of draft.laboratorios) {
          laboratorio.cantidadEquipos = draft.equipos.filter((equipo) => equipo.laboratorioId === laboratorio.id).length
        }
      },
    })
    if (!resultado.ok) {
      setErrores(mapaErrores(resultado.errors))
      return
    }
    setNuevo(false)
  }

  const agregarNota = async () => {
    if (!detalle) return
    const id = nuevoId('man')
    const resultado = await guardar({
      tipo: 'mantenimiento',
      datos: { equipoId: detalle.id, ...mantenimiento },
      accion: `Agregó una nota de mantenimiento a ${detalle.id}.`,
      ids: [detalle.id],
      aplicar: (draft) => {
        draft.mantenimientos.unshift({
          id,
          equipoId: detalle.id,
          fecha: mantenimiento.fecha,
          descripcion: mantenimiento.descripcion.trim(),
          responsable: usuarioNombre,
        })
      },
    })
    if (!resultado.ok) {
      setErrores(mapaErrores(resultado.errors))
      return
    }
    setNota(false)
  }

  return (
    <section className="page">
      <PageHeader
        title="Equipos de cómputo"
        description="Identificador, laboratorio, estado, foto y notas de mantenimiento."
        actions={editar ? <Button type="button" onClick={() => { setErrores({}); setForm({ id: 'LAB1-PC', laboratorioId: 'lab-1', estado: 'disponible', descripcion: '', foto: '' }); setNuevo(true) }}><Plus size={18} /> Agregar equipo</Button> : null}
      />
      <div className="filters">
        <Field label="Buscar"><input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="LAB1-PC01" /></Field>
        <Field label="Laboratorio">
          <select value={laboratorioId} onChange={(event) => setLaboratorioId(event.target.value)}>
            <option value="todos">Ambos</option>
            {data.laboratorios.map((lab) => <option key={lab.id} value={lab.id}>{lab.nombre}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="disponible">Disponible</option>
            <option value="ocupada">Ocupada</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="fuera_de_servicio">Fuera de servicio</option>
          </select>
        </Field>
      </div>
      <article className="panel">
        <DataTable
          rows={filas}
          getId={(row) => row.id}
          caption="Equipos"
          empty="Ningún equipo coincide con los filtros."
          resetKey={`${busqueda}|${laboratorioId}|${estado}`}
          columns={[
            { id: 'foto', header: 'Foto', cell: (row) => row.foto ? <img className="equipo-foto" src={row.foto} alt={`Foto de ${row.id}`} /> : <span className="equipo-foto-vacio">Sin foto</span> },
            { id: 'id', header: 'Equipo', primary: true, cell: (row) => <span className="name-cell">{row.id} <LocalBadge show={esCambioLocal(row.id)} /></span> },
            { id: 'lab', header: 'Laboratorio', cell: (row) => data.laboratorios.find((lab) => lab.id === row.laboratorioId)?.nombre },
            { id: 'estado', header: 'Estado', cell: (row) => <EquipoEstado estado={row.estado} /> },
            { id: 'descripcion', header: 'Descripción', hideOnMobile: true, cell: (row) => row.descripcion },
            { id: 'acciones', header: 'Acciones', cell: (row) => <Button type="button" variant="secondary" onClick={() => setDetalle(row)}>Consultar</Button> },
          ]}
        />
      </article>
      {equipoActual ? (
        <Modal title={equipoActual.id} onClose={() => setDetalle(null)} footer={<Button type="button" variant="secondary" onClick={() => setDetalle(null)}>Cerrar</Button>}>
          <div className="stack">
            {equipoActual.foto ? <img className="equipo-foto is-wide" src={equipoActual.foto} alt={`Foto de ${equipoActual.id}`} /> : <div className="equipo-foto-vacio is-wide">Sin foto</div>}
            {editar ? (
              <div className="foto-acciones">
                <input ref={archivoDetalle} className="foto-archivo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const archivo = event.target.files?.[0]; event.target.value = ''; void elegirFoto(archivo, (foto) => { void guardarFoto(equipoActual, foto) }) }} />
                <Button type="button" variant="secondary" onClick={() => archivoDetalle.current?.click()}><ImagePlus size={16} /> {equipoActual.foto ? 'Cambiar foto' : 'Agregar foto'}</Button>
                {equipoActual.foto ? <Button type="button" variant="secondary" onClick={() => { void guardarFoto(equipoActual, '') }}>Quitar foto</Button> : null}
              </div>
            ) : null}
            {errores.foto ? <p className="field-error">{errores.foto}</p> : null}
            <dl className="dl-grid">
              <div><dt>Laboratorio</dt><dd>{data.laboratorios.find((lab) => lab.id === equipoActual.laboratorioId)?.nombre}</dd></div>
              <div><dt>Estado</dt><dd><EquipoEstado estado={equipoActual.estado} /></dd></div>
              <div className="full"><dt>Descripción</dt><dd>{equipoActual.descripcion}</dd></div>
            </dl>
            {editar ? (
              <Field label="Cambiar estado">
                <select value={equipoActual.estado} onChange={(event) => { void cambiarEstado(equipoActual, event.target.value as EstadoEquipo) }}>
                  <option value="disponible">Disponible</option>
                  <option value="ocupada">Ocupada</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="fuera_de_servicio">Fuera de servicio</option>
                </select>
              </Field>
            ) : null}
            <div className="panel-head">
              <h2>Historial de mantenimiento</h2>
              {editar ? <Button type="button" variant="secondary" onClick={() => { setErrores((actual) => ({ ...actual, descripcion: '', fecha: '' })); setNota(true) }}>Agregar nota</Button> : null}
            </div>
            {historial.length === 0 ? <p className="empty">Sin notas de mantenimiento.</p> : (
              <ul className="timeline">
                {historial.map((item) => (
                  <li key={item.id}>
                    <strong>{fechaCorta(item.fecha)}</strong>
                    <span>{item.descripcion}</span>
                    <small>{item.responsable}</small>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      ) : null}
      {nuevo ? (
        <Modal title="Agregar equipo" onClose={() => setNuevo(false)} footer={<><FormNote /><Button type="button" variant="secondary" onClick={() => setNuevo(false)}>Cancelar</Button><Button type="button" onClick={() => { void crear() }}>Guardar</Button></>}>
          <div className="form-grid">
            <Field label="Identificador" error={errores.id} hint="Ejemplo: LAB1-PC31"><input value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} /></Field>
            <Field label="Laboratorio" error={errores.laboratorioId}>
              <select value={form.laboratorioId} onChange={(event) => setForm({ ...form, laboratorioId: event.target.value })}>
                {data.laboratorios.map((lab) => <option key={lab.id} value={lab.id}>{lab.nombre}</option>)}
              </select>
            </Field>
            <Field label="Estado" error={errores.estado}>
              <select value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value as EstadoEquipo })}>
                <option value="disponible">Disponible</option>
                <option value="ocupada">Ocupada</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="fuera_de_servicio">Fuera de servicio</option>
              </select>
            </Field>
            <Field label="Descripción" error={errores.descripcion} className="full"><textarea value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} /></Field>
            <Field label="Foto" error={errores.foto} className="full">
              <div className="foto-acciones">
                {form.foto ? <img className="equipo-foto" src={form.foto} alt="Vista previa del equipo" /> : <span className="equipo-foto-vacio">Sin foto</span>}
                <input ref={archivoNuevo} className="foto-archivo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const archivo = event.target.files?.[0]; event.target.value = ''; void elegirFoto(archivo, (foto) => setForm((actual) => ({ ...actual, foto }))) }} />
                <Button type="button" variant="secondary" onClick={() => archivoNuevo.current?.click()}><ImagePlus size={16} /> {form.foto ? 'Cambiar foto' : 'Agregar foto'}</Button>
                {form.foto ? <Button type="button" variant="secondary" onClick={() => setForm({ ...form, foto: '' })}>Quitar</Button> : null}
              </div>
            </Field>
          </div>
        </Modal>
      ) : null}
      {nota && detalle ? (
        <Modal title={`Nota de ${detalle.id}`} onClose={() => setNota(false)} footer={<><FormNote /><Button type="button" variant="secondary" onClick={() => setNota(false)}>Cancelar</Button><Button type="button" onClick={() => { void agregarNota() }}>Guardar</Button></>}>
          <div className="form-grid">
            <Field label="Fecha" error={errores.fecha}><input type="date" value={mantenimiento.fecha} onChange={(event) => setMantenimiento({ ...mantenimiento, fecha: event.target.value })} /></Field>
            <Field label="Trabajo realizado" error={errores.descripcion} className="full"><textarea value={mantenimiento.descripcion} onChange={(event) => setMantenimiento({ ...mantenimiento, descripcion: event.target.value })} /></Field>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
