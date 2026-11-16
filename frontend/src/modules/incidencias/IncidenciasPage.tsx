import { useRef, useState } from 'react'
import { ImagePlus, Plus } from 'lucide-react'
import type { EstadoIncidencia, Incidencia } from '@shared/types'
import { DataTable } from '../../components/DataTable'
import { Button, Field, FormNote, LocalBadge, Modal, PageHeader } from '../../components/ui'
import { ahoraLocal, fechaHora } from '../../format'
import { prepararFoto } from '../../foto'
import { mapaErrores, nuevoId } from '../../forms'
import { IncidenciaEstado } from '../../labels'
import { useApp, useData } from '../../state'

export function IncidenciasPage() {
  const data = useData()
  const { guardar, esCambioLocal, usuarioNombre } = useApp()
  const [estado, setEstado] = useState('todos')
  const [laboratorioId, setLaboratorioId] = useState('todos')
  const [abierto, setAbierto] = useState(false)
  const [detalle, setDetalle] = useState<Incidencia | null>(null)
  const [form, setForm] = useState({ laboratorioId: data.laboratorios[0]?.id ?? '', equipoId: '', descripcion: '', tipo: 'otro', prioridad: 'media', detecto: '', foto: '' })
  const [seguimiento, setSeguimiento] = useState({ solucion: '', reparo: '' })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const archivoNuevo = useRef<HTMLInputElement>(null)
  const archivoDetalle = useRef<HTMLInputElement>(null)
  const equipos = data.equipos.filter((equipo) => equipo.laboratorioId === form.laboratorioId)

  const filas = data.incidencias.filter((item) => (
    (estado === 'todos' || item.estado === estado) && (laboratorioId === 'todos' || item.laboratorioId === laboratorioId)
  ))
  const incidenciaActual = detalle ? data.incidencias.find((item) => item.id === detalle.id) ?? detalle : null

  const elegirFoto = async (archivo: File | undefined, alRecibir: (foto: string) => void) => {
    if (!archivo) return
    try {
      alRecibir(await prepararFoto(archivo))
      setErrores((actual) => ({ ...actual, foto: '' }))
    } catch (error) {
      setErrores((actual) => ({ ...actual, foto: error instanceof Error ? error.message : 'No se pudo usar esa foto.' }))
    }
  }

  const guardarFoto = async (incidencia: Incidencia, foto: string) => {
    const resultado = await guardar({
      tipo: 'incidencia.foto',
      datos: { id: incidencia.id, foto },
      accion: foto ? `Agregó una foto a la incidencia ${incidencia.id}.` : `Quitó la foto de la incidencia ${incidencia.id}.`,
      ids: [incidencia.id],
      aplicar: (draft) => {
        const item = draft.incidencias.find((row) => row.id === incidencia.id)
        if (!item) return
        if (foto) item.foto = foto
        else delete item.foto
      },
    })
    if (!resultado.ok) setErrores(mapaErrores(resultado.errors))
  }

  const crear = async () => {
    const id = nuevoId('inc')
    const resultado = await guardar({
      tipo: 'incidencia',
      datos: form,
      accion: 'Registró una incidencia.',
      ids: [id],
      aplicar: (draft) => {
        draft.incidencias.unshift({
          id,
          laboratorioId: form.laboratorioId,
          equipoId: form.equipoId || null,
          descripcion: form.descripcion.trim(),
          fechaHora: ahoraLocal(),
          estado: 'pendiente',
          reporta: usuarioNombre,
          ...(form.foto ? { foto: form.foto } : {}),
        })
      },
    })
    if (!resultado.ok) {
      setErrores(mapaErrores(resultado.errors))
      return
    }
    setAbierto(false)
    setForm({ laboratorioId: data.laboratorios[0]?.id ?? '', equipoId: '', descripcion: '', tipo: 'otro', prioridad: 'media', detecto: '', foto: '' })
  }

  const cambiar = async (incidencia: Incidencia, next: EstadoIncidencia) => {
    const resultado = await guardar({
      tipo: 'incidencia.estado',
      datos: { id: incidencia.id, estado: next, solucion: seguimiento.solucion, reparo: seguimiento.reparo },
      accion: `Marcó la incidencia ${incidencia.id} como ${next.replaceAll('_', ' ')}.`,
      ids: [incidencia.id],
      aplicar: (draft) => {
        const item = draft.incidencias.find((row) => row.id === incidencia.id)
        if (item) item.estado = next
      },
    })
    if (resultado.ok) setDetalle((current) => current ? { ...current, estado: next } : current)
  }

  return (
    <section className="page">
      <PageHeader
        title="Incidencias"
        description="Reporta fallas del laboratorio o de un equipo. Puedes adjuntar una foto. La fecha y la hora se toman al preparar el registro."
        actions={<Button type="button" onClick={() => { setErrores({}); setAbierto(true) }}><Plus size={18} /> Reportar falla</Button>}
      />
      <div className="filters">
        <Field label="Laboratorio">
          <select value={laboratorioId} onChange={(event) => setLaboratorioId(event.target.value)}>
            <option value="todos">Ambos</option>
            {data.laboratorios.map((lab) => <option key={lab.id} value={lab.id}>{lab.nombre}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select value={estado} onChange={(event) => setEstado(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_atencion">En atención</option>
            <option value="resuelta">Resuelta</option>
          </select>
        </Field>
      </div>
      <article className="panel">
        <DataTable
          rows={filas}
          getId={(row) => row.id}
          caption="Incidencias"
          empty="No hay incidencias con esos filtros."
          resetKey={`${estado}|${laboratorioId}`}
          onRow={(row) => setDetalle(row)}
          columns={[
            { id: 'foto', header: 'Foto', cell: (row) => row.foto ? <img className="equipo-foto" src={row.foto} alt={`Foto de la incidencia ${row.id}`} /> : <span className="equipo-foto-vacio">Sin foto</span> },
            { id: 'cuando', header: 'Fecha y hora', cell: (row) => fechaHora(row.fechaHora) },
            { id: 'lab', header: 'Laboratorio', primary: true, cell: (row) => <span className="name-cell">{data.laboratorios.find((lab) => lab.id === row.laboratorioId)?.nombre} <LocalBadge show={esCambioLocal(row.id)} /></span> },
            { id: 'equipo', header: 'Equipo', cell: (row) => row.equipoId ?? 'General' },
            { id: 'descripcion', header: 'Problema', cell: (row) => row.descripcion },
            { id: 'estado', header: 'Estado', cell: (row) => <IncidenciaEstado estado={row.estado} /> },
            { id: 'acciones', header: 'Acciones', cell: (row) => <Button type="button" variant="secondary" onClick={() => setDetalle(row)}>Atender</Button> },
          ]}
        />
      </article>
      {abierto ? (
        <Modal className="incidencia-modal" title="Reportar falla" onClose={() => setAbierto(false)} footer={<><FormNote /><Button type="button" variant="secondary" onClick={() => setAbierto(false)}>Cancelar</Button><Button type="button" onClick={() => { void crear() }}>Guardar</Button></>}>
          <div className="form-grid">
            <Field label="Laboratorio" error={errores.laboratorioId}>
              <select value={form.laboratorioId} onChange={(event) => setForm({ ...form, laboratorioId: event.target.value, equipoId: '' })}>
                {data.laboratorios.map((lab) => <option key={lab.id} value={lab.id}>{lab.nombre}</option>)}
              </select>
            </Field>
            <Field label="Equipo" error={errores.equipoId} hint="Opcional si la falla es del aula">
              <select value={form.equipoId} onChange={(event) => setForm({ ...form, equipoId: event.target.value })}>
                <option value="">Sin equipo específico</option>
                {equipos.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.id}</option>)}
              </select>
            </Field>
            <Field label="Tipo de falla">
              <select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })}>
                <option value="no_enciende">No enciende</option>
                <option value="pantalla">Pantalla</option>
                <option value="teclado">Teclado</option>
                <option value="mouse">Mouse</option>
                <option value="red">Red</option>
                <option value="cable">Cable</option>
                <option value="software">Software</option>
                <option value="electrico">Eléctrico</option>
                <option value="internet">Internet</option>
                <option value="otro">Otro</option>
              </select>
            </Field>
            <Field label="Prioridad">
              <select value={form.prioridad} onChange={(event) => setForm({ ...form, prioridad: event.target.value })}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </Field>
            <Field label="Quién avisó la falla" hint="Opcional. Puede ser el nombre de un profesor, sin crearle cuenta." className="full">
              <input value={form.detecto} onChange={(event) => setForm({ ...form, detecto: event.target.value })} />
            </Field>
            <Field label="Descripción del problema" error={errores.descripcion} className="full">
              <textarea value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} />
            </Field>
            <Field label="Foto" error={errores.foto} className="full">
              <div className="foto-acciones">
                {form.foto ? <img className="equipo-foto" src={form.foto} alt="Vista previa de la falla" /> : <span className="equipo-foto-vacio">Sin foto</span>}
                <input ref={archivoNuevo} className="foto-archivo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const archivo = event.target.files?.[0]; event.target.value = ''; void elegirFoto(archivo, (foto) => setForm((actual) => ({ ...actual, foto }))) }} />
                <Button type="button" variant="secondary" onClick={() => archivoNuevo.current?.click()}><ImagePlus size={16} /> {form.foto ? 'Cambiar foto' : 'Agregar foto'}</Button>
                {form.foto ? <Button type="button" variant="secondary" onClick={() => setForm({ ...form, foto: '' })}>Quitar</Button> : null}
              </div>
            </Field>
          </div>
        </Modal>
      ) : null}
      {incidenciaActual ? (
        <Modal className="incidencia-modal" title="Incidencia" onClose={() => setDetalle(null)} footer={<Button type="button" variant="secondary" onClick={() => setDetalle(null)}>Cerrar</Button>}>
          <div className="stack">
            {incidenciaActual.foto ? <img className="equipo-foto is-wide" src={incidenciaActual.foto} alt="Foto de la falla" /> : <div className="equipo-foto-vacio is-wide">Sin foto</div>}
            <div className="foto-acciones">
              <input ref={archivoDetalle} className="foto-archivo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const archivo = event.target.files?.[0]; event.target.value = ''; void elegirFoto(archivo, (foto) => { void guardarFoto(incidenciaActual, foto) }) }} />
              <Button type="button" variant="secondary" onClick={() => archivoDetalle.current?.click()}><ImagePlus size={16} /> {incidenciaActual.foto ? 'Cambiar foto' : 'Agregar foto'}</Button>
              {incidenciaActual.foto ? <Button type="button" variant="secondary" onClick={() => { void guardarFoto(incidenciaActual, '') }}>Quitar foto</Button> : null}
            </div>
            {errores.foto ? <p className="field-error">{errores.foto}</p> : null}
            <dl className="dl-grid">
              <div><dt>Fecha y hora</dt><dd>{fechaHora(incidenciaActual.fechaHora)}</dd></div>
              <div><dt>Reporta</dt><dd>{incidenciaActual.reporta}</dd></div>
              <div><dt>Laboratorio</dt><dd>{data.laboratorios.find((lab) => lab.id === incidenciaActual.laboratorioId)?.nombre}</dd></div>
              <div><dt>Equipo</dt><dd>{incidenciaActual.equipoId ?? 'General'}</dd></div>
              <div className="full"><dt>Problema</dt><dd>{incidenciaActual.descripcion}</dd></div>
              {incidenciaActual.detecto ? <div><dt>Avisó</dt><dd>{incidenciaActual.detecto}</dd></div> : null}
              {incidenciaActual.solucion ? <div className="full"><dt>Solución</dt><dd>{incidenciaActual.solucion}</dd></div> : null}
            </dl>
            <Field label="Solución aplicada" hint="Marcar resuelta no devuelve el equipo a disponible. El estado del equipo se cambia en Equipos.">
              <textarea value={seguimiento.solucion} onChange={(event) => setSeguimiento({ ...seguimiento, solucion: event.target.value })} />
            </Field>
            <Field label="Quién reparó" hint="Opcional. No se asume que fue quien registró la falla.">
              <input value={seguimiento.reparo} onChange={(event) => setSeguimiento({ ...seguimiento, reparo: event.target.value })} />
            </Field>
            <div className="row-actions">
              {(['pendiente', 'en_atencion', 'resuelta'] as EstadoIncidencia[]).map((item) => (
                <Button key={item} type="button" variant={incidenciaActual.estado === item ? 'primary' : 'secondary'} onClick={() => { void cambiar(incidenciaActual, item) }}>
                  {item === 'pendiente' ? 'Pendiente' : item === 'en_atencion' ? 'En atención' : 'Resuelta'}
                </Button>
              ))}
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}
