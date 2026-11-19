import { useMemo, useState } from 'react'
import { GroupedBars, MeterList } from '../../components/Charts'
import { PageHeader, Segments } from '../../components/ui'
import { fechaCorta } from '../../format'
import { ingresosEnRango, rangoDe, serieDiaria, serieMensual, serieSemanal } from '../../metrics'
import { useData } from '../../state'

export function EstadisticasPage() {
  const data = useData()
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes'>('dia')
  const rango = rangoDe(periodo)
  const serie = periodo === 'semana' ? serieSemanal(data, 6) : periodo === 'mes' ? serieMensual(data) : serieDiaria(data, 10)
  const resumen = useMemo(() => {
    const ingresos = ingresosEnRango(data, rango.desde, rango.hasta)
    const sesiones = new Map(data.sesiones.map((sesion) => [sesion.id, sesion]))
    const materias = new Map<string, number>()
    const horas = new Map<string, number>()
    const alumnosLab = new Map<string, Set<string>>()
    const alumnos = new Set<string>()
    for (const ingreso of ingresos) {
      const sesion = sesiones.get(ingreso.sesionId)
      if (!sesion) continue
      alumnos.add(ingreso.alumnoId)
      const nombre = data.materias.find((materia) => materia.id === sesion.materiaId)?.nombre ?? 'Materia'
      materias.set(nombre, (materias.get(nombre) ?? 0) + 1)
      const hora = `${ingreso.hora.slice(0, 2)}:00`
      horas.set(hora, (horas.get(hora) ?? 0) + 1)
      const conjunto = alumnosLab.get(sesion.laboratorioId) ?? new Set<string>()
      conjunto.add(ingreso.alumnoId)
      alumnosLab.set(sesion.laboratorioId, conjunto)
    }
    return { ingresos: ingresos.length, alumnos: alumnos.size, materias, horas, alumnosLab }
  }, [data, rango.desde, rango.hasta])

  const materias = [...resumen.materias.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }))
  const horas = Array.from({ length: 10 }, (_, index) => {
    const label = `${String(index + 8).padStart(2, '0')}:00`
    return { label, value: resumen.horas.get(label) ?? 0 }
  }).filter((item) => item.value > 0)

  return (
    <section className="page">
      <PageHeader
        title="Estadísticas"
        description={`Periodo del ${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)}.`}
      />
      <Segments
        value={periodo}
        onChange={(value) => setPeriodo(value as typeof periodo)}
        options={[
          { id: 'dia', label: 'Por día' },
          { id: 'semana', label: 'Por semana' },
          { id: 'mes', label: 'Por mes' },
        ]}
      />
      <div className="stats">
        <article className="stat-card"><span>Ingresos</span><strong>{resumen.ingresos}</strong><small>En el periodo</small></article>
        <article className="stat-card"><span>Alumnos distintos</span><strong>{resumen.alumnos}</strong><small>Con al menos un ingreso</small></article>
        <article className="stat-card"><span>Laboratorio 1</span><strong>{resumen.alumnosLab.get('lab-1')?.size ?? 0}</strong><small>Alumnos distintos</small></article>
        <article className="stat-card"><span>Laboratorio 2</span><strong>{resumen.alumnosLab.get('lab-2')?.size ?? 0}</strong><small>Alumnos distintos</small></article>
      </div>
      <div className="stats-board">
        <article className="panel">
          <div className="panel-head"><h2>Uso de los laboratorios</h2></div>
          <p className="hint">Qué tan lleno llegó a estar cada laboratorio, respecto a su capacidad.</p>
          <div className="chart-box">
            <GroupedBars
              amplia
              labels={serie.labels}
              series={[
                { name: 'Laboratorio 1', color: '#1D4ED8', values: serie.lab1 },
                { name: 'Laboratorio 2', color: '#38BDF8', values: serie.lab2 },
              ]}
            />
          </div>
        </article>
        <div className="stats-side">
          <article className="panel">
            <div className="panel-head"><h2>Materias más frecuentes</h2></div>
            <MeterList items={materias} />
          </article>
          <article className="panel">
            <div className="panel-head"><h2>Horarios de utilización</h2></div>
            <MeterList items={horas} />
          </article>
        </div>
      </div>
    </section>
  )
}
