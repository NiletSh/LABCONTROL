import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { construirInforme, hechosLaboratorio, leerFiltros, leerMembrete, vistaDe } from '../../shared/informes.ts'
import type { FormatoInforme } from '../../shared/informes.ts'
import { leerSolicitudInstitucional, redactarInstitucional, TIPOS_INSTITUCIONALES } from '../../shared/institucional.ts'
import { permisoDeOperacion, puede } from '../../shared/permisos.ts'
import { cambiarClave, cerrar, entrar, leerDatos, operar, sesionDe } from './almacen.ts'
import { usaTidb } from './tidb.ts'
import { construirControlExcel } from './control-excel.ts'
import { exportarDocumento, exportarInforme, leerLogo, nombreArchivo, tipoContenido } from './documentos.ts'
import { construirExcel } from './excel.ts'

dotenv.config()

const app = express()
const port = Number(process.env.PORT) || 4000

app.use(cors())
app.use(express.json({ limit: '4mb' }))

app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    servicio: 'LAB CONTROL API',
    fuente: 'mysql',
    mysql: usaTidb(),
    persistido: true,
  })
})

app.post('/api/sesion/entrar', async (req, res) => {
  try {
    const correo = typeof req.body?.correo === 'string' ? req.body.correo : ''
    const clave = typeof req.body?.clave === 'string' ? req.body.clave : ''
    const resultado = await entrar(correo, clave)
    if (!resultado.ok) {
      res.status(401).json(resultado)
      return
    }
    res.json(resultado)
  } catch (error) {
    console.error(error)
    res.status(503).json({ ok: false, message: 'No hay conexión con la base de datos.' })
  }
})

app.post('/api/sesion/cerrar', async (req, res) => {
  const sesion = await exigir(req, res, '')
  if (!sesion) return
  await cerrar(sesion.token)
  res.json({ ok: true })
})

app.post('/api/sesion/clave', async (req, res) => {
  const sesion = await exigir(req, res, '')
  if (!sesion) return
  const nueva = typeof req.body?.nueva === 'string' ? req.body.nueva : ''
  const actual = typeof req.body?.actual === 'string' ? req.body.actual : ''
  const resultado = await cambiarClave(sesion.usuario.id, nueva, actual)
  res.status(resultado.ok ? 200 : 400).json(resultado)
})

app.get('/api/bootstrap', async (req, res) => {
  const sesion = await exigir(req, res, '')
  if (!sesion) return
  res.json({ data: await leerDatos(), usuario: sesion.usuario, debeCambiar: sesion.debeCambiar })
})

app.post('/api/operacion', async (req, res) => {
  const tipo = typeof req.body?.tipo === 'string' ? req.body.tipo : ''
  const permiso = permisoDeOperacion(tipo)
  const sesion = await exigir(req, res, permiso && tipo !== 'usuario' ? permiso : '')
  if (!sesion) return
  if (permiso && tipo !== 'usuario' && !puede(sesion.rol, permiso)) {
    res.status(403).json({ ok: false, message: 'No tienes permiso para esta acción.' })
    return
  }
  if (!permiso) {
    res.status(400).json({ ok: false, message: 'Operación no reconocida.' })
    return
  }
  const datos = req.body?.datos && typeof req.body.datos === 'object' ? req.body.datos as Record<string, unknown> : {}
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((item: unknown) => typeof item === 'string') : []
  const accion = typeof req.body?.accion === 'string' ? req.body.accion : tipo
  try {
    const resultado = await operar(sesion, tipo, datos, ids, accion)
    if (!resultado.ok) {
      res.status(resultado.status).json(resultado.revision ?? { ok: false, message: resultado.message, errors: [{ field: 'form', message: resultado.message }] })
      return
    }
    res.json({ ok: true, message: resultado.message, data: resultado.data, claveTemporal: resultado.claveTemporal })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo guardar.'
    res.status(400).json({ ok: false, message })
  }
})

app.post('/api/informes/institucional', async (req, res) => {
  try {
    if (!(await exigir(req, res, 'reportes'))) return
    const solicitud = leerSolicitudInstitucional(req.body?.institucional)
    if (!solicitud) {
      res.status(400).json({ ok: false, persistido: true, message: 'Elige el tipo de informe.' })
      return
    }
    const demo = await leerDatos()
    const titulo = TIPOS_INSTITUCIONALES.find((item) => item.id === solicitud.tipo)?.nombre ?? 'Informe de laboratorio'
    const documento = redactarInstitucional(
      hechosLaboratorio(demo, leerFiltros(req.body?.filtros, demo.meta.escenarioFecha)),
      solicitud,
      leerMembrete(req.body?.membrete, titulo),
    )
    res.json(documento)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo preparar el informe.'
    res.status(400).json({ ok: false, persistido: false, message })
  }
})

app.post('/api/informes/vista', async (req, res) => {
  try {
    if (!(await exigir(req, res, 'reportes'))) return
    const demo = await leerDatos()
    const id = typeof req.body?.id === 'string' ? req.body.id : ''
    const informe = construirInforme(demo, id, leerFiltros(req.body?.filtros, demo.meta.escenarioFecha))
    res.json(vistaDe(informe))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo preparar el reporte.'
    res.status(400).json({ ok: false, persistido: false, message })
  }
})

app.post('/api/informes/archivo', async (req, res) => {
  try {
    if (!(await exigir(req, res, 'reportes'))) return
    const formato = req.body?.formato
    if (!esFormato(formato)) {
      res.status(400).json({ ok: false, persistido: false, message: 'Elige Excel, PDF, Word o CSV.' })
      return
    }
    const demo = await leerDatos()
    const solicitud = leerSolicitudInstitucional(req.body?.institucional)
    if (solicitud) {
      const titulo = TIPOS_INSTITUCIONALES.find((item) => item.id === solicitud.tipo)?.nombre ?? 'Informe de laboratorio'
      const membrete = leerMembrete(req.body?.membrete, titulo)
      const filtros = leerFiltros(req.body?.filtros, demo.meta.escenarioFecha)
      const hechos = hechosLaboratorio(demo, filtros)
      const creado = new Date().toLocaleString('es-MX')
      if (formato === 'xlsx') {
        const buffer = await construirControlExcel(hechos, membrete, creado)
        res.setHeader('Content-Type', tipoContenido(formato))
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(solicitud.tipo, formato)}"`)
        res.send(buffer)
        return
      }
      const documento = redactarInstitucional(hechos, solicitud, membrete)
      const logo = formato === 'pdf' || formato === 'docx' ? leerLogo(req.body?.logo) : null
      const buffer = await exportarDocumento(documento, formato, logo, creado)
      res.setHeader('Content-Type', tipoContenido(formato))
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(solicitud.tipo, formato)}"`)
      res.send(buffer)
      return
    }
    const id = typeof req.body?.id === 'string' ? req.body.id : ''
    const informe = construirInforme(demo, id, leerFiltros(req.body?.filtros, demo.meta.escenarioFecha))
    if (informe.filas.length > 8000) throw new Error('El reporte supera los 8000 registros. Reduce el periodo.')
    const membrete = leerMembrete(req.body?.membrete, informe.nombre)
    const logo = formato === 'pdf' || formato === 'docx' ? leerLogo(req.body?.logo) : null
    const creado = new Date().toLocaleString('es-MX')
    const buffer = await exportarInforme(informe, formato, membrete, logo, creado)
    const filename = nombreArchivo(informe.id, formato)
    res.setHeader('Content-Type', tipoContenido(formato))
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo generar el archivo.'
    res.status(400).json({ ok: false, persistido: false, message })
  }
})

app.post('/api/reportes/excel', async (req, res) => {
  try {
    if (!(await exigir(req, res, 'reportes'))) return
    const { buffer, filename } = await construirExcel(req.body)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(buffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo generar el archivo.'
    res.status(400).json({ ok: false, persistido: false, message })
  }
})

async function exigir(req: express.Request, res: express.Response, permiso: string) {
  const header = req.header('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const sesion = await sesionDe(token)
  if (!sesion) {
    res.status(401).json({ ok: false, message: 'Inicia sesión de nuevo.' })
    return null
  }
  if (permiso && !puede(sesion.rol, permiso)) {
    res.status(403).json({ ok: false, message: 'No tienes permiso para esta función.' })
    return null
  }
  return sesion
}

function esFormato(value: unknown): value is FormatoInforme {
  return value === 'xlsx' || value === 'pdf' || value === 'docx' || value === 'csv'
}

if (!process.env.VERCEL) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`LAB CONTROL API en http://localhost:${port}`)
    console.log(usaTidb() ? 'Fuente: MySQL. Los cambios se guardan en la base de la nube.' : 'Faltan DB_HOST, DB_USER, DB_PASSWORD y DB_NAME. La API no abre otra base.')
  })
}

export default app
