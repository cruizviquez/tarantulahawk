-- Migration: Add missing fields to operaciones table
-- Author: TarantulaHawk Team
-- Date: 2026-01-28
-- Purpose: Add metodo_pago, actividad_vulnerable, referencia_factura, notas_internas to operations

-- Add metodo_pago column
ALTER TABLE public.operaciones 
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50);

-- Add actividad_vulnerable column (Art. 17 LFPIORPI - producto/servicio vulnerable)
ALTER TABLE public.operaciones 
ADD COLUMN IF NOT EXISTS actividad_vulnerable TEXT;

-- Add referencia_factura column (invoice/billing reference)
ALTER TABLE public.operaciones 
ADD COLUMN IF NOT EXISTS referencia_factura VARCHAR(255);

-- Add notas_internas column (internal notes for compliance team)
ALTER TABLE public.operaciones 
ADD COLUMN IF NOT EXISTS notas_internas TEXT;

-- Add ubicacion_operacion column (location/locality where operation is registered - EBR factor)
ALTER TABLE public.operaciones 
ADD COLUMN IF NOT EXISTS ubicacion_operacion VARCHAR(100);

-- Add eliminada column for soft deletes
ALTER TABLE public.operaciones 
ADD COLUMN IF NOT EXISTS eliminada BOOLEAN DEFAULT FALSE NOT NULL;

-- Add fecha_eliminacion column
ALTER TABLE public.operaciones 
ADD COLUMN IF NOT EXISTS fecha_eliminacion TIMESTAMP;

-- Add eliminada_por column
ALTER TABLE public.operaciones 
ADD COLUMN IF NOT EXISTS eliminada_por UUID;

-- Add razon_eliminacion column
ALTER TABLE public.operaciones 
ADD COLUMN IF NOT EXISTS razon_eliminacion TEXT;

-- Add updated_at column
ALTER TABLE public.operaciones 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

-- Add updated_by column
ALTER TABLE public.operaciones 
ADD COLUMN IF NOT EXISTS updated_by UUID;

-- Add comments to explain purpose
COMMENT ON COLUMN public.operaciones.metodo_pago IS 
'Payment method: efectivo, transferencia, cheque, tarjeta_credito, tarjeta_debito, etc.';

COMMENT ON COLUMN public.operaciones.actividad_vulnerable IS 
'Vulnerable activity from Art. 17 LFPIORPI (config_modelos.json). Values like I_juegos, VIII_vehiculos, etc.';

COMMENT ON COLUMN public.operaciones.referencia_factura IS 
'Invoice or billing reference number for the operation';

COMMENT ON COLUMN public.operaciones.notas_internas IS 
'Internal compliance notes - not visible to client';

COMMENT ON COLUMN public.operaciones.ubicacion_operacion IS 
'Location/locality where the operation is registered (e.g., CDMX, Monterrey). Used in EBR risk calculation.';

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_operaciones_metodo_pago 
ON public.operaciones(metodo_pago) 
WHERE metodo_pago IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operaciones_actividad_vulnerable 
ON public.operaciones(actividad_vulnerable) 
WHERE actividad_vulnerable IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operaciones_eliminada 
ON public.operaciones(eliminada) 
WHERE eliminada = TRUE;

-- ✅ Create auditoria_operaciones table for compliance tracking
CREATE TABLE IF NOT EXISTS public.auditoria_operaciones (
  auditoria_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cliente_id UUID,
  operacion_id UUID,
  
  -- Action details
  accion VARCHAR(50) NOT NULL CHECK (accion IN ('CREAR', 'EDITAR', 'ELIMINAR', 'RESTAURAR')),
  razon TEXT NOT NULL,
  
  -- Operation metadata
  folio_operacion VARCHAR(100),
  monto DECIMAL(15,2),
  moneda VARCHAR(3),
  
  -- Audit metadata
  fecha_accion TIMESTAMP DEFAULT NOW() NOT NULL,
  ip_usuario VARCHAR(100),
  user_agent TEXT,
  
  -- Additional context
  datos_anteriores JSONB,
  datos_nuevos JSONB
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_auditoria_user ON public.auditoria_operaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_operacion ON public.auditoria_operaciones(operacion_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON public.auditoria_operaciones(fecha_accion DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON public.auditoria_operaciones(accion);

-- Add RLS
ALTER TABLE public.auditoria_operaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditoria_operaciones_user_policy ON public.auditoria_operaciones;
CREATE POLICY auditoria_operaciones_user_policy ON public.auditoria_operaciones
  FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE public.auditoria_operaciones IS 
'Audit trail for all operation CRUD actions (create, edit, delete, restore)';

-- Migration complete
