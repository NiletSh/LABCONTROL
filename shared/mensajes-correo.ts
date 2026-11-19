import { relojMexico } from './reloj.ts'

const SITIO = 'https://laboratorioscontrol.vercel.app/'

export function saludoMexico(date = new Date()) {
  const hora = Number(relojMexico(date).hora.slice(0, 2))
  if (hora >= 6 && hora < 12) return 'Buenos días'
  if (hora >= 12 && hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function textoClaveTemporal(nombre: string, correo: string, clave: string, enlaceRechazo = '', date = new Date()) {
  const saludo = saludoMexico(date)
  return [
    `${saludo}, ${nombre}.`,
    '',
    'El administrador de LAB CONTROL te envía una contraseña temporal para entrar al sistema de los laboratorios.',
    '',
    `Contraseña temporal: ${clave}`,
    '',
    `Entra en ${SITIO}`,
    `Usa este correo: ${correo}`,
    '',
    'Al entrar, el sistema te pedirá que elijas una contraseña propia. La temporal solo sirve para ese primer acceso.',
    '',
    enlaceRechazo
      ? `Si tú no pediste este cambio, avisa aquí: ${enlaceRechazo}`
      : 'Si tú no pediste este cambio, no uses la contraseña y avisa al administrador.',
    '',
    'LAB CONTROL',
    'Administración de laboratorios',
  ].join('\n')
}

export function textoAlertaAdmin(nombre: string, correo: string) {
  return [
    `ALERTA. ${nombre} dice que no pidió el cambio de contraseña.`,
    `Cuenta: ${correo}`,
    'La contraseña temporal quedó cancelada.',
  ].join('\n')
}

export function textoAvisoAdmin(admin: string, nombre: string, correo: string, date = new Date()) {
  const saludo = saludoMexico(date)
  return [
    `${saludo}, ${admin}.`,
    '',
    `${nombre} indicó que olvidó su contraseña de LAB CONTROL.`,
    `Correo de la cuenta: ${correo}`,
    '',
    'Entra al sistema, abre Usuarios y pulsa Enviar por correo. Ahí puedes confirmar o corregir la dirección antes de mandarla.',
    '',
    SITIO,
    '',
    'LAB CONTROL',
    'Administración de laboratorios',
  ].join('\n')
}
