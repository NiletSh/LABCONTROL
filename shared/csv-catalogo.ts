import { grupoValido, semestreValido, turnoValido } from './academico.ts'
import type { EstadoPersona, TurnoId } from './types.ts'
import type { ErrorCarga } from './csv-alumnos.ts'

export interface MaestroCarga {
  id: string
  numeroEmpleado: string
  nombre: string
  correo: string
  turnoId: TurnoId
  estado: EstadoPersona
}

export interface MateriaCarga {
  id: string
  clave: string
  nombre: string
  semestre: number
  grupo: string
  turnoId: TurnoId
  maestroId: string
}

function clave(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function partirLinea(linea: string, separador: string) {
  const celdas: string[] = []
  let actual = ''
  let comillas = false
  for (let i = 0; i < linea.length; i += 1) {
    const letra = linea[i]
    if (comillas) {
      if (letra === '"') {
        if (linea[i + 1] === '"') {
          actual += '"'
          i += 1
        } else comillas = false
      } else actual += letra
    } else if (letra === '"') comillas = true
    else if (letra === separador) {
      celdas.push(actual.trim())
      actual = ''
    } else actual += letra
  }
  celdas.push(actual.trim())
  return celdas
}

function turnoDe(value: string): TurnoId | '' {
  const texto = clave(value)
  if (texto === 'm' || texto === 'mat' || texto === 'matutino' || texto === 'manana') return 'matutino'
  if (texto === 'v' || texto === 'ves' || texto === 'vespertino' || texto === 'tarde') return 'vespertino'
  return turnoValido(texto) ? texto : ''
}

function estadoDe(value: string): EstadoPersona | '' {
  const texto = clave(value)
  if (!texto || texto === 'activo' || texto === 'activa') return 'activo'
  if (texto === 'inactivo' || texto === 'inactiva' || texto === 'baja') return 'inactivo'
  return ''
}

function numeroEmpleadoDe(value: string) {
  const limpio = value.trim().toUpperCase().replace(/\s+/g, '')
  if (/^\d{3,6}$/.test(limpio)) return `EMP-${limpio}`
  return limpio
}

function leerTabla(contenido: string, requeridas: string[], mapa: Record<string, string>) {
  const limpio = contenido.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  const lineas = limpio.split('\n').filter((linea) => linea.trim() && !linea.trim().toLowerCase().startsWith('sep='))
  const errores: ErrorCarga[] = []
  if (lineas.length < 2) {
    errores.push({ linea: 1, message: 'El archivo necesita el encabezado y al menos una fila.' })
    return { columnas: [] as string[], filas: [] as string[][], errores, separador: ',' }
  }
  const separador = (lineas[0].match(/;/g) ?? []).length > (lineas[0].match(/,/g) ?? []).length ? ';' : ','
  const columnas = partirLinea(lineas[0], separador).map((celda) => mapa[clave(celda)] ?? '')
  if (requeridas.some((campo) => !columnas.includes(campo))) {
    errores.push({ linea: 1, message: 'Revisa que la primera fila traiga los nombres de las columnas.' })
    return { columnas, filas: [] as string[][], errores, separador }
  }
  const filas = lineas.slice(1).map((linea) => partirLinea(linea, separador))
  return { columnas, filas, errores, separador }
}

function valorDe(columnas: string[], celdas: string[], campo: string) {
  const posicion = columnas.indexOf(campo)
  return posicion >= 0 ? (celdas[posicion] ?? '').trim() : ''
}

const COLUMNAS_MAESTRO: Record<string, string> = {
  numeroempleado: 'numeroEmpleado',
  empleado: 'numeroEmpleado',
  noempleado: 'numeroEmpleado',
  numero: 'numeroEmpleado',
  nombre: 'nombre',
  nombrecompleto: 'nombre',
  maestro: 'nombre',
  correo: 'correo',
  email: 'correo',
  turno: 'turno',
  estado: 'estado',
}

export function leerCsvMaestros(contenido: string, idNuevo: () => string) {
  const tabla = leerTabla(contenido, ['numeroEmpleado', 'nombre', 'correo', 'turno'], COLUMNAS_MAESTRO)
  const filas: MaestroCarga[] = []
  const errores = [...tabla.errores]
  if (errores.length && !tabla.filas.length) return { filas, errores }
  const vistos = new Set<string>()
  tabla.filas.forEach((celdas, indice) => {
    const linea = indice + 2
    const numeroEmpleado = numeroEmpleadoDe(valorDe(tabla.columnas, celdas, 'numeroEmpleado'))
    const nombre = valorDe(tabla.columnas, celdas, 'nombre').replace(/\s+/g, ' ')
    const correo = valorDe(tabla.columnas, celdas, 'correo').toLowerCase()
    const turnoId = turnoDe(valorDe(tabla.columnas, celdas, 'turno'))
    const estadoEscrito = estadoDe(valorDe(tabla.columnas, celdas, 'estado'))
    if (!numeroEmpleado && !nombre) return
    if (!/^EMP-\d{3,6}$/.test(numeroEmpleado)) {
      errores.push({ linea, message: `${numeroEmpleado || 'Sin número'}: usa el formato EMP-0000.` })
      return
    }
    if (vistos.has(numeroEmpleado)) {
      errores.push({ linea, message: `${numeroEmpleado} está repetido en el archivo.` })
      return
    }
    vistos.add(numeroEmpleado)
    if (nombre.length < 5 || !nombre.includes(' ')) {
      errores.push({ linea, message: `${numeroEmpleado}: escribe el nombre completo.` })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      errores.push({ linea, message: `${numeroEmpleado}: escribe un correo válido.` })
      return
    }
    if (!turnoId) {
      errores.push({ linea, message: `${numeroEmpleado}: el turno debe ser matutino o vespertino.` })
      return
    }
    if (valorDe(tabla.columnas, celdas, 'estado') && !estadoEscrito) {
      errores.push({ linea, message: `${numeroEmpleado}: el estado debe ser activo o inactivo.` })
      return
    }
    filas.push({ id: idNuevo(), numeroEmpleado, nombre, correo, turnoId, estado: estadoEscrito || 'activo' })
  })
  if (!filas.length && !errores.length) errores.push({ linea: 1, message: 'No hay maestros para cargar.' })
  return { filas, errores }
}

const COLUMNAS_MATERIA: Record<string, string> = {
  clave: 'clave',
  materia: 'nombre',
  nombre: 'nombre',
  semestre: 'semestre',
  grupo: 'grupo',
  turno: 'turno',
  maestro: 'maestro',
  empleado: 'maestro',
  numeroempleado: 'maestro',
}

export function leerCsvMaterias(
  contenido: string,
  maestros: { id: string; numeroEmpleado: string; nombre: string }[],
  idNuevo: () => string,
) {
  const tabla = leerTabla(contenido, ['clave', 'nombre', 'semestre', 'grupo', 'turno', 'maestro'], COLUMNAS_MATERIA)
  const filas: MateriaCarga[] = []
  const errores = [...tabla.errores]
  if (errores.length && !tabla.filas.length) return { filas, errores }
  const vistos = new Set<string>()
  tabla.filas.forEach((celdas, indice) => {
    const linea = indice + 2
    const codigo = valorDe(tabla.columnas, celdas, 'clave').toUpperCase().replace(/\s+/g, '')
    const nombre = valorDe(tabla.columnas, celdas, 'nombre').replace(/\s+/g, ' ')
    const semestre = Number(valorDe(tabla.columnas, celdas, 'semestre'))
    const grupo = valorDe(tabla.columnas, celdas, 'grupo').toUpperCase()
    const turnoId = turnoDe(valorDe(tabla.columnas, celdas, 'turno'))
    const maestroTexto = valorDe(tabla.columnas, celdas, 'maestro')
    if (!codigo && !nombre) return
    if (!/^[A-Z]{2,5}-\d{3}$/.test(codigo)) {
      errores.push({ linea, message: `${codigo || 'Sin clave'}: usa una clave como INF-101.` })
      return
    }
    if (nombre.length < 3) {
      errores.push({ linea, message: `${codigo}: escribe el nombre de la materia.` })
      return
    }
    if (!semestreValido(semestre)) {
      errores.push({ linea, message: `${codigo}: el semestre debe estar entre 1 y 6.` })
      return
    }
    if (!grupoValido(grupo)) {
      errores.push({ linea, message: `${codigo}: el grupo debe ser una letra de la A a la F.` })
      return
    }
    if (!turnoId) {
      errores.push({ linea, message: `${codigo}: el turno debe ser matutino o vespertino.` })
      return
    }
    const marca = `${codigo}|${semestre}|${grupo}|${turnoId}`
    if (vistos.has(marca)) {
      errores.push({ linea, message: `${codigo} ${semestre}° ${grupo} está repetida en el archivo.` })
      return
    }
    vistos.add(marca)
    const empleado = numeroEmpleadoDe(maestroTexto)
    const porNumero = maestros.find((maestro) => maestro.numeroEmpleado.toUpperCase() === empleado)
    const porNombre = maestros.filter((maestro) => clave(maestro.nombre) === clave(maestroTexto))
    const maestro = porNumero ?? (porNombre.length === 1 ? porNombre[0] : undefined)
    if (!maestro) {
      errores.push({ linea, message: `${codigo}: no encontré al maestro ${maestroTexto || '(vacío)'}. Usa su número EMP-0000.` })
      return
    }
    filas.push({ id: idNuevo(), clave: codigo, nombre, semestre, grupo, turnoId, maestroId: maestro.id })
  })
  if (!filas.length && !errores.length) errores.push({ linea: 1, message: 'No hay materias para cargar.' })
  return { filas, errores }
}
