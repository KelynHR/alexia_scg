CREATE TABLE IF NOT EXISTS reservas (
  id TEXT PRIMARY KEY,
  folio TEXT NOT NULL UNIQUE,
  solicitud_id TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  inicio_ms BIGINT NOT NULL,
  fin_ms BIGINT NOT NULL,
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL,
  nombre TEXT NOT NULL,
  empresa TEXT NOT NULL,
  correo TEXT NOT NULL,
  telefono TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL,
  reto TEXT NOT NULL DEFAULT '',
  modalidad TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'registrada' CHECK (estado IN ('registrada','confirmada','cancelada')),
  creado_ms BIGINT NOT NULL,
  actualizado_ms BIGINT NOT NULL,
  CHECK (fin_ms = inicio_ms + 3600000)
);
CREATE UNIQUE INDEX IF NOT EXISTS reservas_horario_activo ON reservas(inicio_ms) WHERE estado <> 'cancelada';
CREATE INDEX IF NOT EXISTS reservas_fecha ON reservas(fecha, hora);
CREATE TABLE IF NOT EXISTS limites (
  clave TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  reset_ms BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS limites_expiracion ON limites(reset_ms);
