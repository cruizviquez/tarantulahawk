/**
 * Script para aplicar migración de columnas de validación de listas
 * Ejecutar con: npx tsx scripts/apply-kyc-migration.ts
 * 
 * O usar el SQL directo desde Supabase Dashboard
 */

const migrationSQL = `
-- Agregar columnas de validación de listas faltantes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS en_lista_uif BOOLEAN DEFAULT false;

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
`;

console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('🔧 MIGRACIÓN: Agregar columnas en_lista_uif y en_lista_peps');
console.log('═══════════════════════════════════════════════════════════');
console.log('');
console.log('📋 Ejecuta el siguiente SQL en Supabase Dashboard:');
console.log('   Dashboard > SQL Editor > New Query');
console.log('');
console.log('─────────────────────────────────────────────────────────');
console.log(migrationSQL);
console.log('─────────────────────────────────────────────────────────');
console.log('');
console.log('✅ Después de ejecutar, recarga la página de KYC');
console.log('');
