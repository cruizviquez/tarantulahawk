-- SQL para actualizar tabla configuracion_so con campos de tipo de cambio
-- Ejecutar en Supabase SQL Editor

-- Agregar columnas para tipo de cambio si no existen
ALTER TABLE configuracion_so ADD COLUMN IF NOT EXISTS tipo_cambio_mxn_usd DECIMAL(10,6) DEFAULT 17.500000;
ALTER TABLE configuracion_so ADD COLUMN IF NOT EXISTS tipo_cambio_fecha TIMESTAMP DEFAULT NOW();

-- Comentarios descriptivos
COMMENT ON COLUMN configuracion_so.tipo_cambio_mxn_usd IS '1 MXN = X USD (para convertir: cantidad_mxn / tasa = cantidad_usd)';
COMMENT ON COLUMN configuracion_so.tipo_cambio_fecha IS 'Fecha/hora UTC de última actualización de tipo de cambio';

-- Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_configuracion_tipo_cambio ON configuracion_so(tipo_cambio_fecha DESC);

-- Verificar que las columnas fueron creadas
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'configuracion_so' 
AND column_name IN ('tipo_cambio_mxn_usd', 'tipo_cambio_fecha');
