-- SQL para crear tablas de auditoría para eliminación de operaciones y documentos
-- Ejecutar en Supabase SQL Editor

-- ===========================
-- TABLA: auditoria_operaciones
-- ===========================
-- Registra cada eliminación de operación con razón y detalles del usuario
CREATE TABLE IF NOT EXISTS auditoria_operaciones (
  auditoria_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(cliente_id) ON DELETE CASCADE,
  operacion_id UUID REFERENCES operaciones(operacion_id) ON DELETE SET NULL,
  accion VARCHAR(50) NOT NULL DEFAULT 'ELIMINAR',
  razon TEXT NOT NULL,
  folio_operacion VARCHAR(20),
  monto DECIMAL(15, 2),
  moneda VARCHAR(3),
  fecha_accion TIMESTAMP DEFAULT NOW(),
  ip_usuario VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_auditoria_ops_user ON auditoria_operaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_ops_cliente ON auditoria_operaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_ops_fecha ON auditoria_operaciones(fecha_accion DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_ops_folio ON auditoria_operaciones(folio_operacion);

-- ===========================
-- TABLA: auditoria_documentos
-- ===========================
-- Registra cada eliminación de documento con razón y detalles del usuario
CREATE TABLE IF NOT EXISTS auditoria_documentos (
  auditoria_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(cliente_id) ON DELETE CASCADE,
  documento_id UUID REFERENCES documentos(documento_id) ON DELETE SET NULL,
  accion VARCHAR(50) NOT NULL DEFAULT 'ELIMINAR',
  razon TEXT NOT NULL,
  nombre_documento VARCHAR(255),
  tipo VARCHAR(50),
  fecha_accion TIMESTAMP DEFAULT NOW(),
  ip_usuario VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_auditoria_docs_user ON auditoria_documentos(user_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_docs_cliente ON auditoria_documentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_docs_fecha ON auditoria_documentos(fecha_accion DESC);

-- =============================
-- Modificaciones a tablas existentes
-- =============================
-- Agregar campos de auditoría a operaciones (si no existen)
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS eliminada BOOLEAN DEFAULT FALSE;
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS fecha_eliminacion TIMESTAMP;
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS eliminada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE operaciones ADD COLUMN IF NOT EXISTS razon_eliminacion TEXT;

-- Agregar campos de auditoría a documentos (si no existen)
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS eliminado BOOLEAN DEFAULT FALSE;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS fecha_eliminacion TIMESTAMP;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS eliminado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS razon_eliminacion TEXT;

-- Crear vista para operaciones no eliminadas (para queries normales)
CREATE OR REPLACE VIEW operaciones_activas AS
SELECT * FROM operaciones
WHERE eliminada = FALSE OR eliminada IS NULL;

-- Crear vista para documentos no eliminados (para queries normales)
CREATE OR REPLACE VIEW documentos_activos AS
SELECT * FROM documentos
WHERE eliminado = FALSE OR eliminado IS NULL;

-- RLS: Auditoría solo puede ser vista por el propietario (user_id)
-- Asegurarse de que RLS está habilitado en auth.users
ALTER TABLE auditoria_operaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_documentos ENABLE ROW LEVEL SECURITY;

-- Política: Solo ver auditoría propia
CREATE POLICY auditoria_operaciones_own_policy ON auditoria_operaciones
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY auditoria_documentos_own_policy ON auditoria_documentos
  FOR SELECT USING (user_id = auth.uid());

-- Política: Solo insertar auditoría como el usuario autenticado
CREATE POLICY auditoria_operaciones_insert_policy ON auditoria_operaciones
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY auditoria_documentos_insert_policy ON auditoria_documentos
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Comentarios
COMMENT ON TABLE auditoria_operaciones IS 'Registro de auditoría para eliminaciones de operaciones';
COMMENT ON TABLE auditoria_documentos IS 'Registro de auditoría para eliminaciones de documentos';
COMMENT ON COLUMN auditoria_operaciones.razon IS 'Razón por la cual se eliminó la operación (requerido)';
COMMENT ON COLUMN auditoria_documentos.razon IS 'Razón por la cual se eliminó el documento (requerido)';
