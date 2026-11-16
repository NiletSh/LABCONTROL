-- LAB CONTROL
-- Esquema preparado para PostgreSQL.
-- En esta etapa la API no se conecta a esta base: responde con datos de demostración.
-- La siguiente etapa puede crear estas tablas y sustituir el repositorio en memoria.

CREATE TABLE usuario (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  correo        TEXT NOT NULL UNIQUE,
  rol           TEXT NOT NULL CHECK (rol IN ('administrador', 'encargado')),
  estado        TEXT NOT NULL CHECK (estado IN ('activo', 'inactivo')),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE turno (
  id           TEXT PRIMARY KEY CHECK (id IN ('matutino', 'vespertino')),
  nombre       TEXT NOT NULL,
  hora_inicio  TIME,
  hora_fin     TIME,
  configurado  BOOLEAN NOT NULL DEFAULT FALSE,
  origen       TEXT NOT NULL CHECK (origen IN ('demostracion', 'sesion')),
  CHECK (
    (configurado = FALSE AND hora_inicio IS NULL AND hora_fin IS NULL)
    OR (configurado = TRUE AND hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_fin > hora_inicio)
  )
);

CREATE TABLE alumno (
  id            TEXT PRIMARY KEY,
  matricula     TEXT NOT NULL UNIQUE,
  nombre        TEXT NOT NULL,
  semestre      INTEGER NOT NULL CHECK (semestre BETWEEN 1 AND 6),
  grupo         TEXT NOT NULL CHECK (grupo ~ '^[A-Z]$'),
  turno_id      TEXT NOT NULL REFERENCES turno (id),
  estado        TEXT NOT NULL CHECK (estado IN ('activo', 'inactivo')),
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE maestro (
  id               TEXT PRIMARY KEY,
  numero_empleado  TEXT NOT NULL UNIQUE,
  nombre           TEXT NOT NULL,
  correo           TEXT NOT NULL UNIQUE,
  turno_id         TEXT NOT NULL REFERENCES turno (id),
  estado           TEXT NOT NULL CHECK (estado IN ('activo', 'inactivo')),
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE materia (
  id            TEXT PRIMARY KEY,
  clave         TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  semestre      INTEGER NOT NULL CHECK (semestre BETWEEN 1 AND 6),
  grupo         TEXT NOT NULL CHECK (grupo ~ '^[A-Z]$'),
  turno_id      TEXT NOT NULL REFERENCES turno (id),
  maestro_id    TEXT NOT NULL REFERENCES maestro (id),
  UNIQUE (clave, semestre, grupo, turno_id)
);

CREATE TABLE laboratorio (
  id                 TEXT PRIMARY KEY,
  nombre             TEXT NOT NULL,
  ubicacion          TEXT NOT NULL,
  descripcion        TEXT NOT NULL,
  capacidad          INTEGER NOT NULL CHECK (capacidad > 0),
  estado             TEXT NOT NULL CHECK (estado IN ('operativo', 'parcial', 'cerrado'))
);

CREATE TABLE equipo (
  id               TEXT PRIMARY KEY,
  laboratorio_id   TEXT NOT NULL REFERENCES laboratorio (id),
  estado           TEXT NOT NULL CHECK (estado IN ('disponible', 'ocupada', 'mantenimiento', 'fuera_de_servicio')),
  descripcion      TEXT NOT NULL
);

CREATE INDEX equipo_laboratorio_idx ON equipo (laboratorio_id);

CREATE TABLE mantenimiento (
  id            TEXT PRIMARY KEY,
  equipo_id     TEXT NOT NULL REFERENCES equipo (id),
  fecha         DATE NOT NULL,
  descripcion   TEXT NOT NULL,
  responsable   TEXT NOT NULL
);

CREATE TABLE sesion (
  id               TEXT PRIMARY KEY,
  laboratorio_id   TEXT NOT NULL REFERENCES laboratorio (id),
  maestro_id       TEXT NOT NULL REFERENCES maestro (id),
  materia_id       TEXT NOT NULL REFERENCES materia (id),
  semestre         INTEGER NOT NULL CHECK (semestre BETWEEN 1 AND 6),
  grupo            TEXT NOT NULL CHECK (grupo ~ '^[A-Z]$'),
  turno_id         TEXT NOT NULL REFERENCES turno (id),
  fecha            DATE NOT NULL,
  hora_inicio      TIME NOT NULL,
  hora_fin         TIME NOT NULL,
  estado           TEXT NOT NULL CHECK (estado IN ('programada', 'activa', 'finalizada', 'cancelada')),
  CHECK (hora_fin > hora_inicio)
);

CREATE INDEX sesion_lab_fecha_idx ON sesion (laboratorio_id, fecha);
CREATE INDEX sesion_turno_fecha_idx ON sesion (turno_id, fecha);

CREATE TABLE ingreso (
  id            TEXT PRIMARY KEY,
  alumno_id     TEXT NOT NULL REFERENCES alumno (id),
  sesion_id     TEXT NOT NULL REFERENCES sesion (id),
  fecha         DATE NOT NULL,
  hora          TIME NOT NULL,
  -- Evita el doble registro accidental del mismo alumno dentro de la misma sesión.
  CONSTRAINT ingreso_unico_por_sesion UNIQUE (alumno_id, sesion_id)
);

CREATE INDEX ingreso_fecha_idx ON ingreso (fecha);
CREATE INDEX ingreso_alumno_idx ON ingreso (alumno_id);

CREATE TABLE incidencia (
  id               TEXT PRIMARY KEY,
  laboratorio_id   TEXT NOT NULL REFERENCES laboratorio (id),
  equipo_id        TEXT REFERENCES equipo (id),
  descripcion      TEXT NOT NULL,
  fecha_hora       TIMESTAMPTZ NOT NULL,
  estado           TEXT NOT NULL CHECK (estado IN ('pendiente', 'en_atencion', 'resuelta')),
  reporta          TEXT NOT NULL
);

CREATE TABLE reservacion (
  id               TEXT PRIMARY KEY,
  laboratorio_id   TEXT NOT NULL REFERENCES laboratorio (id),
  maestro_id       TEXT NOT NULL REFERENCES maestro (id),
  materia_id       TEXT NOT NULL REFERENCES materia (id),
  grupo            TEXT NOT NULL,
  fecha            DATE NOT NULL,
  hora_inicio      TIME NOT NULL,
  hora_fin         TIME NOT NULL,
  estado           TEXT NOT NULL CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  motivo           TEXT,
  CHECK (hora_fin > hora_inicio)
);

CREATE INDEX reservacion_lab_fecha_idx ON reservacion (laboratorio_id, fecha);

CREATE TABLE bitacora (
  id            TEXT PRIMARY KEY,
  fecha_hora    TIMESTAMPTZ NOT NULL,
  usuario_id    TEXT REFERENCES usuario (id),
  usuario       TEXT NOT NULL,
  accion        TEXT NOT NULL
);

CREATE INDEX bitacora_fecha_idx ON bitacora (fecha_hora DESC);
