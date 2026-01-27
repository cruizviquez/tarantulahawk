-- Crear tabla documentos y preparar auditoría básica
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS documentos (
  documento_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(cliente_id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo VARCHAR(50),
  archivo_url TEXT NOT NULL,
  fecha_carga TIMESTAMP DEFAULT NOW(),
  eliminado BOOLEAN DEFAULT FALSE,
  fecha_eliminacion TIMESTAMP,
  eliminado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  razon_eliminacion TEXT,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_documentos_cliente ON documentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_user ON documentos(user_id);
CREATE INDEX IF NOT EXISTS idx_documentos_fecha ON documentos(fecha_carga DESC);

-- Vistas de activos
CREATE OR REPLACE VIEW documentos_activos AS
SELECT * FROM documentos WHERE eliminado = FALSE OR eliminado IS NULL;

-- RLS: habilitar y limitar a propietario
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY documentos_owner_select ON documentos
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY documentos_owner_insert ON documentos
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY documentos_owner_update ON documentos
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
