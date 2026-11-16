import { nombreTurno } from './academico.ts'
import type { DemoData, FilaReporte } from './types.ts'

export function construirFilas(data: DemoData): FilaReporte[] {
  const alumnos = new Map(data.alumnos.map((alumno) => [alumno.id, alumno]))
  const sesiones = new Map(data.sesiones.map((sesion) => [sesion.id, sesion]))
  const maestros = new Map(data.maestros.map((maestro) => [maestro.id, maestro]))
  const materias = new Map(data.materias.map((materia) => [materia.id, materia]))
  const laboratorios = new Map(data.laboratorios.map((laboratorio) => [laboratorio.id, laboratorio]))
  const filas: FilaReporte[] = []

  for (const ingreso of data.ingresos) {
    const alumno = alumnos.get(ingreso.alumnoId)
    const sesion = sesiones.get(ingreso.sesionId)
    if (!alumno || !sesion) continue
    const maestro = maestros.get(sesion.maestroId)
    const materia = materias.get(sesion.materiaId)
    const laboratorio = laboratorios.get(sesion.laboratorioId)
    filas.push({
      fecha: ingreso.fecha,
      hora: ingreso.hora,
      matricula: alumno.matricula,
      alumno: alumno.nombre,
      semestre: alumno.semestre,
      grupo: sesion.grupo,
      turno: nombreTurno(sesion.turnoId),
      laboratorio: laboratorio?.nombre ?? sesion.laboratorioId,
      maestro: maestro?.nombre ?? 'Sin maestro',
      materia: materia?.nombre ?? 'Sin materia',
      claveMateria: materia?.clave ?? '',
      horario: `${sesion.horaInicio}–${sesion.horaFin}`,
    })
  }

  filas.sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`) || a.alumno.localeCompare(b.alumno, 'es'))
  return filas
}
