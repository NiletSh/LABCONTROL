import type { FieldError } from '@shared/validate'

export function nuevoId(prefix: string) {
  return `local-${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

export function mapaErrores(errors: FieldError[]) {
  const map: Record<string, string> = {}
  for (const error of errors) {
    if (!map[error.field]) map[error.field] = error.message
  }
  return map
}
