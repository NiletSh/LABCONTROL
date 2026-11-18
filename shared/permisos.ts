import type { Rol } from './types.ts'

const ENCARGADO = new Set([
  'dashboard',
  'escaneo',
  'alumnos.ver',
  'sesiones',
  'laboratorios.ver',
  'equipos.ver',
  'incidencias',
  'reportes',
  'bitacora',
  'perfil',
])

const OPERACION: Record<string, string> = {
  alumno: 'alumnos.editar',
  'alumnos.carga': 'alumnos.editar',
  ingreso: 'escaneo',
  'ingreso.prueba': 'escaneo',
  maestro: 'maestros',
  materia: 'materias',
  sesion: 'sesiones',
  'sesion.estado': 'sesiones',
  turno: 'usuarios',
  laboratorio: 'laboratorios.editar',
  equipo: 'equipos.editar',
  'equipo.foto': 'equipos.editar',
  'equipo.estado': 'incidencias',
  mantenimiento: 'incidencias',
  incidencia: 'incidencias',
  'incidencia.foto': 'incidencias',
  'incidencia.estado': 'incidencias',
  reservacion: 'reservaciones',
  'reservacion.estado': 'reservaciones',
  usuario: 'usuarios',
}

export function puede(rol: Rol, permiso: string) {
  if (rol === 'administrador') return true
  return ENCARGADO.has(permiso)
}

export function permisoDeOperacion(tipo: string) {
  return OPERACION[tipo] ?? ''
}

export function etiquetaRol(rol: Rol) {
  return rol === 'administrador' ? 'Administrador' : 'Encargado'
}
