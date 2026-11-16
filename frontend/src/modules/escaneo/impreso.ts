import { PSM, createWorker, type Worker } from 'tesseract.js'
import { interpretarCredencialImpresa } from '@shared/credencial'

const vacio = { nombre: '', expediente: '', plantel: '' }
let preparado: Promise<Worker> | null = null

function recortarCredencial(origen: HTMLCanvasElement) {
  const contexto = origen.getContext('2d', { willReadFrequently: true })
  if (!contexto) return origen
  const imagen = contexto.getImageData(0, 0, origen.width, origen.height)
  const pixeles = imagen.data
  let izquierda = origen.width
  let derecha = 0
  let arriba = origen.height
  let abajo = 0
  for (let y = 0; y < origen.height; y += 2) {
    for (let x = 0; x < origen.width; x += 2) {
      const i = (y * origen.width + x) * 4
      const gris = (pixeles[i] + pixeles[i + 1] + pixeles[i + 2]) / 3
      if (gris < 165) continue
      if (x < izquierda) izquierda = x
      if (x > derecha) derecha = x
      if (y < arriba) arriba = y
      if (y > abajo) abajo = y
    }
  }
  if (derecha - izquierda < 80 || abajo - arriba < 50) return origen
  const margenX = Math.round((derecha - izquierda) * 0.04)
  const margenY = Math.round((abajo - arriba) * 0.04)
  izquierda = Math.max(0, izquierda - margenX)
  arriba = Math.max(0, arriba - margenY)
  const ancho = Math.min(origen.width - izquierda, derecha - izquierda + margenX * 2)
  const alto = Math.min(origen.height - arriba, abajo - arriba + margenY * 2)
  const destino = document.createElement('canvas')
  const escala = Math.min(2, 1600 / ancho)
  destino.width = Math.max(1, Math.round(ancho * escala))
  destino.height = Math.max(1, Math.round(alto * escala))
  const dibujo = destino.getContext('2d')
  if (!dibujo) return origen
  dibujo.drawImage(origen, izquierda, arriba, ancho, alto, 0, 0, destino.width, destino.height)
  return destino
}

async function lector() {
  if (!preparado) {
    preparado = createWorker('eng', 1, {
      workerPath: `${location.origin}/ocr/worker.min.js`,
      corePath: `${location.origin}/ocr/tesseract-core-simd-lstm.wasm.js`,
      langPath: `${location.origin}/ocr`,
      workerBlobURL: false,
      gzip: true,
    }).then(async (worker) => {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
        preserve_interword_spaces: '1',
      })
      return worker
    }).catch((error) => {
      preparado = null
      throw error
    })
  }
  return preparado
}

/** Prepara el lector del texto impreso mientras se abre la cámara. */
export function prepararLecturaImpresa() {
  void lector().catch(() => undefined)
}

/** Lee nombre, expediente y plantel impresos en el cuadro de la cámara. */
export async function leerCredencialImpresa(video: HTMLVideoElement) {
  if (video.readyState < 2 || !video.videoWidth) return vacio
  const escala = Math.min(1, 1400 / video.videoWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(video.videoWidth * escala))
  canvas.height = Math.max(1, Math.round(video.videoHeight * escala))
  const contexto = canvas.getContext('2d', { willReadFrequently: true })
  if (!contexto) return vacio
  contexto.drawImage(video, 0, 0, canvas.width, canvas.height)
  const credencial = recortarCredencial(canvas)
  try {
    const worker = await lector()
    const completo = await worker.recognize(credencial)
    const leido = interpretarCredencialImpresa(completo.data.text)
    if (leido.nombre) return leido
    const arriba = document.createElement('canvas')
    arriba.width = credencial.width
    arriba.height = Math.max(1, Math.round(credencial.height * 0.62))
    arriba.getContext('2d')?.drawImage(credencial, 0, 0, arriba.width, arriba.height, 0, 0, arriba.width, arriba.height)
    const zona = await worker.recognize(arriba)
    const segunda = interpretarCredencialImpresa(`${zona.data.text}\n${completo.data.text}`)
    return segunda.nombre ? segunda : leido
  } catch {
    return vacio
  }
}
