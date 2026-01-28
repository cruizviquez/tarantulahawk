-- Migration: Add actividad_vulnerable and multi_actividad_habilitada to clientes table
-- Author: TarantulaHawk Team
-- Date: 2026-01-27
-- Purpose: Store client's default vulnerable activity (Art. 17 LFPIORPI) and multi-activity flag

-- Add actividad_vulnerable column
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS actividad_vulnerable TEXT;

-- Add multi_actividad_habilitada column (default false, only admin can enable)
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS multi_actividad_habilitada BOOLEAN DEFAULT FALSE NOT NULL;

-- Add comment to explain purpose
COMMENT ON COLUMN public.clientes.actividad_vulnerable IS 
'Default vulnerable activity for all client operations (Art. 17 LFPIORPI). Used as default value in operations form. Values from config_modelos.json umbrales (e.g., I_juegos, VIII_vehiculos, etc.)';

COMMENT ON COLUMN public.clientes.multi_actividad_habilitada IS 
'Flag indicating if client can have operations with different vulnerable activities. Default FALSE. Only system admin can enable this flag. When FALSE, all operations must use cliente.actividad_vulnerable value.';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_clientes_actividad_vulnerable 
ON public.clientes(actividad_vulnerable) 
WHERE actividad_vulnerable IS NOT NULL;

-- Migration complete
