#!/bin/bash
# Script para aplicar el schema KYC en Supabase

set -e

echo "🚀 Preparando schema KYC para Supabase..."

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   TARANTULAHAWK KYC - SUPABASE SETUP${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Verificar que el archivo SQL existe
if [ ! -f "supabase/migrations/kyc_schema_fixed.sql" ]; then
  echo -e "${YELLOW}⚠️  Archivo no encontrado: supabase/migrations/kyc_schema_fixed.sql${NC}"
  exit 1
fi

# Instrucciones para Supabase CLI
if command -v supabase &> /dev/null; then
  echo -e "${GREEN}✅ Supabase CLI detectado${NC}"
  echo ""
  echo -e "${BLUE}Opción 1: Ejecutar con supabase db push${NC}"
  echo "supabase db push"
  echo ""
else
  echo -e "${YELLOW}⚠️  Supabase CLI no instalado${NC}"
  echo "Instálalo con: npm install -g supabase"
  echo ""
fi

echo -e "${BLUE}Opción 2: Ejecutar manualmente en Supabase Console${NC}"
echo "1. Ve a: https://app.supabase.com"
echo "2. Selecciona tu proyecto"
echo "3. SQL Editor → New Query"
echo "4. Copia todo el contenido de: supabase/migrations/kyc_schema_fixed.sql"
echo "5. Ejecuta"
echo ""

echo -e "${GREEN}Opción 3: Usando curl${NC}"
cat << 'EOF'
# Necesitas tus credenciales Supabase:
# - PROJECT_URL (ej: https://xxx.supabase.co)
# - SERVICE_ROLE_KEY (desde settings → API)

SUPABASE_URL="https://your-project.supabase.co"
SERVICE_KEY="your-service-role-key"

# Leer el SQL
SQL=$(cat supabase/migrations/kyc_schema_fixed.sql)

# Ejecutar
curl -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"sql\": \"${SQL}\"}"
EOF

echo ""
echo -e "${GREEN}Después de ejecutar, verifica con:${NC}"
echo ""
echo "SELECT table_name FROM information_schema.tables"
echo "WHERE table_schema = 'public' AND table_name LIKE 'cliente%'"
echo "  OR table_name LIKE 'operacione%'"
echo "  OR table_name LIKE 'reporte%';"
echo ""

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ Schema listo para aplicar${NC}"
echo -e "${BLUE}========================================${NC}"
