/** Fecha y hora de la Ciudad de México. El día operativo no se congela en un escenario. */
export function relojMexico(date = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value ?? ''
  const dos = (texto: string) => texto.padStart(2, '0')
  return {
    fecha: `${valor('year')}-${dos(valor('month'))}-${dos(valor('day'))}`,
    hora: `${dos(valor('hour'))}:${dos(valor('minute'))}`,
  }
}
