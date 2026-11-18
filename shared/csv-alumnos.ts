import { esExpedienteDePrueba, semestrePorControl, turnoValido } from './academico.ts'
import { matriculaValida } from './credencial.ts'
import type { EstadoAlumno, TurnoId } from './types.ts'

export interface AlumnoCarga {
  id: string
  matricula: string
  nombre: string
  plantel: string
  semestre: number
  grupo: string
  turnoId: TurnoId
  estado: EstadoAlumno
}

export interface ErrorCarga {
  linea: number
  message: string
}

const COLUMNAS: Record<string, 'matricula' | 'nombre' | 'plantel' | 'semestre' | 'grupo' | 'turno' | 'estado'> = {
  matricula: 'matricula',
  expediente: 'matricula',
  nocontrol: 'matricula',
  numerodecontrol: 'matricula',
  numerocontrol: 'matricula',
  control: 'matricula',
  nombre: 'nombre',
  nombrecompleto: 'nombre',
  alumno: 'nombre',
  plantel: 'plantel',
  semestre: 'semestre',
  grupo: 'grupo',
  turno: 'turno',
  estado: 'estado',
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

function estadoDe(value: string): EstadoAlumno | '' {
  const texto = clave(value)
  if (!texto || texto === 'activo' || texto === 'activa') return 'activo'
  if (texto === 'inactivo' || texto === 'inactiva' || texto === 'baja') return 'inactivo'
  return ''
}

export function leerCsvAlumnos(contenido: string, fechaIso: string, idNuevo: () => string) {
  const limpio = contenido.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  const lineas = limpio.split('\n').filter((linea) => linea.trim() && !linea.trim().toLowerCase().startsWith('sep='))
  const errores: ErrorCarga[] = []
  const filas: AlumnoCarga[] = []
  if (lineas.length < 2) {
    errores.push({ linea: 1, message: 'El archivo necesita el encabezado y al menos un alumno.' })
    return { filas, errores }
  }
  const encabezado = lineas[0]
  const separador = (encabezado.match(/;/g) ?? []).length > (encabezado.match(/,/g) ?? []).length ? ';' : ','
  const columnas = partirLinea(encabezado, separador).map((celda) => COLUMNAS[clave(celda)] ?? '')
  if (!columnas.includes('matricula') || !columnas.includes('nombre') || !columnas.includes('grupo') || !columnas.includes('turno')) {
    errores.push({ linea: 1, message: 'El encabezado debe incluir matrícula, nombre, grupo y turno.' })
    return { filas, errores }
  }
  const vistas = new Set<string>()
  for (let indice = 1; indice < lineas.length; indice += 1) {
    const linea = indice + 1
    const celdas = partirLinea(lineas[indice], separador)
    const valor = (campo: typeof columnas[number]) => {
      const posicion = columnas.indexOf(campo)
      return posicion >= 0 ? (celdas[posicion] ?? '').trim() : ''
    }
    const matricula = valor('matricula').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    const nombre = valor('nombre').replace(/\s+/g, ' ').trim()
    const grupo = valor('grupo').toUpperCase()
    const turnoId = turnoDe(valor('turno'))
    const estadoEscrito = estadoDe(valor('estado'))
    if (!matricula && !nombre) continue
    if (!matriculaValida(matricula)) {
      errores.push({ linea, message: `La matrícula ${valor('matricula') || '(vacía)'} no es válida.` })
      continue
    }
    if (vistas.has(matricula)) {
      errores.push({ linea, message: `La matrícula ${matricula} está repetida en el archivo.` })
      continue
    }
    vistas.add(matricula)
    if (nombre.length < 5 || !nombre.includes(' ')) {
      errores.push({ linea, message: `${matricula}: escribe el nombre completo.` })
      continue
    }
    if (!/^[A-F]$/.test(grupo)) {
      errores.push({ linea, message: `${matricula}: el grupo debe ser una letra de la A a la F.` })
      continue
    }
    if (!turnoId) {
      errores.push({ linea, message: `${matricula}: el turno debe ser matutino o vespertino.` })
      continue
    }
    if (valor('estado') && !estadoEscrito) {
      errores.push({ linea, message: `${matricula}: el estado debe ser activo o inactivo.` })
      continue
    }
    let semestre = Number(valor('semestre'))
    let estado: EstadoAlumno = estadoEscrito || 'activo'
    if (!valor('semestre')) {
      const calculo = semestrePorControl(matricula, fechaIso)
      if (!calculo) {
        errores.push({ linea, message: `${matricula}: indica el semestre o usa un número de control con el año de ingreso.` })
        continue
      }
      semestre = calculo.semestre
      if (calculo.concluido && !estadoEscrito && !esExpedienteDePrueba(matricula)) estado = 'inactivo'
    } else if (!Number.isInteger(semestre) || semestre < 1 || semestre > 6) {
      errores.push({ linea, message: `${matricula}: el semestre debe estar entre 1 y 6.` })
      continue
    }
    filas.push({
      id: idNuevo(),
      matricula,
      nombre,
      plantel: valor('plantel'),
      semestre,
      grupo,
      turnoId,
      estado,
    })
  }
  if (!filas.length && !errores.length) errores.push({ linea: 1, message: 'No hay alumnos para cargar.' })
  return { filas, errores }
}
