export function mensajeClave(clave: string) {
  if (clave.trim().length < 8) return 'La clave debe tener al menos 8 caracteres.'
  return ''
}

const LLAVE = 'lab-control-token'
const LLAVE_LARGA = 'lab-control-token-persistente'

export function leerToken() {
  return sessionStorage.getItem(LLAVE) || localStorage.getItem(LLAVE_LARGA) || ''
}

export function guardarToken(token: string, recordar = false) {
  sessionStorage.removeItem(LLAVE)
  localStorage.removeItem(LLAVE_LARGA)
  if (recordar) localStorage.setItem(LLAVE_LARGA, token)
  else sessionStorage.setItem(LLAVE, token)
}

export function borrarToken() {
  sessionStorage.removeItem(LLAVE)
  localStorage.removeItem(LLAVE_LARGA)
  sessionStorage.removeItem('lab-control-sesion')
  sessionStorage.removeItem('lab-control-claves')
  sessionStorage.removeItem('lab-control-perfiles')
}
