import type { TurnoId } from './types.ts'

export const SEMESTRES = [1, 2, 3, 4, 5, 6] as const
export const GRUPOS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

export function grupoValido(grupo: string) {
  return /^[A-Z]$/.test(grupo)
}

export function semestreValido(semestre: number) {
  return Number.isInteger(semestre) && semestre >= 1 && semestre <= 6
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
