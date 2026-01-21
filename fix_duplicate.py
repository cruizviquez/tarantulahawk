#!/usr/bin/env python3
"""Script para eliminar el banner duplicado en TarantulaHawkPortal.tsx"""

file_path = "/workspaces/tarantulahawk/app/components/TarantulaHawkPortal.tsx"

# Leer el archivo
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Hacer backup
with open(file_path + ".bak", 'w', encoding='utf-8') as f:
    f.writelines(lines)

# Eliminar líneas 752-760 (índices 751-759 en Python)
new_lines = lines[:751] + lines[760:]

# Escribir el archivo actualizado
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"✅ Banner duplicado eliminado")
print(f"📄 Backup guardado en {file_path}.bak")
print(f"🔢 Eliminadas {len(lines) - len(new_lines)} líneas")
