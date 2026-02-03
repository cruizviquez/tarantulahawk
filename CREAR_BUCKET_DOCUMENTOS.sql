-- ========================================
-- SCRIPT: Crear Bucket para Documentos KYC
-- ========================================
-- Este script crea el bucket necesario para almacenar
-- documentos de clientes (identificaciones, comprobantes, etc.)
--
-- EJECUTAR DESDE: Supabase Dashboard > SQL Editor
-- O desde: psql/Supabase CLI
-- ========================================

-- 1. Crear el bucket 'kyc-documentos' (PRIVADO para mayor seguridad)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documentos',
  'kyc-documentos',
  false,  -- Bucket PRIVADO - usa signed URLs para acceso seguro
  10485760,  -- Límite de 10MB por archivo
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Configurar políticas RLS (Row Level Security) para el bucket PRIVADO
-- Permitir que usuarios autenticados suban archivos
CREATE POLICY "Usuarios autenticados pueden subir documentos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documentos'
);

-- Permitir que usuarios autenticados accedan a documentos (vía signed URLs)
CREATE POLICY "Usuarios autenticados pueden acceder a documentos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documentos'
);

-- Permitir que usuarios autenticados eliminen documentos
CREATE POLICY "Usuarios autenticados pueden eliminar documentos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documentos'
);

-- ========================================
-- VERIFICACIÓN
-- ========================================
-- Ejecutar esta query para verificar que el bucket se creó correctamente:
-- SELECT * FROM storage.buckets WHERE id = 'kyc-documentos';
-- Debe mostrar: public = false (PRIVADO para mayor seguridad)
