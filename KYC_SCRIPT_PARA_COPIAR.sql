-- =====================================================
-- TARANTULAHAWK PLD - MÓDULO KYC & EXPEDIENTES
-- Schema PostgreSQL para México (Art. 17 LFPIORPI)
-- ✅ VERSIÓN CORREGIDA PARA SUPABASE
-- =====================================================

-- ✅ TABLA 1: Configuración del Sujeto Obligado (crear primero, sin FK)
CREATE TABLE IF NOT EXISTS configuracion_so (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Datos del Sujeto Obligado
  razon_social VARCHAR(255) NOT NULL,
  rfc VARCHAR(13) NOT NULL UNIQUE,
  actividad_vulnerable VARCHAR(100) NOT NULL,
  
  -- Domicilio
  domicilio_fiscal TEXT,
  telefono VARCHAR(20),
  email_oficial VARCHAR(255),
  
  -- Oficial de Cumplimiento
  oficial_cumplimiento_nombre VARCHAR(255),
  oficial_cumplimiento_email VARCHAR(255),
  oficial_cumplimiento_telefono VARCHAR(20),
  
  -- FIEL (Firma Electrónica)
  tiene_fiel BOOLEAN DEFAULT false,
  fiel_certificado_path TEXT,
  fiel_key_path TEXT,
  fiel_password_encrypted TEXT,
  fiel_vigencia_hasta DATE,
  
  -- Configuración de Umbrales
  umbral_operacion_relevante DECIMAL(15,2) DEFAULT 17500.00,
  umbral_efectivo DECIMAL(15,2) DEFAULT 7500.00,
  umbrales_personalizados JSONB,
  
  -- Configuración de Análisis
  frecuencia_analisis VARCHAR(20) DEFAULT 'mensual' 
    CHECK (frecuencia_analisis IN ('diario', 'semanal', 'quincenal', 'mensual')),
  auto_generar_xml BOOLEAN DEFAULT false,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_configuracion_user ON configuracion_so(user_id);


-- ✅ TABLA 2: Clientes (Expediente Digital)
CREATE TABLE IF NOT EXISTS clientes (
  cliente_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Datos Básicos
  tipo_persona VARCHAR(20) NOT NULL CHECK (tipo_persona IN ('fisica', 'moral')),
  nombre_completo VARCHAR(255) NOT NULL,
  rfc VARCHAR(13) NOT NULL,
  curp VARCHAR(18),
  fecha_nacimiento DATE,
  
  -- Persona Moral (si aplica)
  razon_social VARCHAR(255),
  fecha_constitucion DATE,
  registro_publico VARCHAR(100),
  
  -- Contacto
  telefono VARCHAR(20),
  email VARCHAR(255),
  domicilio_completo TEXT,
  codigo_postal VARCHAR(10),
  estado VARCHAR(50),
  municipio VARCHAR(100),
  
  -- Actividad Económica
  sector_actividad VARCHAR(100) NOT NULL,
  giro_negocio VARCHAR(255),
  actividad_economica_sat VARCHAR(10),
  ocupacion VARCHAR(100),
  
  -- Origen de Recursos
  origen_recursos TEXT NOT NULL,
  comprobante_ingresos BOOLEAN DEFAULT false,
  monto_mensual_estimado DECIMAL(15,2),
  
  -- Clasificación de Riesgo (EBR)
  nivel_riesgo VARCHAR(20) DEFAULT 'pendiente' 
    CHECK (nivel_riesgo IN ('bajo', 'medio', 'alto', 'critico', 'pendiente')),
  score_ebr DECIMAL(5,3),
  factores_riesgo JSONB DEFAULT '[]'::jsonb,
  fecha_ultima_clasificacion TIMESTAMP,
  
  -- Perfil Transaccional Esperado
  num_operaciones_mes_esperado INTEGER,
  monto_mensual_esperado DECIMAL(15,2),
  tipo_operaciones_esperadas TEXT[],
  periodicidad_esperada VARCHAR(50),
  
  -- PEP (Persona Expuesta Políticamente)
  es_pep BOOLEAN DEFAULT false,
  tipo_pep VARCHAR(50),
  cargo_publico VARCHAR(255),
  fecha_inicio_cargo DATE,
  fecha_fin_cargo DATE,
  
  -- Validaciones Gubernamentales
  validacion_renapo BOOLEAN DEFAULT false,
  validacion_renapo_fecha TIMESTAMP,
  validacion_sat BOOLEAN DEFAULT false,
  validacion_sat_fecha TIMESTAMP,
  validacion_sat_situacion VARCHAR(50),
  
  -- Listas Negras
  en_lista_69b BOOLEAN DEFAULT false,
  en_lista_ofac BOOLEAN DEFAULT false,
  en_lista_csnu BOOLEAN DEFAULT false,
  en_lista_interna BOOLEAN DEFAULT false,
  fecha_ultima_busqueda_listas TIMESTAMP,
  resultado_listas JSONB,
  
  -- Beneficiario Controlador
  tiene_beneficiario_controlador BOOLEAN DEFAULT false,
  beneficiario_controlador_id UUID REFERENCES clientes(cliente_id) ON DELETE SET NULL,
  estructura_accionaria JSONB,
  
  -- Estado del Expediente
  estado_expediente VARCHAR(20) DEFAULT 'borrador'
    CHECK (estado_expediente IN ('borrador', 'pendiente_aprobacion', 'aprobado', 'rechazado', 'suspendido', 'bloqueado')),
  motivo_rechazo TEXT,
  aprobado_por UUID,
  fecha_aprobacion TIMESTAMP,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  
  -- Constraints
  CONSTRAINT unique_rfc_per_user UNIQUE (user_id, rfc)
);

CREATE INDEX IF NOT EXISTS idx_clientes_user ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_rfc ON clientes(rfc);
CREATE INDEX IF NOT EXISTS idx_clientes_nivel_riesgo ON clientes(nivel_riesgo);
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON clientes(estado_expediente);
CREATE INDEX IF NOT EXISTS idx_clientes_pep ON clientes(es_pep) WHERE es_pep = true;
CREATE INDEX IF NOT EXISTS idx_clientes_beneficiario ON clientes(beneficiario_controlador_id);


-- ✅ TABLA 3: Documentos del Cliente
CREATE TABLE IF NOT EXISTS cliente_documentos (
  documento_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(cliente_id) ON DELETE CASCADE,
  
  -- Tipo de Documento
  tipo_documento VARCHAR(50) NOT NULL CHECK (tipo_documento IN (
    'ine_anverso', 'ine_reverso', 'pasaporte',
    'acta_constitutiva', 'poder_notarial', 
    'comprobante_domicilio', 'comprobante_ingresos',
    'estados_financieros', 'cedula_fiscal',
    'constancia_situacion_fiscal', 'contrato',
    'otro'
  )),
  
  -- Archivo
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  storage_bucket VARCHAR(100) DEFAULT 'cliente-documentos',
  
  -- Metadata de OCR (si aplica)
  ocr_procesado BOOLEAN DEFAULT false,
  ocr_data JSONB,
  datos_extraidos JSONB,
  
  -- Validación
  validado BOOLEAN DEFAULT false,
  validado_por UUID,
  fecha_validacion TIMESTAMP,
  notas_validacion TEXT,
  
  -- Vigencia
  fecha_emision DATE,
  fecha_vencimiento DATE,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  uploaded_by UUID,
  
  CONSTRAINT unique_doc_tipo_per_cliente UNIQUE (cliente_id, tipo_documento)
);

CREATE INDEX IF NOT EXISTS idx_documentos_cliente ON cliente_documentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON cliente_documentos(tipo_documento);


-- ✅ TABLA 4: Historial de Búsquedas en Listas
CREATE TABLE IF NOT EXISTS busquedas_listas (
  busqueda_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(cliente_id) ON DELETE CASCADE,
  
  tipo_lista VARCHAR(50) NOT NULL CHECK (tipo_lista IN (
    'pep', 'lista_69b', 'ofac', 'csnu', 'interpol', 'interna'
  )),
  
  -- Parámetros de Búsqueda
  termino_busqueda VARCHAR(255) NOT NULL,
  metodo VARCHAR(50),
  
  -- Resultados
  coincidencias_encontradas INTEGER DEFAULT 0,
  resultado JSONB,
  
  -- API Externa (si aplica)
  api_provider VARCHAR(100),
  api_request_id VARCHAR(255),
  
  -- Estado
  estado VARCHAR(20) DEFAULT 'completada' 
    CHECK (estado IN ('completada', 'fallida', 'pendiente')),
  error_mensaje TEXT,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  realizada_por UUID
);

CREATE INDEX IF NOT EXISTS idx_busquedas_cliente ON busquedas_listas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_busquedas_tipo ON busquedas_listas(tipo_lista);
CREATE INDEX IF NOT EXISTS idx_busquedas_fecha ON busquedas_listas(created_at DESC);


-- ✅ TABLA 5: Análisis ML (sin referencias hacia adelante)
CREATE TABLE IF NOT EXISTS analisis_ml (
  analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Archivo de Entrada
  input_file_name VARCHAR(255) NOT NULL,
  input_file_path TEXT,
  input_file_size INTEGER,
  total_transacciones INTEGER NOT NULL,
  
  -- Estrategia y Modelos
  estrategia VARCHAR(20) DEFAULT 'hybrid',
  modelo_ebr VARCHAR(100),
  modelo_ml VARCHAR(100),
  
  -- Resultados
  clasificacion_preocupante INTEGER DEFAULT 0,
  clasificacion_inusual INTEGER DEFAULT 0,
  clasificacion_relevante INTEGER DEFAULT 0,
  
  nivel_riesgo_bajo INTEGER DEFAULT 0,
  nivel_riesgo_medio INTEGER DEFAULT 0,
  nivel_riesgo_alto INTEGER DEFAULT 0,
  nivel_riesgo_critico INTEGER DEFAULT 0,
  
  guardrails_aplicados INTEGER DEFAULT 0,
  
  -- Archivos de Salida
  processed_file_path TEXT,
  json_results_path TEXT,
  xml_uif_path TEXT,
  
  -- Facturación
  costo DECIMAL(10,2) NOT NULL,
  pagado BOOLEAN DEFAULT false,
  payment_id UUID,
  
  -- Estado
  estado VARCHAR(20) DEFAULT 'procesando'
    CHECK (estado IN ('procesando', 'completado', 'fallido', 'cancelado')),
  error_mensaje TEXT,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analisis_user ON analisis_ml(user_id);
CREATE INDEX IF NOT EXISTS idx_analisis_fecha ON analisis_ml(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analisis_estado ON analisis_ml(estado);


-- ✅ TABLA 6: Reportes UIF
CREATE TABLE IF NOT EXISTS reportes_uif (
  reporte_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Tipo de Reporte
  tipo_reporte VARCHAR(50) NOT NULL CHECK (tipo_reporte IN (
    'mensual_relevantes',
    'aviso_24hrs',
    'informe_ausencia',
    'beneficiario_controlador'
  )),
  
  -- Periodo
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  mes_reporte INTEGER,
  anio_reporte INTEGER,
  
  -- Operaciones Incluidas
  num_operaciones INTEGER DEFAULT 0,
  monto_total DECIMAL(15,2) DEFAULT 0,
  operaciones_ids UUID[],
  
  -- Archivos Generados
  xml_file_path TEXT,
  xml_file_name VARCHAR(255),
  pdf_resumen_path TEXT,
  
  -- Firma Digital (FIEL)
  firmado BOOLEAN DEFAULT false,
  certificado_fiel TEXT,
  sello_digital TEXT,
  fecha_firma TIMESTAMP,
  
  -- Envío a UIF
  enviado_uif BOOLEAN DEFAULT false,
  fecha_envio TIMESTAMP,
  numero_operacion_uif VARCHAR(100),
  acuse_recibo_path TEXT,
  
  -- Estado
  estado VARCHAR(20) DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'generado', 'firmado', 'enviado', 'aceptado', 'rechazado')),
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  enviado_por UUID
);

CREATE INDEX IF NOT EXISTS idx_reportes_user ON reportes_uif(user_id);
CREATE INDEX IF NOT EXISTS idx_reportes_tipo ON reportes_uif(tipo_reporte);
CREATE INDEX IF NOT EXISTS idx_reportes_periodo ON reportes_uif(periodo_inicio, periodo_fin);
CREATE INDEX IF NOT EXISTS idx_reportes_estado ON reportes_uif(estado);


-- ✅ TABLA 7: Operaciones Transaccionales
CREATE TABLE IF NOT EXISTS operaciones (
  operacion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  cliente_id UUID REFERENCES clientes(cliente_id) ON DELETE SET NULL,
  
  -- Datos Transacción
  folio_interno VARCHAR(100) NOT NULL,
  fecha_operacion DATE NOT NULL,
  hora_operacion TIME,
  
  -- Montos
  monto DECIMAL(15,2) NOT NULL,
  moneda VARCHAR(3) DEFAULT 'MXN',
  monto_usd DECIMAL(15,2),
  monto_umas DECIMAL(10,2),
  
  -- Tipo de Operación
  tipo_operacion VARCHAR(100) NOT NULL,
  clasificacion_operacion VARCHAR(50),
  
  -- Detalles
  descripcion TEXT,
  referencia VARCHAR(255),
  numero_cuenta VARCHAR(50),
  banco_origen VARCHAR(100),
  banco_destino VARCHAR(100),
  
  -- Análisis PLD
  analisis_id UUID REFERENCES analisis_ml(analysis_id) ON DELETE SET NULL,
  clasificacion_pld VARCHAR(20) CHECK (clasificacion_pld IN ('relevante', 'inusual', 'preocupante')),
  nivel_riesgo VARCHAR(20) CHECK (nivel_riesgo IN ('bajo', 'medio', 'alto', 'critico')),
  score_ebr DECIMAL(5,3),
  score_ml DECIMAL(5,3),
  
  -- Alertas
  tiene_alertas BOOLEAN DEFAULT false,
  alertas JSONB,
  
  -- Guardrails LFPIORPI
  supera_umbral_efectivo BOOLEAN DEFAULT false,
  requiere_aviso_uif BOOLEAN DEFAULT false,
  
  -- Estado
  estado_revision VARCHAR(20) DEFAULT 'pendiente'
    CHECK (estado_revision IN ('pendiente', 'revisada', 'aprobada', 'reportada_uif', 'archivada')),
  notas_revision TEXT,
  revisada_por UUID,
  fecha_revision TIMESTAMP,
  
  -- Reportes UIF
  incluida_en_reporte_uif BOOLEAN DEFAULT false,
  reporte_uif_id UUID REFERENCES reportes_uif(reporte_id) ON DELETE SET NULL,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  
  CONSTRAINT unique_folio_per_user UNIQUE (user_id, folio_interno)
);

CREATE INDEX IF NOT EXISTS idx_operaciones_user ON operaciones(user_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_cliente ON operaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_fecha ON operaciones(fecha_operacion DESC);
CREATE INDEX IF NOT EXISTS idx_operaciones_monto ON operaciones(monto);
CREATE INDEX IF NOT EXISTS idx_operaciones_clasificacion ON operaciones(clasificacion_pld);
CREATE INDEX IF NOT EXISTS idx_operaciones_estado ON operaciones(estado_revision);
CREATE INDEX IF NOT EXISTS idx_operaciones_analisis ON operaciones(analisis_id);
CREATE INDEX IF NOT EXISTS idx_operaciones_reporte ON operaciones(reporte_uif_id);


-- ✅ TRIGGERS para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_configuracion_updated_at ON configuracion_so;
CREATE TRIGGER update_configuracion_updated_at BEFORE UPDATE ON configuracion_so
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ✅ VIEWS útiles

-- Vista: Clientes con riesgo alto/crítico
CREATE OR REPLACE VIEW clientes_alto_riesgo AS
SELECT 
  c.cliente_id,
  c.nombre_completo,
  c.rfc,
  c.nivel_riesgo,
  c.score_ebr,
  c.es_pep,
  c.en_lista_69b,
  c.en_lista_ofac,
  COUNT(o.operacion_id) as num_operaciones_mes,
  COALESCE(SUM(o.monto), 0) as monto_total_mes
FROM clientes c
LEFT JOIN operaciones o ON c.cliente_id = o.cliente_id
  AND o.fecha_operacion >= CURRENT_DATE - INTERVAL '30 days'
WHERE c.nivel_riesgo IN ('alto', 'critico')
GROUP BY c.cliente_id, c.nombre_completo, c.rfc, c.nivel_riesgo, c.score_ebr, c.es_pep, c.en_lista_69b, c.en_lista_ofac;

-- Vista: Operaciones pendientes de revisión
CREATE OR REPLACE VIEW operaciones_pendientes AS
SELECT 
  o.*,
  c.nombre_completo as cliente_nombre,
  c.nivel_riesgo as cliente_nivel_riesgo
FROM operaciones o
LEFT JOIN clientes c ON o.cliente_id = c.cliente_id
WHERE o.estado_revision = 'pendiente'
ORDER BY o.fecha_operacion DESC;


-- ✅ Row Level Security (RLS)
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE busquedas_listas ENABLE ROW LEVEL SECURITY;
ALTER TABLE operaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes_uif ENABLE ROW LEVEL SECURITY;
ALTER TABLE analisis_ml ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_so ENABLE ROW LEVEL SECURITY;

-- Policy: Los usuarios solo ven sus propios clientes
DROP POLICY IF EXISTS clientes_user_policy ON clientes;
CREATE POLICY clientes_user_policy ON clientes
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS documentos_user_policy ON cliente_documentos;
CREATE POLICY documentos_user_policy ON cliente_documentos
  FOR ALL USING (
    cliente_id IN (SELECT cliente_id FROM clientes WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS busquedas_user_policy ON busquedas_listas;
CREATE POLICY busquedas_user_policy ON busquedas_listas
  FOR ALL USING (
    cliente_id IN (SELECT cliente_id FROM clientes WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS operaciones_user_policy ON operaciones;
CREATE POLICY operaciones_user_policy ON operaciones
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS reportes_user_policy ON reportes_uif;
CREATE POLICY reportes_user_policy ON reportes_uif
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS analisis_user_policy ON analisis_ml;
CREATE POLICY analisis_user_policy ON analisis_ml
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS configuracion_user_policy ON configuracion_so;
CREATE POLICY configuracion_user_policy ON configuracion_so
  FOR ALL USING (auth.uid() = user_id);
