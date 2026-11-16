import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/ui'

export function AccesoPage({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <section className="page">
      <PageHeader title={titulo} description={texto} />
      <Link className="text-link" to="/">Ir al inicio</Link>
    </section>
  )
}
