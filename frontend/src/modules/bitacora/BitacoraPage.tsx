import { useState } from 'react'
import { DataTable } from '../../components/DataTable'
import { Badge, Field, PageHeader } from '../../components/ui'
import { fechaHora, incluye } from '../../format'
import { useData } from '../../state'

export function BitacoraPage() {
  const data = useData()
  const [busqueda, setBusqueda] = useState('')
  const [usuario, setUsuario] = useState('')
  const usuarios = [...new Set(data.bitacora.map((item) => item.usuario))]
  const filas = data.bitacora.filter((item) => {
    const texto = incluye(`${item.accion} ${item.usuario}`, busqueda)
    return texto && (!usuario || item.usuario === usuario)
  })

  return (
    <section className="page">
      <PageHeader
        title="Bitácora"
        description="Acciones de ejemplo y las que prepares durante esta visita. Las de esta visita desaparecen al recargar."
      />
      <div className="filters">
        <Field label="Buscar"><input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Acción o usuario" /></Field>
        <Field label="Usuario">
          <select value={usuario} onChange={(event) => setUsuario(event.target.value)}>
            <option value="">Todos</option>
            {usuarios.map((item) => <option key={item}>{item}</option>)}
          </select>
        </Field>
      </div>
      <article className="panel">
        <DataTable
          rows={filas}
          getId={(row) => row.id}
          caption="Bitácora"
          empty="No hay acciones con esos filtros."
          resetKey={`${busqueda}|${usuario}`}
          columns={[
            { id: 'cuando', header: 'Fecha y hora', cell: (row) => fechaHora(row.fechaHora) },
            { id: 'usuario', header: 'Usuario', cell: (row) => row.usuario },
            {
              id: 'accion',
              header: 'Acción',
              primary: true,
              cell: (row) => (
                <span className="name-cell">
                  {row.accion}
                  {row.origen === 'sesion' ? <Badge tone="warn">Esta sesión</Badge> : null}
                </span>
              ),
            },
          ]}
        />
      </article>
    </section>
  )
}
