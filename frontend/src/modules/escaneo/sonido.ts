let audio: AudioContext | null = null

function contexto() {
  if (!audio) audio = new AudioContext()
  return audio
}

/** Deja listo el audio con el toque que enciende la cámara. */
export function prepararSonido() {
  const actual = contexto()
  void actual.resume()
}

/** Aviso breve de que la credencial se leyó. */
export function sonarCredencialLeida() {
  const actual = contexto()
  void actual.resume()
  const ahora = actual.currentTime
  ;[784, 1046].forEach((frecuencia, indice) => {
    const oscilador = actual.createOscillator()
    const volumen = actual.createGain()
    const inicio = ahora + indice * 0.1
    oscilador.type = 'sine'
    oscilador.frequency.value = frecuencia
    volumen.gain.setValueAtTime(0.0001, inicio)
    volumen.gain.exponentialRampToValueAtTime(0.2, inicio + 0.02)
    volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.24)
    oscilador.connect(volumen)
    volumen.connect(actual.destination)
    oscilador.start(inicio)
    oscilador.stop(inicio + 0.26)
  })
}
