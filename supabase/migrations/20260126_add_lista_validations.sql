-- =====================================================
-- Agregar columnas de validación de listas faltantes
-- UIF Personas Bloqueadas y PEPs México
-- =====================================================

-- Agregar columna para UIF Personas Bloqueadas
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS en_lista_uif BOOLEAN DEFAULT false;

-- Agregar columna para PEPs México (adicional a es_pep que ya existe)
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS en_lista_peps BOOLEAN DEFAULT false;

-- Agregar columna para almacenar JSON de todas las validaciones
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS validaciones JSONB DEFAULT '{}'::jsonb;

-- Crear índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_clientes_lista_uif ON clientes(en_lista_uif) 
WHERE en_lista_uif = true;

CREATE INDEX IF NOT EXISTS idx_clientes_lista_peps ON clientes(en_lista_peps) 
WHERE en_lista_peps = true;

-- Índice GIN para búsquedas rápidas en el JSON de validaciones
CREATE INDEX IF NOT EXISTS idx_clientes_validaciones ON clientes USING GIN (validaciones);

-- Comentarios
COMMENT ON COLUMN clientes.en_lista_uif IS 'Cliente aparece en lista UIF de Personas Bloqueadas (crítico)';
COMMENT ON COLUMN clientes.en_lista_peps IS 'Cliente aparece en lista de PEPs México (obligatorio Art. 17 LFPIORPI)';
COMMENT ON COLUMN clientes.validaciones IS 'JSON con resultados detallados de todas las validaciones de listas';
