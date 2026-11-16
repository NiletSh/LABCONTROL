export type Rol = 'administrador' | 'encargado'

export type EstadoAlumno = 'activo' | 'inactivo'
export type EstadoPersona = 'activo' | 'inactivo'
export type EstadoLaboratorio = 'operativo' | 'parcial' | 'cerrado'
export type EstadoEquipo = 'disponible' | 'ocupada' | 'mantenimiento' | 'fuera_de_servicio'
export type EstadoSesion = 'programada' | 'activa' | 'finalizada' | 'cancelada'
export type TurnoId = 'matutino' | 'vespertino'
export type EstadoIncidencia = 'pendiente' | 'en_atencion' | 'resuelta'
export type EstadoReservacion = 'pendiente' | 'aceptada' | 'rechazada'
export type OrigenRegistro = 'demostracion' | 'sesion'

export interface MetaSistema {
  fuente: 'demostracion'
  persistido: boolean
  escenarioFecha: string
  escenarioTexto: string
  horaReferencia: string
}

export interface Alumno {
  id: string
  matricula: string
  nombre: string
  plantel?: string
  semestre: number
  grupo: string
  turnoId: TurnoId
  estado: EstadoAlumno
}

export interface Maestro {
  id: string
  numeroEmpleado: string
  nombre: string
  correo: string
  turnoId: TurnoId
  estado: EstadoPersona
  materias: string[]
}

export interface Materia {
  id: string
  clave: string
  nombre: string
  semestre: number
  grupo: string
  turnoId: TurnoId
  maestroId: string
}

export interface Laboratorio {
  id: string
  nombre: string
  ubicacion: string
  descripcion: string
  capacidad: number
  cantidadEquipos: number
  estado: EstadoLaboratorio
}

export interface Equipo {
  id: string
  laboratorioId: string
  estado: EstadoEquipo
  descripcion: string
  foto?: string
}

export interface Mantenimiento {
  id: string
  equipoId: string
  fecha: string
  descripcion: string
  responsable: string
}

export interface Turno {
  id: TurnoId
  nombre: string
  horaInicio: string | null
  horaFin: string | null
  configurado: boolean
  origen: OrigenRegistro
}

export interface Sesion {
  id: string
  laboratorioId: string
  maestroId: string
  materiaId: string
  semestre: number
  grupo: string
  turnoId: TurnoId
  fecha: string
  horaInicio: string
  horaFin: string
  estado: EstadoSesion
}

export interface Ingreso {
  id: string
  alumnoId: string
  sesionId: string
  fecha: string
  hora: string
}

export interface SeguimientoIncidencia {
  fechaHora: string
  usuario: string
  estado: EstadoIncidencia
  nota: string
}

export interface Incidencia {
  id: string
  laboratorioId: string
  equipoId: string | null
  descripcion: string
  fechaHora: string
  estado: EstadoIncidencia
  reporta: string
  tipo?: string
  prioridad?: string
  detecto?: string
  solucion?: string
  reparo?: string
  historial?: SeguimientoIncidencia[]
  foto?: string
}

export interface Reservacion {
  id: string
  laboratorioId: string
  maestroId: string
  materiaId: string
  grupo: string
  fecha: string
  horaInicio: string
  horaFin: string
  estado: EstadoReservacion
  motivo?: string
}

export interface Usuario {
  id: string
  nombre: string
  correo: string
  rol: Rol
  estado: EstadoPersona
}

export interface Bitacora {
  id: string
  fechaHora: string
  usuario: string
  accion: string
  origen: OrigenRegistro
}

export interface DemoData {
  meta: MetaSistema
  alumnos: Alumno[]
  maestros: Maestro[]
  materias: Materia[]
  laboratorios: Laboratorio[]
  turnos: Turno[]
  equipos: Equipo[]
  mantenimientos: Mantenimiento[]
  sesiones: Sesion[]
  ingresos: Ingreso[]
  incidencias: Incidencia[]
  reservaciones: Reservacion[]
  usuarios: Usuario[]
  bitacora: Bitacora[]
}

export interface FilaReporte {
  fecha: string
  hora: string
  matricula: string
  alumno: string
  semestre: number
  grupo: string
  turno: string
  laboratorio: string
  maestro: string
  materia: string
  claveMateria: string
  horario: string
}
