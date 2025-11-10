-- Crear tabla analysis_history para guardar metadata de análisis
CREATE TABLE IF NOT EXISTS public.analysis_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_id TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    total_transacciones INTEGER NOT NULL,
    costo DECIMAL(10, 2) NOT NULL,
    pagado BOOLEAN DEFAULT TRUE,
    
    -- Paths de archivos
    original_file_path TEXT NOT NULL,
    processed_file_path TEXT NOT NULL,
    json_results_path TEXT NOT NULL,
    xml_path TEXT,
    
    -- Resumen de resultados
    resumen JSONB NOT NULL,
    
    -- Metadata adicional
    estrategia TEXT,
    balance_after DECIMAL(10, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.analysis_history ENABLE ROW LEVEL SECURITY;

-- Policy: usuarios solo ven su propio historial
CREATE POLICY "Users can view own history"
    ON public.analysis_history FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: usuarios pueden insertar su propio historial
CREATE POLICY "Users can insert own history"
    ON public.analysis_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS analysis_history_user_id_idx ON public.analysis_history(user_id);
CREATE INDEX IF NOT EXISTS analysis_history_created_at_idx ON public.analysis_history(created_at DESC);
CREATE INDEX IF NOT EXISTS analysis_history_analysis_id_idx ON public.analysis_history(analysis_id);

-- Comentarios
COMMENT ON TABLE public.analysis_history IS 'Historial completo de análisis AML con paths de archivos';
COMMENT ON COLUMN public.analysis_history.original_file_path IS 'Path relativo al archivo CSV original subido';
COMMENT ON COLUMN public.analysis_history.processed_file_path IS 'Path al CSV procesado con predicciones ML';
COMMENT ON COLUMN public.analysis_history.json_results_path IS 'Path al JSON con resultados detallados';
