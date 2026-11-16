import type { Rol } from '@shared/types'
import { etiquetaRol, puede } from '@shared/permisos'

export function can(rol: Rol, permiso: string) {
  return puede(rol, permiso)
}

export function rolLabel(rol: Rol) {
  return etiquetaRol(rol)
}
