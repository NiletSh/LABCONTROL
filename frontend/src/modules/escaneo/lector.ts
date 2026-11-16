import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import { BrowserMultiFormatReader } from '@zxing/browser'

type Detector = (video: HTMLVideoElement) => Promise<string | null>

interface CodigoDetectado {
  rawValue?: string
}

interface DetectorNativo {
  detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<CodigoDetectado[]>
}

interface ConstructorNativo {
  new (opciones: { formats: string[] }): DetectorNativo
  getSupportedFormats?: () => Promise<string[]>
}

const FORMATOS = [
  'qr_code',
  'aztec',
  'code_128',
  'code_39',
  'code_93',
  'codabar',
  'data_matrix',
  'ean_13',
  'ean_8',
  'itf',
  'pdf417',
  'upc_a',
  'upc_e',
]

const FORMATOS_ZXING = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.CODABAR,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.ITF,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.PDF_417,
  BarcodeFormat.AZTEC,
]

function textoDe(codigos: CodigoDetectado[]) {
  return codigos.find((codigo) => codigo.rawValue?.trim())?.rawValue?.trim() || null
}

function dibujarBanda(video: HTMLVideoElement, canvas: HTMLCanvasElement, contexto: CanvasRenderingContext2D) {
  const alto = Math.round(video.videoHeight * 0.62)
  const origenY = Math.round(video.videoHeight * 0.32)
  const escala = Math.min(1, 1400 / video.videoWidth)
  canvas.width = Math.max(1, Math.round(video.videoWidth * escala))
  canvas.height = Math.max(1, Math.round(alto * escala))
  contexto.drawImage(video, 0, origenY, video.videoWidth, alto, 0, 0, canvas.width, canvas.height)
}

function dibujarCuadro(video: HTMLVideoElement, canvas: HTMLCanvasElement, contexto: CanvasRenderingContext2D) {
  const lado = Math.round(Math.min(video.videoWidth, video.videoHeight) * 0.82)
  const origenX = Math.round((video.videoWidth - lado) / 2)
  const origenY = Math.round((video.videoHeight - lado) / 2)
  const destino = Math.min(lado, 720)
  canvas.width = destino
  canvas.height = destino
  contexto.drawImage(video, origenX, origenY, lado, lado, 0, 0, destino, destino)
}

async function lectorNativo() {
  const Nativo = (globalThis as { BarcodeDetector?: ConstructorNativo }).BarcodeDetector
  if (!Nativo) return null
  try {
    const disponibles = Nativo.getSupportedFormats ? await Nativo.getSupportedFormats() : FORMATOS
    const formats = FORMATOS.filter((formato) => disponibles.includes(formato))
    if (!formats.length) return null
    return new Nativo({ formats })
  } catch {
    return null
  }
}

function lectorZxing() {
  const hints = new Map<DecodeHintType, unknown>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATOS_ZXING)
  hints.set(DecodeHintType.TRY_HARDER, true)
  const lector = new BrowserMultiFormatReader(hints)
  return (canvas: HTMLCanvasElement) => {
    try {
      return lector.decodeFromCanvas(canvas).getText().trim() || null
    } catch {
      return null
    }
  }
}

/** Lee el código de barras o el QR que aparece en el video de la cámara. */
export async function crearLectorQr(): Promise<Detector> {
  const nativo = await lectorNativo()
  const { default: jsQR } = await import('jsqr')
  const leerZxing = lectorZxing()
  const banda = document.createElement('canvas')
  const cuadro = document.createElement('canvas')
  const contextoBanda = banda.getContext('2d', { willReadFrequently: true })
  const contextoCuadro = cuadro.getContext('2d', { willReadFrequently: true })

  return async (video) => {
    if (video.readyState < 2 || !video.videoWidth) return null
    if (nativo) {
      try {
        const directo = textoDe(await nativo.detect(video))
        if (directo) return directo
      } catch {
        /* algunos teléfonos no leen el video y sí leen la imagen */
      }
    }
    if (!contextoBanda || !contextoCuadro) return null

    dibujarBanda(video, banda, contextoBanda)
    if (nativo) {
      try {
        const enBanda = textoDe(await nativo.detect(banda))
        if (enBanda) return enBanda
      } catch {
        /* sigue el lector por imagen */
      }
    }
    const barras = leerZxing(banda)
    if (barras) return barras

    dibujarCuadro(video, cuadro, contextoCuadro)
    const imagen = contextoCuadro.getImageData(0, 0, cuadro.width, cuadro.height)
    const qr = jsQR(imagen.data, imagen.width, imagen.height, { inversionAttempts: 'attemptBoth' })
    if (qr?.data?.trim()) return qr.data.trim()
    return leerZxing(cuadro)
  }
}
