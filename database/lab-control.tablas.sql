-- LAB CONTROL
-- Solo estructura: base de datos y tablas, sin datos.
-- Importar: mysql -u root -p < database/lab-control.tablas.sql

CREATE DATABASE IF NOT EXISTS lab_control
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE lab_control;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS seguimiento_incidencia;
DROP TABLE IF EXISTS incidencia;
DROP TABLE IF EXISTS ingreso;
DROP TABLE IF EXISTS reservacion;
DROP TABLE IF EXISTS sesion;
DROP TABLE IF EXISTS mantenimiento;
DROP TABLE IF EXISTS equipo;
DROP TABLE IF EXISTS maestro_materia;
DROP TABLE IF EXISTS materia;
DROP TABLE IF EXISTS laboratorio;
DROP TABLE IF EXISTS alumno;
DROP TABLE IF EXISTS bitacora;
DROP TABLE IF EXISTS clave;
DROP TABLE IF EXISTS usuario;
DROP TABLE IF EXISTS maestro;
DROP TABLE IF EXISTS turno;
DROP TABLE IF EXISTS meta;

CREATE TABLE turno (
  id VARCHAR(20) PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL,
  hora_inicio TIME NULL,
  hora_fin TIME NULL,
  configurado TINYINT(1) NOT NULL DEFAULT 0,
  origen VARCHAR(20) NOT NULL,
  CONSTRAINT turno_id_chk CHECK (id IN ('matutino', 'vespertino')),
  CONSTRAINT turno_origen_chk CHECK (origen IN ('demostracion', 'sesion'))
) ENGINE=InnoDB;

CREATE TABLE usuario (
  id VARCHAR(40) PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  correo VARCHAR(180) NOT NULL,
  rol VARCHAR(20) NOT NULL,
  estado VARCHAR(20) NOT NULL,
  UNIQUE KEY usuario_correo_uk (correo),
  CONSTRAINT usuario_rol_chk CHECK (rol IN ('administrador', 'encargado')),
  CONSTRAINT usuario_estado_chk CHECK (estado IN ('activo', 'inactivo'))
) ENGINE=InnoDB;

CREATE TABLE clave (
  usuario_id VARCHAR(40) PRIMARY KEY,
  hash VARCHAR(200) NOT NULL,
  debe_cambiar TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT clave_usuario_fk FOREIGN KEY (usuario_id) REFERENCES usuario (id)
) ENGINE=InnoDB;

CREATE TABLE alumno (
  id VARCHAR(40) PRIMARY KEY,
  matricula VARCHAR(40) NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  plantel VARCHAR(160) NULL,
  semestre TINYINT NOT NULL,
  grupo CHAR(1) NOT NULL,
  turno_id VARCHAR(20) NOT NULL,
  estado VARCHAR(20) NOT NULL,
  UNIQUE KEY alumno_matricula_uk (matricula),
  CONSTRAINT alumno_turno_fk FOREIGN KEY (turno_id) REFERENCES turno (id),
  CONSTRAINT alumno_semestre_chk CHECK (semestre BETWEEN 1 AND 6),
  CONSTRAINT alumno_estado_chk CHECK (estado IN ('activo', 'inactivo'))
) ENGINE=InnoDB;

CREATE TABLE maestro (
  id VARCHAR(40) PRIMARY KEY,
  numero_empleado VARCHAR(40) NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  correo VARCHAR(180) NOT NULL,
  turno_id VARCHAR(20) NOT NULL,
  estado VARCHAR(20) NOT NULL,
  UNIQUE KEY maestro_empleado_uk (numero_empleado),
  UNIQUE KEY maestro_correo_uk (correo),
  CONSTRAINT maestro_turno_fk FOREIGN KEY (turno_id) REFERENCES turno (id),
  CONSTRAINT maestro_estado_chk CHECK (estado IN ('activo', 'inactivo'))
) ENGINE=InnoDB;

CREATE TABLE maestro_materia (
  maestro_id VARCHAR(40) NOT NULL,
  materia VARCHAR(180) NOT NULL,
  PRIMARY KEY (maestro_id, materia),
  CONSTRAINT maestro_materia_fk FOREIGN KEY (maestro_id) REFERENCES maestro (id)
) ENGINE=InnoDB;

CREATE TABLE materia (
  id VARCHAR(40) PRIMARY KEY,
  clave VARCHAR(40) NOT NULL,
  nombre VARCHAR(160) NOT NULL,
  semestre TINYINT NOT NULL,
  grupo CHAR(1) NOT NULL,
  turno_id VARCHAR(20) NOT NULL,
  maestro_id VARCHAR(40) NOT NULL,
  UNIQUE KEY materia_grupo_uk (clave, semestre, grupo, turno_id),
  CONSTRAINT materia_turno_fk FOREIGN KEY (turno_id) REFERENCES turno (id),
  CONSTRAINT materia_maestro_fk FOREIGN KEY (maestro_id) REFERENCES maestro (id),
  CONSTRAINT materia_semestre_chk CHECK (semestre BETWEEN 1 AND 6)
) ENGINE=InnoDB;

CREATE TABLE laboratorio (
  id VARCHAR(40) PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  ubicacion VARCHAR(180) NOT NULL,
  descripcion TEXT NOT NULL,
  capacidad INT NOT NULL,
  cantidad_equipos INT NOT NULL,
  estado VARCHAR(20) NOT NULL,
  CONSTRAINT laboratorio_estado_chk CHECK (estado IN ('operativo', 'parcial', 'cerrado')),
  CONSTRAINT laboratorio_capacidad_chk CHECK (capacidad > 0)
) ENGINE=InnoDB;

CREATE TABLE equipo (
  id VARCHAR(40) PRIMARY KEY,
  laboratorio_id VARCHAR(40) NOT NULL,
  estado VARCHAR(30) NOT NULL,
  descripcion TEXT NOT NULL,
  foto LONGTEXT NULL,
  KEY equipo_laboratorio_idx (laboratorio_id),
  CONSTRAINT equipo_laboratorio_fk FOREIGN KEY (laboratorio_id) REFERENCES laboratorio (id),
  CONSTRAINT equipo_estado_chk CHECK (estado IN ('disponible', 'ocupada', 'mantenimiento', 'fuera_de_servicio'))
) ENGINE=InnoDB;

CREATE TABLE mantenimiento (
  id VARCHAR(40) PRIMARY KEY,
  equipo_id VARCHAR(40) NOT NULL,
  fecha DATE NOT NULL,
  descripcion TEXT NOT NULL,
  responsable VARCHAR(160) NOT NULL,
  CONSTRAINT mantenimiento_equipo_fk FOREIGN KEY (equipo_id) REFERENCES equipo (id)
) ENGINE=InnoDB;

CREATE TABLE sesion (
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
  estado VARCHAR(20) NOT NULL,
  KEY sesion_lab_fecha_idx (laboratorio_id, fecha),
  CONSTRAINT sesion_laboratorio_fk FOREIGN KEY (laboratorio_id) REFERENCES laboratorio (id),
  CONSTRAINT sesion_maestro_fk FOREIGN KEY (maestro_id) REFERENCES maestro (id),
  CONSTRAINT sesion_materia_fk FOREIGN KEY (materia_id) REFERENCES materia (id),
  CONSTRAINT sesion_turno_fk FOREIGN KEY (turno_id) REFERENCES turno (id),
  CONSTRAINT sesion_estado_chk CHECK (estado IN ('programada', 'activa', 'finalizada', 'cancelada')),
  CONSTRAINT sesion_horario_chk CHECK (hora_fin > hora_inicio)
) ENGINE=InnoDB;

CREATE TABLE ingreso (
  id VARCHAR(40) PRIMARY KEY,
  alumno_id VARCHAR(40) NOT NULL,
  sesion_id VARCHAR(80) NOT NULL,
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  UNIQUE KEY ingreso_unico_por_sesion (alumno_id, sesion_id),
  KEY ingreso_fecha_idx (fecha),
  CONSTRAINT ingreso_alumno_fk FOREIGN KEY (alumno_id) REFERENCES alumno (id),
  CONSTRAINT ingreso_sesion_fk FOREIGN KEY (sesion_id) REFERENCES sesion (id)
) ENGINE=InnoDB;

CREATE TABLE incidencia (
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
  foto LONGTEXT NULL,
  CONSTRAINT incidencia_laboratorio_fk FOREIGN KEY (laboratorio_id) REFERENCES laboratorio (id),
  CONSTRAINT incidencia_equipo_fk FOREIGN KEY (equipo_id) REFERENCES equipo (id),
  CONSTRAINT incidencia_estado_chk CHECK (estado IN ('pendiente', 'en_atencion', 'resuelta'))
) ENGINE=InnoDB;

CREATE TABLE seguimiento_incidencia (
  id INT AUTO_INCREMENT PRIMARY KEY,
  incidencia_id VARCHAR(40) NOT NULL,
  fecha_hora DATETIME NOT NULL,
  usuario VARCHAR(160) NOT NULL,
  estado VARCHAR(20) NOT NULL,
  nota TEXT NOT NULL,
  CONSTRAINT seguimiento_incidencia_fk FOREIGN KEY (incidencia_id) REFERENCES incidencia (id)
) ENGINE=InnoDB;

CREATE TABLE reservacion (
  id VARCHAR(40) PRIMARY KEY,
  laboratorio_id VARCHAR(40) NOT NULL,
  maestro_id VARCHAR(40) NOT NULL,
  materia_id VARCHAR(40) NOT NULL,
  grupo VARCHAR(10) NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado VARCHAR(20) NOT NULL,
  motivo TEXT NULL,
  KEY reservacion_lab_fecha_idx (laboratorio_id, fecha),
  CONSTRAINT reservacion_laboratorio_fk FOREIGN KEY (laboratorio_id) REFERENCES laboratorio (id),
  CONSTRAINT reservacion_maestro_fk FOREIGN KEY (maestro_id) REFERENCES maestro (id),
  CONSTRAINT reservacion_materia_fk FOREIGN KEY (materia_id) REFERENCES materia (id),
  CONSTRAINT reservacion_estado_chk CHECK (estado IN ('pendiente', 'aceptada', 'rechazada')),
  CONSTRAINT reservacion_horario_chk CHECK (hora_fin > hora_inicio)
) ENGINE=InnoDB;

CREATE TABLE bitacora (
  id VARCHAR(80) PRIMARY KEY,
  fecha_hora DATETIME NOT NULL,
  usuario VARCHAR(160) NOT NULL,
  accion TEXT NOT NULL,
  origen VARCHAR(20) NOT NULL,
  KEY bitacora_fecha_idx (fecha_hora),
  CONSTRAINT bitacora_origen_chk CHECK (origen IN ('demostracion', 'sesion'))
) ENGINE=InnoDB;

CREATE TABLE meta (
  id TINYINT PRIMARY KEY,
  fuente VARCHAR(20) NOT NULL,
  persistido TINYINT(1) NOT NULL,
  escenario_fecha DATE NOT NULL,
  escenario_texto VARCHAR(180) NOT NULL,
  hora_referencia TIME NOT NULL
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

