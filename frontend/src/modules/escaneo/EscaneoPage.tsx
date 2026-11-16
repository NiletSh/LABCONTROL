import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, CameraOff, CheckCircle2 } from 'lucide-react'
import type { Alumno } from '@shared/types'
import { nombreTurno } from '@shared/academico'
import type { CredencialQr } from '@shared/credencial'
import { leerCredencialQr } from '@shared/credencial'
import { esIngresoDuplicado, sesionDestinoDeIngreso } from '@shared/schedule'
import { Button, Field, LabPicker, PageHeader } from '../../components/ui'
import { fechaLarga } from '../../format'
import { nuevoId } from '../../forms'
import { useApp, useData } from '../../state'
import { leerCredencialImpresa, prepararLecturaImpresa } from './impreso'
import { crearLectorQr } from './lector'
import { prepararSonido, sonarCredencialLeida } from './sonido'

type Camara = 'idle' | 'starting' | 'live' | 'denied' | 'unsupported'

type Lectura =
  | { estado: 'leyendo'; expediente: string }
  | { estado: 'ok'; alumno: Alumno; nuevo: boolean; soloExpediente: boolean }
  | { estado: 'duplicado'; nombre: string; expediente: string; dePrueba: boolean }
  | { estado: 'rechazo'; mensaje: string }
  | { estado: 'sin-sesion'; credencial: CredencialQr }
  | { estado: 'ajena'; texto: string }

export function EscaneoPage() {
  const data = useData()
  const { guardar, avisar } = useApp()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const datosRef = useRef(data)
  const guardarRef = useRef(guardar)
  const ocupado = useRef(false)
  const vistos = useRef(new Set<string>())
  const ultimoTexto = useRef('')
  const ultimaMatricula = useRef('')
  const ultimoHasta = useRef(0)
  const lecturaRef = useRef<Lectura | null>(null)
  const [camara, setCamara] = useState<Camara>('idle')
  const [lectura, setLectura] = useState<Lectura | null>(null)
  const [nombreEscrito, setNombreEscrito] = useState('')
  const [errorNombre, setErrorNombre] = useState('')
  const [laboratorioId, setLaboratorioId] = useState(data.laboratorios[0]?.id ?? '')
  const laboratorio = data.laboratorios.find((item) => item.id === laboratorioId)
  const destino = sesionDestinoDeIngreso(data.sesiones, laboratorioId, data.meta.escenarioFecha, data.meta.horaReferencia)
  const sesionMateria = data.materias.find((item) => item.id === destino?.materiaId)
  const sesionMaestro = data.maestros.find((item) => item.id === destino?.maestroId)
  datosRef.current = data
  guardarRef.current = guardar
  lecturaRef.current = lectura

  const detener = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCamara('idle')
  }

  const activar = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamara('unsupported')
      return
    }
    prepararSonido()
    prepararLecturaImpresa()
    setCamara('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      streamRef.current = stream
      const pista = stream.getVideoTracks()[0]
      const capacidades = pista?.getCapabilities?.() as MediaTrackCapabilities & { focusMode?: string[] }
      if (pista && capacidades?.focusMode?.includes('continuous')) {
        await pista.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined)
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCamara('live')
    } catch {
      setCamara('denied')
    }
  }

  const procesar = async (texto: string, video?: HTMLVideoElement) => {
    const ahora = Date.now()
    if (texto === ultimoTexto.current && ahora < ultimoHasta.current) return
    if (ocupado.current) return
    ultimoTexto.current = texto
    ultimoHasta.current = ahora + 3500
    ocupado.current = true
    try {
      const actual = datosRef.current
      const credencial = leerCredencialQr(texto)
      if (!credencial) {
        setLectura({ estado: 'ajena', texto })
        return
      }
      const sesion = sesionDestinoDeIngreso(actual.sesiones, laboratorioId, actual.meta.escenarioFecha, actual.meta.horaReferencia)
      if (!sesion) {
        setLectura({ estado: 'sin-sesion', credencial })
        return
      }
      if (credencial.matricula === ultimaMatricula.current && Date.now() < ultimoHasta.current) return
      ultimaMatricula.current = credencial.matricula
      ultimoHasta.current = Date.now() + 15000
      const registrado = actual.alumnos.find((alumno) => alumno.matricula.toUpperCase() === credencial.matricula)
      if (registrado?.estado === 'inactivo') {
        setLectura({ estado: 'rechazo', mensaje: `${registrado.nombre} está inactivo y no puede ingresar.` })
        return
      }
      const clave = `${credencial.matricula}|${sesion.id}`
      const yaEnPantalla = lecturaRef.current?.estado === 'ok' && lecturaRef.current.alumno.matricula === credencial.matricula
      if (yaEnPantalla) return
      if (vistos.current.has(clave) || (registrado != null && esIngresoDuplicado(actual.ingresos, registrado.id, sesion.id))) {
        const dePrueba = actual.ingresos.some((ingreso) => ingreso.alumnoId === registrado?.id && ingreso.sesionId === sesion.id && ingreso.id.startsWith('local-'))
        setLectura({
          estado: 'duplicado',
          nombre: registrado?.nombre || credencial.nombre || credencial.matricula,
          expediente: credencial.matricula,
          dePrueba,
        })
        return
      }

      let nombreImpreso = credencial.nombre
      let plantel = ''
      if (!registrado && !nombreImpreso && video) {
        setLectura({ estado: 'leyendo', expediente: credencial.matricula })
        const impreso = await leerCredencialImpresa(video)
        if (impreso.nombre) nombreImpreso = impreso.nombre
        if (impreso.plantel) plantel = impreso.plantel
      }
      const faltaNombre = !registrado && !nombreImpreso

      vistos.current.add(clave)
      const alumnoId = registrado?.id ?? nuevoId('alu')
      const ingresoId = nuevoId('ing')
      const alumno: Alumno = registrado ?? {
        id: alumnoId,
        matricula: credencial.matricula,
        nombre: nombreImpreso || credencial.matricula,
        plantel: plantel || undefined,
        semestre: credencial.semestre ?? sesion.semestre,
        grupo: credencial.grupo || sesion.grupo,
        turnoId: credencial.turnoId || sesion.turnoId,
        estado: 'activo',
      }
      const resultado = await guardarRef.current({
        tipo: 'ingreso',
        datos: {
          matricula: alumno.matricula,
          nombre: alumno.nombre,
          semestre: alumno.semestre,
          grupo: alumno.grupo,
          turnoId: alumno.turnoId,
          sesionId: sesion.id,
          laboratorioId,
          fecha: actual.meta.escenarioFecha,
          hora: actual.meta.horaReferencia,
        },
        accion: faltaNombre
          ? `Registró el ingreso del expediente ${alumno.matricula}.`
          : `Registró el ingreso de ${alumno.nombre} con la credencial.`,
        ids: registrado ? [ingresoId] : [alumnoId, ingresoId],
        silencioso: true,
        aplicar: (draft) => {
          if (!registrado) draft.alumnos.unshift(alumno)
          draft.ingresos.push({
            id: ingresoId,
            alumnoId: alumno.id,
            sesionId: sesion.id,
            fecha: actual.meta.escenarioFecha,
            hora: actual.meta.horaReferencia,
          })
        },
      })
      if (!resultado.ok) {
        vistos.current.delete(clave)
        if (resultado.conflict) {
          navigator.vibrate?.([30, 50, 30])
          setLectura({ estado: 'duplicado', nombre: alumno.nombre, expediente: alumno.matricula, dePrueba: false })
        } else {
          setLectura({ estado: 'rechazo', mensaje: resultado.message })
        }
        return
      }
      navigator.vibrate?.([40, 30, 40])
      sonarCredencialLeida()
      avisar('Credencial leída.', 'ok')
      ultimoHasta.current = Date.now() + 15000
      setNombreEscrito('')
      setErrorNombre('')
      setLectura({ estado: 'ok', alumno, nuevo: !registrado, soloExpediente: faltaNombre })
    } finally {
      ocupado.current = false
    }
  }

  const quitarPrueba = async () => {
    const expediente = lectura?.estado === 'ok'
      ? lectura.alumno.matricula
      : lectura?.estado === 'duplicado' ? lectura.expediente : ''
    if (!expediente) return
    const actual = datosRef.current
    const sesion = sesionDestinoDeIngreso(actual.sesiones, laboratorioId, actual.meta.escenarioFecha, actual.meta.horaReferencia)
    const alumno = actual.alumnos.find((item) => item.matricula.toUpperCase() === expediente)
    const ingreso = actual.ingresos.find((item) => item.alumnoId === alumno?.id && item.sesionId === sesion?.id && item.id.startsWith('local-'))
    if (!alumno || !sesion || !ingreso) return
    const tieneOtroIngreso = actual.ingresos.some((item) => item.alumnoId === alumno.id && item.id !== ingreso.id)
    await guardar({
      tipo: 'ingreso.prueba',
      datos: { expediente, ingresoId: ingreso.id, alumnoId: alumno.id, borrarAlumno: alumno.id.startsWith('local-') && !tieneOtroIngreso },
      accion: `Quitó la prueba del expediente ${expediente} para volver a escanearla.`,
      ids: [ingreso.id],
      silencioso: true,
      aplicar: (draft) => {
        draft.ingresos = draft.ingresos.filter((item) => item.id !== ingreso.id)
        if (alumno.id.startsWith('local-') && !tieneOtroIngreso) {
          draft.alumnos = draft.alumnos.filter((item) => item.id !== alumno.id)
        }
      },
    })
    vistos.current.delete(`${expediente}|${sesion.id}`)
    ultimaMatricula.current = ''
    ultimoTexto.current = ''
    ultimoHasta.current = 0
    setNombreEscrito('')
    setErrorNombre('')
    setLectura(null)
  }

  const completarNombre = async () => {
    if (lectura?.estado !== 'ok') return
    const nombre = nombreEscrito.trim()
    if (nombre.length < 5 || !nombre.includes(' ')) {
      setErrorNombre('Escribe el nombre completo, tal como está en la credencial.')
      return
    }
    const alumno = lectura.alumno
    const resultado = await guardar({
      tipo: 'alumno',
      datos: {
        id: alumno.id,
        matricula: alumno.matricula,
        nombre,
        semestre: alumno.semestre,
        grupo: alumno.grupo,
        turnoId: alumno.turnoId,
        estado: alumno.estado,
      },
      accion: `Anotó el nombre de ${nombre} desde la credencial.`,
      ids: [alumno.id],
      silencioso: true,
      aplicar: (draft) => {
        const item = draft.alumnos.find((row) => row.id === alumno.id)
        if (item) item.nombre = nombre
      },
    })
    if (!resultado.ok) {
      setErrorNombre(resultado.message)
      return
    }
    setErrorNombre('')
    setLectura({ estado: 'ok', alumno: { ...alumno, nombre }, nuevo: lectura.nuevo, soloExpediente: false })
  }

  const alLeer = useRef(procesar)
  alLeer.current = procesar

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    if (camara !== 'live') return
    const video = videoRef.current
    if (!video) return
    let activo = true
    let timer = 0
    void crearLectorQr().then((leer) => {
      const paso = async () => {
        if (!activo) return
        try {
          const texto = await leer(video)
          if (texto) await alLeer.current(texto, video)
        } catch {
          /* un cuadro ilegible no detiene la cámara */
        }
        if (activo) timer = window.setTimeout(() => { void paso() }, 280)
      }
      void paso()
    })
    return () => {
      activo = false
      window.clearTimeout(timer)
    }
  }, [camara])

  return (
    <section className="page">
      <PageHeader
        title="Escaneo de credenciales"
        description="Encuadra toda la credencial. Se leen el código de barras y los datos impresos: nombre, expediente y plantel."
      />
      <div className="scan-layout">
        <div className="stack">
          <LabPicker value={laboratorioId} onChange={setLaboratorioId} labs={data.laboratorios} />
          <div className={camara === 'live' ? 'camera-frame is-live' : 'camera-frame'}>
            <video ref={videoRef} autoPlay muted playsInline />
            {camara === 'live' ? (
              <div className="scan-hud">
                <span>Encuadra toda la credencial</span>
                <div className="scan-window" />
                <span>Deja quieta la credencial hasta oír el aviso</span>
              </div>
            ) : null}
            <div className="camera-placeholder">
              {camara === 'live' ? <Camera size={28} /> : <CameraOff size={28} />}
              <strong>
                {camara === 'starting' && 'Solicitando permiso de la cámara…'}
                {camara === 'denied' && 'No se autorizó la cámara'}
                {camara === 'unsupported' && 'Este navegador no expone la cámara'}
                {camara === 'idle' && 'La cámara está apagada'}
              </strong>
              <span>En el teléfono, acerca la credencial completa hasta que el nombre y el código se vean nítidos.</span>
            </div>
          </div>
          {camara === 'live'
            ? <Button type="button" variant="secondary" onClick={detener}>Detener cámara</Button>
            : <Button type="button" className="btn-lg" onClick={() => { void activar() }} disabled={camara === 'starting'}>Activar cámara</Button>}
        </div>
        <div className="stack">
          <article className="panel" aria-live="polite">
            <h2>Datos del alumno</h2>
            {lectura?.estado === 'leyendo' ? (
              <>
                <div className="confirm-banner"><Camera size={18} /> Leyendo la credencial</div>
                <p>Ya se vio el expediente {lectura.expediente}. Mantén la credencial quieta para leer el nombre impreso.</p>
              </>
            ) : null}
            {lectura?.estado === 'ok' ? (
              <>
                <div className="confirm-banner"><CheckCircle2 size={18} /> Ingreso registrado</div>
                <dl className="dl-grid">
                  <div><dt>Nombre</dt><dd>{lectura.soloExpediente ? 'No viene en el código de barras' : lectura.alumno.nombre}</dd></div>
                  <div><dt>Expediente</dt><dd>{lectura.alumno.matricula}</dd></div>
                  {lectura.alumno.plantel ? <div><dt>Plantel</dt><dd>{lectura.alumno.plantel}</dd></div> : null}
                  <div><dt>Semestre</dt><dd>{lectura.alumno.semestre}°</dd></div>
                  <div><dt>Grupo</dt><dd>{lectura.alumno.grupo}</dd></div>
                  <div><dt>Turno</dt><dd>{nombreTurno(lectura.alumno.turnoId)}</dd></div>
                  <div><dt>Laboratorio</dt><dd>{laboratorio?.nombre}</dd></div>
                  <div><dt>Fecha</dt><dd>{fechaLarga(data.meta.escenarioFecha)}</dd></div>
                  <div><dt>Hora</dt><dd>{data.meta.horaReferencia}</dd></div>
                </dl>
                {lectura.soloExpediente ? (
                  <Field label="Nombre en la credencial" error={errorNombre} hint="Escríbelo como está impreso: apellidos y nombre.">
                    <input value={nombreEscrito} onChange={(event) => setNombreEscrito(event.target.value)} placeholder="Apellidos y nombre" />
                  </Field>
                ) : null}
                {lectura.soloExpediente ? <Button type="button" onClick={() => { void completarNombre() }}>Guardar nombre</Button> : null}
                <p className="hint">
                  {lectura.soloExpediente
                    ? 'El código de barras trae el expediente. El nombre está impreso en la credencial y se guarda aquí.'
                    : lectura.nuevo
                      ? 'Esos datos venían en el código y el alumno quedó dado de alta junto con el ingreso.'
                      : 'El expediente del código coincide con un alumno ya registrado.'}
                </p>
                <Button type="button" variant="secondary" onClick={() => { void quitarPrueba() }}>Borrar esta prueba y escanear otra vez</Button>
              </>
            ) : null}
            {lectura?.estado === 'duplicado' ? (
              <>
                <div className="confirm-banner is-warn"><AlertTriangle size={18} /> Esta credencial ya ingresó</div>
                <p>
                  {lectura.nombre.toUpperCase() === lectura.expediente
                    ? `El expediente ${lectura.expediente} ya tiene un ingreso en esta sesión.`
                    : `${lectura.nombre} (expediente ${lectura.expediente}) ya tiene un ingreso en esta sesión.`}
                  {' '}La cámara sí leyó el código. El segundo pase no se guarda.
                </p>
                {lectura.dePrueba ? <Button type="button" variant="secondary" onClick={() => { void quitarPrueba() }}>Borrar esta prueba y escanear otra vez</Button> : null}
              </>
            ) : null}
            {lectura?.estado === 'rechazo' ? (
              <>
                <div className="confirm-banner is-danger"><AlertTriangle size={18} /> No se registró</div>
                <p>{lectura.mensaje}</p>
              </>
            ) : null}
            {lectura?.estado === 'sin-sesion' ? (
              <>
                <div className="confirm-banner is-warn"><AlertTriangle size={18} /> Sin sesión en curso</div>
                <p>El código se leyó, pero en este laboratorio no hay una sesión a las {data.meta.horaReferencia}. No se guardó el ingreso.</p>
                <dl className="dl-grid">
                  <div><dt>Matrícula</dt><dd>{lectura.credencial.matricula}</dd></div>
                  <div><dt>Alumno</dt><dd>{lectura.credencial.nombre || 'No venía en el código'}</dd></div>
                </dl>
              </>
            ) : null}
            {lectura?.estado === 'ajena' ? (
              <>
                <div className="confirm-banner is-danger"><AlertTriangle size={18} /> Código sin matrícula</div>
                <p>Se leyó un código, pero no trae una matrícula para registrar.</p>
                <p className="hint">{lectura.texto.slice(0, 180)}</p>
              </>
            ) : null}
            {lectura == null ? (
              <>
                <p>Encuadra la credencial completa. El nombre se toma de lo impreso y el expediente, del código de barras.</p>
                <dl className="dl-grid">
                  <div><dt>Laboratorio</dt><dd>{laboratorio?.nombre ?? 'Sin seleccionar'}</dd></div>
                  <div><dt>Fecha y hora</dt><dd>{fechaLarga(data.meta.escenarioFecha)} · {data.meta.horaReferencia}</dd></div>
                  <div><dt>Expediente</dt><dd>Pendiente de lectura</dd></div>
                  <div><dt>Registro</dt><dd>Se crea al leer el código</dd></div>
                </dl>
              </>
            ) : null}
            <p className="hint">Un segundo ingreso del mismo alumno en la misma sesión se rechaza.</p>
          </article>
          <article className="panel">
            <h2>Sesión vinculada</h2>
            {destino ? (
              <>
                <p>El código leído a las {data.meta.horaReferencia} queda en esta sesión.</p>
                <dl className="dl-grid">
                  <div><dt>Materia</dt><dd>{sesionMateria?.nombre}</dd></div>
                  <div><dt>Maestro</dt><dd>{sesionMaestro?.nombre}</dd></div>
                  <div><dt>Semestre</dt><dd>{destino.semestre}°</dd></div>
                  <div><dt>Grupo</dt><dd>{destino.grupo}</dd></div>
                  <div><dt>Turno</dt><dd>{data.turnos.find((turno) => turno.id === destino.turnoId)?.nombre}</dd></div>
                  <div><dt>Horario</dt><dd>{destino.horaInicio}–{destino.horaFin}</dd></div>
                </dl>
              </>
            ) : (
              <p>No hay una sesión en curso en este laboratorio a las {data.meta.horaReferencia}. Un código leído ahora no se asociaría a ninguna sesión.</p>
            )}
          </article>
        </div>
      </div>
    </section>
  )
}
