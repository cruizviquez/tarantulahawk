#!/bin/bash
# Script para eliminar el banner duplicado

FILE="/workspaces/tarantulahawk/app/components/TarantulaHawkPortal.tsx"

# Hacer backup
cp "$FILE" "${FILE}.bak"

# Usar sed para eliminar las líneas 752-760
sed -i '752,760d' "$FILE"

echo "Banner duplicado eliminado. Backup guardado en ${FILE}.bak"
