export function prepararFoto(archivo: File) {
  return new Promise<string>((resolve, reject) => {
    if (!archivo.type.startsWith('image/')) {
      reject(new Error('Elige una imagen JPG, PNG o WebP.'))
      return
    }
    const imagen = new Image()
    const url = URL.createObjectURL(archivo)
    imagen.onload = () => {
      const limite = 960
      const escala = Math.min(1, limite / Math.max(imagen.width, imagen.height))
      const lienzo = document.createElement('canvas')
      lienzo.width = Math.max(1, Math.round(imagen.width * escala))
      lienzo.height = Math.max(1, Math.round(imagen.height * escala))
      const contexto = lienzo.getContext('2d')
      if (!contexto) {
        URL.revokeObjectURL(url)
        reject(new Error('No se pudo preparar la foto.'))
        return
      }
      contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height)
      URL.revokeObjectURL(url)
      const foto = lienzo.toDataURL('image/jpeg', 0.72)
      if (foto.length > 220_000) reject(new Error('La foto es demasiado pesada. Usa una más pequeña.'))
      else resolve(foto)
    }
    imagen.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo leer la imagen.'))
    }
    imagen.src = url
  })
}
