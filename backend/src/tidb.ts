import mysql from 'mysql2/promise'
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise'
import { ESCENARIO_FECHA, getDemo, HORA_REFERENCIA } from '../../shared/demo.ts'
import type { DemoData, Incidencia, Maestro } from '../../shared/types.ts'
import { hashClave } from './claves.ts'

const CLAVES_SEMILLA: Record<string, string> = {
  'usr-andrea': 'Admin2026',
  'usr-sayle': 'Admin2026',
  'usr-hector': 'Lab2026',
  'usr-claudia': 'Lab2026',
}

export function configuracionTidb() {
  const host = process.env.DB_HOST || process.env.HOST || ''
  const user = process.env.DB_USER || process.env.USERNAME || ''
  const password = process.env.DB_PASSWORD || process.env.PASSWORD || ''
  const database = process.env.DB_NAME || process.env.DATABASE || ''
  const port = Number(process.env.DB_PORT || 4000)
  if (!host || !user || !password || !database || !Number.isFinite(port)) return null
  if (!/^[A-Za-z0-9_]+$/.test(database)) return null
  return { host, user, password, database, port }
}

export function usaTidb() {
  return configuracionTidb() !== null
}

let pool: Pool | null = null
let listo: Promise<void> | null = null

function conexion() {
  const cfg = configuracionTidb()
  if (!cfg) throw new Error('Faltan los datos de MySQL.')
  if (!pool) {
    pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      dateStrings: true,
      waitForConnections: true,
      connectionLimit: 3,
      connectTimeout: 20000,
      charset: 'utf8mb4',
    })
  }
  return pool
}

async function preparar() {
  if (!listo) listo = crearEsquema().catch((error) => {
    listo = null
    throw error
  })
  await listo
}

async function crearEsquema() {
  const cfg = configuracionTidb()
  if (!cfg) return
  const admin = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectTimeout: 20000,
  })
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await admin.end()

  const db = conexion()
  for (const sentencia of ESQUEMA.split(';').map((item) => item.trim()).filter(Boolean)) {
    await db.query(sentencia)
  }
  const [cuentas] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM usuario')
  const [turnos] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM turno')
  const [alumnos] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM alumno')
  const sinCatalogo = Number(turnos[0]?.total ?? 0) === 0 && Number(alumnos[0]?.total ?? 0) === 0
  if (Number(cuentas[0]?.total ?? 0) === 0 || sinCatalogo) {
    const demo = getDemo()
    await escribir(demo)
    for (const usuario of demo.usuarios) {
      const clave = CLAVES_SEMILLA[usuario.id]
      if (!clave) continue
      const [ya] = await db.query<RowDataPacket[]>('SELECT usuario_id FROM clave WHERE usuario_id = ?', [usuario.id])
      if (!ya.length) await insertarClave(usuario.id, hashClave(clave), 0)
    }
  }
  const [existe] = await db.query<RowDataPacket[]>('SELECT id FROM usuario WHERE correo = ?', ['sayleonnieto8@gmail.com'])
  if (!existe.length) {
    await db.query(
      `INSERT INTO usuario (id, nombre, correo, rol, estado) VALUES ('usr-sayle', 'Sayle', 'sayleonnieto8@gmail.com', 'administrador', 'activo')`,
    )
    await insertarClave('usr-sayle', hashClave('Admin2026'), 0)
  }
}

export async function prepararBase() {
  await preparar()
}

export async function leerTidb() {
  await preparar()
  const db = conexion()
  const [meta] = await db.query<RowDataPacket[]>('SELECT * FROM meta WHERE id = 1')
  const [turnos] = await db.query<RowDataPacket[]>('SELECT * FROM turno')
  const [usuarios] = await db.query<RowDataPacket[]>('SELECT * FROM usuario')
  const [alumnos] = await db.query<RowDataPacket[]>('SELECT * FROM alumno')
  const [maestros] = await db.query<RowDataPacket[]>('SELECT * FROM maestro')
  const [maestroMaterias] = await db.query<RowDataPacket[]>('SELECT * FROM maestro_materia')
  const [materias] = await db.query<RowDataPacket[]>('SELECT * FROM materia')
  const [laboratorios] = await db.query<RowDataPacket[]>('SELECT * FROM laboratorio')
  const [equipos] = await db.query<RowDataPacket[]>('SELECT * FROM equipo')
  const [mantenimientos] = await db.query<RowDataPacket[]>('SELECT * FROM mantenimiento')
  const [sesiones] = await db.query<RowDataPacket[]>('SELECT * FROM sesion')
  const [ingresos] = await db.query<RowDataPacket[]>('SELECT * FROM ingreso')
  const [incidencias] = await db.query<RowDataPacket[]>('SELECT * FROM incidencia')
  const [seguimientos] = await db.query<RowDataPacket[]>('SELECT * FROM seguimiento_incidencia ORDER BY id')
  const [reservaciones] = await db.query<RowDataPacket[]>('SELECT * FROM reservacion')
  const [bitacora] = await db.query<RowDataPacket[]>('SELECT * FROM bitacora ORDER BY fecha_hora DESC')

  const materiasPorMaestro = new Map<string, string[]>()
  for (const fila of maestroMaterias) {
    const id = texto(fila.maestro_id)
    const lista = materiasPorMaestro.get(id) ?? []
    lista.push(texto(fila.materia))
    materiasPorMaestro.set(id, lista)
  }
  const historial = new Map<string, Incidencia['historial']>()
  for (const fila of seguimientos) {
    const id = texto(fila.incidencia_id)
    const lista = historial.get(id) ?? []
    lista.push({
      fechaHora: fechaHora(fila.fecha_hora),
      usuario: texto(fila.usuario),
      estado: texto(fila.estado) as Incidencia['estado'],
      nota: texto(fila.nota),
    })
    historial.set(id, lista)
  }
  const filaMeta = meta[0]
  const data: DemoData = {
    meta: {
      fuente: 'demostracion',
      persistido: true,
      escenarioFecha: fecha(filaMeta?.escenario_fecha) || ESCENARIO_FECHA,
      escenarioTexto: texto(filaMeta?.escenario_texto) || 'Martes 3 de noviembre de 2026, turno matutino',
      horaReferencia: hora(filaMeta?.hora_referencia) ?? HORA_REFERENCIA,
    },
    turnos: turnos.map((fila) => ({
      id: texto(fila.id) as DemoData['turnos'][number]['id'],
      nombre: texto(fila.nombre),
      horaInicio: hora(fila.hora_inicio),
      horaFin: hora(fila.hora_fin),
      configurado: Number(fila.configurado) === 1,
      origen: texto(fila.origen) as DemoData['turnos'][number]['origen'],
    })),
    usuarios: usuarios.map((fila) => ({
      id: texto(fila.id),
      nombre: texto(fila.nombre),
      correo: texto(fila.correo),
      rol: texto(fila.rol) as DemoData['usuarios'][number]['rol'],
      estado: texto(fila.estado) as DemoData['usuarios'][number]['estado'],
    })),
    alumnos: alumnos.map((fila) => ({
      id: texto(fila.id),
      matricula: texto(fila.matricula),
      nombre: texto(fila.nombre),
      plantel: opcional(fila.plantel),
      semestre: Number(fila.semestre),
      grupo: texto(fila.grupo),
      turnoId: texto(fila.turno_id) as DemoData['alumnos'][number]['turnoId'],
      estado: texto(fila.estado) as DemoData['alumnos'][number]['estado'],
    })),
    maestros: maestros.map((fila) => ({
      id: texto(fila.id),
      numeroEmpleado: texto(fila.numero_empleado),
      nombre: texto(fila.nombre),
      correo: texto(fila.correo),
      turnoId: texto(fila.turno_id) as Maestro['turnoId'],
      estado: texto(fila.estado) as Maestro['estado'],
      materias: materiasPorMaestro.get(texto(fila.id)) ?? [],
    })),
    materias: materias.map((fila) => ({
      id: texto(fila.id),
      clave: texto(fila.clave),
      nombre: texto(fila.nombre),
      semestre: Number(fila.semestre),
      grupo: texto(fila.grupo),
      turnoId: texto(fila.turno_id) as DemoData['materias'][number]['turnoId'],
      maestroId: texto(fila.maestro_id),
    })),
    laboratorios: laboratorios.map((fila) => ({
      id: texto(fila.id),
      nombre: texto(fila.nombre),
      ubicacion: texto(fila.ubicacion),
      descripcion: texto(fila.descripcion),
      capacidad: Number(fila.capacidad),
      cantidadEquipos: Number(fila.cantidad_equipos),
      estado: texto(fila.estado) as DemoData['laboratorios'][number]['estado'],
    })),
    equipos: equipos.map((fila) => ({
      id: texto(fila.id),
      laboratorioId: texto(fila.laboratorio_id),
      estado: texto(fila.estado) as DemoData['equipos'][number]['estado'],
      descripcion: texto(fila.descripcion),
      foto: opcional(fila.foto),
    })),
    mantenimientos: mantenimientos.map((fila) => ({
      id: texto(fila.id),
      equipoId: texto(fila.equipo_id),
      fecha: texto(fila.fecha).slice(0, 10),
      descripcion: texto(fila.descripcion),
      responsable: texto(fila.responsable),
    })),
    sesiones: sesiones.map((fila) => ({
      id: texto(fila.id),
      laboratorioId: texto(fila.laboratorio_id),
      maestroId: texto(fila.maestro_id),
      materiaId: texto(fila.materia_id),
      semestre: Number(fila.semestre),
      grupo: texto(fila.grupo),
      turnoId: texto(fila.turno_id) as DemoData['sesiones'][number]['turnoId'],
      fecha: texto(fila.fecha).slice(0, 10),
      horaInicio: hora(fila.hora_inicio) ?? '',
      horaFin: hora(fila.hora_fin) ?? '',
      estado: texto(fila.estado) as DemoData['sesiones'][number]['estado'],
    })),
    ingresos: ingresos.map((fila) => ({
      id: texto(fila.id),
      alumnoId: texto(fila.alumno_id),
      sesionId: texto(fila.sesion_id),
      fecha: texto(fila.fecha).slice(0, 10),
      hora: hora(fila.hora) ?? '',
    })),
    incidencias: incidencias.map((fila) => ({
      id: texto(fila.id),
      laboratorioId: texto(fila.laboratorio_id),
      equipoId: opcional(fila.equipo_id) ?? null,
      descripcion: texto(fila.descripcion),
      fechaHora: fechaHora(fila.fecha_hora),
      estado: texto(fila.estado) as Incidencia['estado'],
      reporta: texto(fila.reporta),
      tipo: opcional(fila.tipo),
      prioridad: opcional(fila.prioridad),
      detecto: opcional(fila.detecto),
      solucion: opcional(fila.solucion),
      reparo: opcional(fila.reparo),
      foto: opcional(fila.foto),
      historial: historial.get(texto(fila.id)) ?? [],
    })),
    reservaciones: reservaciones.map((fila) => ({
      id: texto(fila.id),
      laboratorioId: texto(fila.laboratorio_id),
      maestroId: texto(fila.maestro_id),
      materiaId: texto(fila.materia_id),
      grupo: texto(fila.grupo),
      fecha: texto(fila.fecha).slice(0, 10),
      horaInicio: hora(fila.hora_inicio) ?? '',
      horaFin: hora(fila.hora_fin) ?? '',
      estado: texto(fila.estado) as DemoData['reservaciones'][number]['estado'],
      motivo: opcional(fila.motivo),
    })),
    bitacora: bitacora.map((fila) => ({
      id: texto(fila.id),
      fechaHora: fechaHora(fila.fecha_hora),
      usuario: texto(fila.usuario),
      accion: texto(fila.accion),
      origen: texto(fila.origen) as DemoData['bitacora'][number]['origen'],
    })),
  }
  return data
}

export async function guardarTidb(data: DemoData) {
  await preparar()
  await escribir(data)
}

async function escribir(data: DemoData) {
  const db = await conexion().getConnection()
  try {
    await db.beginTransaction()
    await db.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const tabla of ['seguimiento_incidencia', 'incidencia', 'ingreso', 'reservacion', 'sesion', 'mantenimiento', 'equipo', 'maestro_materia', 'materia', 'laboratorio', 'alumno', 'bitacora', 'maestro', 'turno', 'meta']) {
      await db.query(`DELETE FROM ${tabla}`)
    }
    await insertar(db, 'INSERT INTO turno (id, nombre, hora_inicio, hora_fin, configurado, origen) VALUES ', data.turnos.map((item) => [
      item.id, item.nombre, horaSql(item.horaInicio), horaSql(item.horaFin), item.configurado ? 1 : 0, item.origen,
    ]))
    for (const item of data.usuarios) {
      await db.query(
        `INSERT INTO usuario (id, nombre, correo, rol, estado) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), correo = VALUES(correo), rol = VALUES(rol), estado = VALUES(estado)`,
        [item.id, item.nombre, item.correo, item.rol, item.estado],
      )
    }
    await insertar(db, 'INSERT INTO alumno (id, matricula, nombre, plantel, semestre, grupo, turno_id, estado) VALUES ', data.alumnos.map((item) => [
      item.id, item.matricula, item.nombre, item.plantel || null, item.semestre, item.grupo, item.turnoId, item.estado,
    ]))
    await insertar(db, 'INSERT INTO maestro (id, numero_empleado, nombre, correo, turno_id, estado) VALUES ', data.maestros.map((item) => [
      item.id, item.numeroEmpleado, item.nombre, item.correo, item.turnoId, item.estado,
    ]))
    await insertar(db, 'INSERT INTO maestro_materia (maestro_id, materia) VALUES ', data.maestros.flatMap((item) => (item.materias ?? []).map((materia) => [item.id, materia])))
    await insertar(db, 'INSERT INTO materia (id, clave, nombre, semestre, grupo, turno_id, maestro_id) VALUES ', data.materias.map((item) => [
      item.id, item.clave, item.nombre, item.semestre, item.grupo, item.turnoId, item.maestroId,
    ]))
    await insertar(db, 'INSERT INTO laboratorio (id, nombre, ubicacion, descripcion, capacidad, cantidad_equipos, estado) VALUES ', data.laboratorios.map((item) => [
      item.id, item.nombre, item.ubicacion, item.descripcion, item.capacidad, item.cantidadEquipos, item.estado,
    ]))
    await insertar(db, 'INSERT INTO equipo (id, laboratorio_id, estado, descripcion, foto) VALUES ', data.equipos.map((item) => [
      item.id, item.laboratorioId, item.estado, item.descripcion, item.foto || null,
    ]))
    await insertar(db, 'INSERT INTO mantenimiento (id, equipo_id, fecha, descripcion, responsable) VALUES ', data.mantenimientos.map((item) => [
      item.id, item.equipoId, item.fecha, item.descripcion, item.responsable,
    ]))
    await insertar(db, 'INSERT INTO sesion (id, laboratorio_id, maestro_id, materia_id, semestre, grupo, turno_id, fecha, hora_inicio, hora_fin, estado) VALUES ', data.sesiones.map((item) => [
      item.id, item.laboratorioId, item.maestroId, item.materiaId, item.semestre, item.grupo, item.turnoId, item.fecha, horaSql(item.horaInicio), horaSql(item.horaFin), item.estado,
    ]))
    await insertar(db, 'INSERT INTO ingreso (id, alumno_id, sesion_id, fecha, hora) VALUES ', data.ingresos.map((item) => [
      item.id, item.alumnoId, item.sesionId, item.fecha, horaSql(item.hora),
    ]))
    await insertar(db, 'INSERT INTO incidencia (id, laboratorio_id, equipo_id, descripcion, fecha_hora, estado, reporta, tipo, prioridad, detecto, solucion, reparo, foto) VALUES ', data.incidencias.map((item) => [
      item.id, item.laboratorioId, item.equipoId, item.descripcion, fechaHoraSql(item.fechaHora), item.estado, item.reporta, item.tipo || null, item.prioridad || null, item.detecto || null, item.solucion || null, item.reparo || null, item.foto || null,
    ]))
    await insertar(db, 'INSERT INTO seguimiento_incidencia (incidencia_id, fecha_hora, usuario, estado, nota) VALUES ', data.incidencias.flatMap((item) => (item.historial ?? []).map((nota) => [
      item.id, fechaHoraSql(nota.fechaHora), nota.usuario, nota.estado, nota.nota,
    ])))
    await insertar(db, 'INSERT INTO reservacion (id, laboratorio_id, maestro_id, materia_id, grupo, fecha, hora_inicio, hora_fin, estado, motivo) VALUES ', data.reservaciones.map((item) => [
      item.id, item.laboratorioId, item.maestroId, item.materiaId, item.grupo, item.fecha, horaSql(item.horaInicio), horaSql(item.horaFin), item.estado, item.motivo || null,
    ]))
    await insertar(db, 'INSERT INTO bitacora (id, fecha_hora, usuario, accion, origen) VALUES ', data.bitacora.map((item) => [
      item.id, fechaHoraSql(item.fechaHora), item.usuario, item.accion, item.origen,
    ]))
    await db.query(
      `INSERT INTO meta (id, fuente, persistido, escenario_fecha, escenario_texto, hora_referencia) VALUES (1, ?, 1, ?, ?, ?)
       ON DUPLICATE KEY UPDATE fuente = VALUES(fuente), persistido = 1, escenario_fecha = VALUES(escenario_fecha), escenario_texto = VALUES(escenario_texto), hora_referencia = VALUES(hora_referencia)`,
      [data.meta.fuente || 'demostracion', fechaSql(data.meta.escenarioFecha) ?? ESCENARIO_FECHA, data.meta.escenarioTexto || 'Martes 3 de noviembre de 2026, turno matutino', horaSql(data.meta.horaReferencia) ?? `${HORA_REFERENCIA}:00`],
    )
    await db.query('SET FOREIGN_KEY_CHECKS = 1')
    await db.commit()
  } catch (error) {
    await db.rollback()
    throw error
  } finally {
    db.release()
  }
}

export async function claveTidb(usuarioId: string) {
  await preparar()
  const [filas] = await conexion().query<RowDataPacket[]>('SELECT hash, debe_cambiar FROM clave WHERE usuario_id = ?', [usuarioId])
  const fila = filas[0]
  if (!fila) return undefined
  return { hash: texto(fila.hash), debe_cambiar: Number(fila.debe_cambiar) }
}

export async function guardarClave(usuarioId: string, hash: string, debeCambiar: number) {
  await preparar()
  await insertarClave(usuarioId, hash, debeCambiar)
}

async function insertarClave(usuarioId: string, hash: string, debeCambiar: number) {
  await conexion().query(
    `INSERT INTO clave (usuario_id, hash, debe_cambiar) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE hash = VALUES(hash), debe_cambiar = VALUES(debe_cambiar)`,
    [usuarioId, hash, debeCambiar],
  )
}

export async function crearAcceso(token: string, usuarioId: string) {
  await preparar()
  await conexion().query('INSERT INTO acceso (token, usuario_id, creado) VALUES (?, ?, ?)', [token, usuarioId, new Date().toISOString().slice(0, 19).replace('T', ' ')])
}

export async function borrarAcceso(token: string) {
  await preparar()
  await conexion().query('DELETE FROM acceso WHERE token = ?', [token])
}

export async function usuarioDeToken(token: string) {
  await preparar()
  const [filas] = await conexion().query<RowDataPacket[]>('SELECT usuario_id FROM acceso WHERE token = ?', [token])
  return filas[0] ? texto(filas[0].usuario_id) : undefined
}

export async function revocarTidb(usuarioId: string, conservarToken?: string) {
  await preparar()
  if (conservarToken) await conexion().query('DELETE FROM acceso WHERE usuario_id = ? AND token != ?', [usuarioId, conservarToken])
  else await conexion().query('DELETE FROM acceso WHERE usuario_id = ?', [usuarioId])
}

async function insertar(db: Pool | PoolConnection, inicio: string, filas: unknown[][]) {
  if (!filas.length) return
  const marca = `(${new Array(filas[0].length).fill('?').join(', ')})`
  for (let i = 0; i < filas.length; i += 80) {
    const grupo = filas.slice(i, i + 80)
    await db.query(inicio + grupo.map(() => marca).join(', '), grupo.flat())
  }
}

function texto(value: unknown) {
  return value == null ? '' : String(value)
}

function opcional(value: unknown) {
  if (value == null || value === '') return undefined
  return String(value)
}

function hora(value: unknown) {
  if (value == null || value === '') return null
  return String(value).slice(0, 5)
}

function horaSql(value: string | null) {
  if (!value) return null
  return value.length === 5 ? `${value}:00` : value
}

function fecha(value: unknown) {
  const match = texto(value).match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

function fechaSql(value: string | null | undefined) {
  return fecha(value) || null
}

function fechaHora(value: unknown) {
  return texto(value).replace(' ', 'T').slice(0, 19)
}

function fechaHoraSql(value: string) {
  return value.replace('T', ' ').slice(0, 19)
}

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS turno (
  id VARCHAR(20) PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  hora_inicio TIME NULL,
  hora_fin TIME NULL,
  configurado TINYINT(1) NOT NULL DEFAULT 0,
  origen VARCHAR(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS usuario (
  id VARCHAR(40) PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  correo VARCHAR(180) NOT NULL,
  rol VARCHAR(20) NOT NULL,
  estado VARCHAR(20) NOT NULL,
  UNIQUE KEY usuario_correo_uk (correo)
);
CREATE TABLE IF NOT EXISTS clave (
  usuario_id VARCHAR(40) PRIMARY KEY,
  hash VARCHAR(200) NOT NULL,
  debe_cambiar TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT clave_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuario (id)
);
CREATE TABLE IF NOT EXISTS acceso (
  token VARCHAR(80) PRIMARY KEY,
  usuario_id VARCHAR(40) NOT NULL,
  creado DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS alumno (
  id VARCHAR(40) PRIMARY KEY,
  matricula VARCHAR(40) NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  plantel VARCHAR(160) NULL,
  semestre TINYINT NOT NULL,
  grupo CHAR(1) NOT NULL,
  turno_id VARCHAR(20) NOT NULL,
  estado VARCHAR(20) NOT NULL,
  UNIQUE KEY alumno_matricula_uk (matricula)
);
CREATE TABLE IF NOT EXISTS maestro (
  id VARCHAR(40) PRIMARY KEY,
  numero_empleado VARCHAR(40) NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  correo VARCHAR(180) NOT NULL,
  turno_id VARCHAR(20) NOT NULL,
  estado VARCHAR(20) NOT NULL,
  UNIQUE KEY maestro_empleado_uk (numero_empleado),
  UNIQUE KEY maestro_correo_uk (correo)
);
CREATE TABLE IF NOT EXISTS maestro_materia (
  maestro_id VARCHAR(40) NOT NULL,
  materia VARCHAR(180) NOT NULL,
  PRIMARY KEY (maestro_id, materia)
);
CREATE TABLE IF NOT EXISTS materia (
  id VARCHAR(40) PRIMARY KEY,
  clave VARCHAR(40) NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  semestre TINYINT NOT NULL,
  grupo CHAR(1) NOT NULL,
  turno_id VARCHAR(20) NOT NULL,
  maestro_id VARCHAR(40) NOT NULL,
  UNIQUE KEY materia_grupo_uk (clave, semestre, grupo, turno_id)
);
CREATE TABLE IF NOT EXISTS laboratorio (
  id VARCHAR(40) PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  ubicacion VARCHAR(180) NOT NULL,
  descripcion TEXT NOT NULL,
  capacidad INT NOT NULL,
  cantidad_equipos INT NOT NULL,
  estado VARCHAR(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS equipo (
  id VARCHAR(40) PRIMARY KEY,
  laboratorio_id VARCHAR(40) NOT NULL,
  estado VARCHAR(30) NOT NULL,
  descripcion TEXT NOT NULL,
  foto LONGTEXT NULL
);
CREATE TABLE IF NOT EXISTS mantenimiento (
  id VARCHAR(40) PRIMARY KEY,
  equipo_id VARCHAR(40) NOT NULL,
  fecha DATE NOT NULL,
  descripcion TEXT NOT NULL,
  responsable VARCHAR(160) NOT NULL
);
CREATE TABLE IF NOT EXISTS sesion (
  id VARCHAR(80) PRIMARY KEY,
  laboratorio_id VARCHAR(40) NOT NULL,
  maestro_id VARCHAR(40) NOT NULL,
  materia_id VARCHAR(40) NOT NULL,
  semestre TINYINT NOT NULL,
  grupo CHAR(1) NOT NULL,
  turno_id VARCHAR(20) NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado VARCHAR(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS ingreso (
  id VARCHAR(40) PRIMARY KEY,
  alumno_id VARCHAR(40) NOT NULL,
  sesion_id VARCHAR(80) NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  UNIQUE KEY ingreso_unico_por_sesion (alumno_id, sesion_id)
);
CREATE TABLE IF NOT EXISTS incidencia (
  id VARCHAR(40) PRIMARY KEY,
  laboratorio_id VARCHAR(40) NOT NULL,
  equipo_id VARCHAR(40) NULL,
  descripcion TEXT NOT NULL,
  fecha_hora DATETIME NOT NULL,
  estado VARCHAR(20) NOT NULL,
  reporta VARCHAR(160) NOT NULL,
  tipo VARCHAR(40) NULL,
  prioridad VARCHAR(20) NULL,
  detecto VARCHAR(160) NULL,
  solucion TEXT NULL,
  reparo VARCHAR(160) NULL,
  foto LONGTEXT NULL
);
CREATE TABLE IF NOT EXISTS seguimiento_incidencia (
  id INT AUTO_INCREMENT PRIMARY KEY,
  incidencia_id VARCHAR(40) NOT NULL,
  fecha_hora DATETIME NOT NULL,
  usuario VARCHAR(160) NOT NULL,
  estado VARCHAR(20) NOT NULL,
  nota TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reservacion (
  id VARCHAR(40) PRIMARY KEY,
  laboratorio_id VARCHAR(40) NOT NULL,
  maestro_id VARCHAR(40) NOT NULL,
  materia_id VARCHAR(40) NOT NULL,
  grupo VARCHAR(10) NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado VARCHAR(20) NOT NULL,
  motivo TEXT NULL
);
CREATE TABLE IF NOT EXISTS bitacora (
  id VARCHAR(80) PRIMARY KEY,
  fecha_hora DATETIME NOT NULL,
  usuario VARCHAR(160) NOT NULL,
  accion TEXT NOT NULL,
  origen VARCHAR(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (
  id TINYINT PRIMARY KEY,
  fuente VARCHAR(20) NOT NULL,
  persistido TINYINT(1) NOT NULL,
  escenario_fecha DATE NOT NULL,
  escenario_texto VARCHAR(180) NOT NULL,
  hora_referencia TIME NOT NULL
);
`
