import type { TurnoId } from './types.ts'

export const SEMESTRES = [1, 2, 3, 4, 5, 6] as const
export const GRUPOS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export function grupoValido(grupo: string) {
  return /^[A-Z]$/.test(grupo)
}

export function semestreValido(semestre: number) {
  return Number.isInteger(semestre) && semestre >= 1 && semestre <= 6
}

/** Los dos primeros dígitos del número de control son el año de ingreso. Agosto a diciembre es el semestre non; enero a julio, el par. */
export function semestrePorControl(matricula: string, fechaIso: string) {
  const anio = matricula.trim().match(/^(\d{2})/)
  const partes = fechaIso.slice(0, 10).split('-')
  const year = Number(partes[0])
  const month = Number(partes[1])
  if (!anio || !year || !month) return null
  const ingreso = 2000 + Number(anio[1])
  const inicioCiclo = month >= 8 ? year : year - 1
  const mitad = month >= 8 ? 0 : 1
  const semestre = (inicioCiclo - ingreso) * 2 + mitad + 1
  if (semestre < 1) return null
  if (semestre > 6) return { semestre: 6, concluido: true }
  return { semestre, concluido: false }
}

/** Credencial física usada solo para probar el escáner. El cálculo no cambia su registro. */
export function esExpedienteDePrueba(matricula: string) {
  return matricula.replace(/\D/g, '') === '221210106'
}

export function turnoValido(turno: string): turno is TurnoId {
  return turno === 'matutino' || turno === 'vespertino'
}

export function nombreTurno(turno: TurnoId) {
  return turno === 'matutino' ? 'Matutino' : 'Vespertino'
}

export function etiquetaGrupo(semestre: number, grupo: string) {
  return `${semestre}° ${grupo}`
}

export function alumnoDelGrupo(
  alumno: { estado: string; semestre: number; grupo: string; turnoId: string },
  clase: { semestre: number; grupo: string; turnoId: string },
) {
  return alumno.estado === 'activo'
    && alumno.semestre === clase.semestre
    && alumno.grupo === clase.grupo
    && alumno.turnoId === clase.turnoId
}
