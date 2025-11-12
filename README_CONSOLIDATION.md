# Consolidación de Carpetas Duplicadas

## 🎯 Propósito

Este script elimina carpetas duplicadas/redundantes y consolida todos los outputs y uploads en una ubicación única: `/app/backend/`

## ⚠️ IMPORTANTE: Lee antes de ejecutar

El script va a:

### ✅ PRESERVAR (mover a ubicación centralizada)
- `uploads/sample.csv` → `/app/backend/uploads/`
- Archivos en `app/outputs/enriched/pending/*.csv` → `/app/backend/outputs/enriched/pending/`
- XMLs en `app/backend/api/outputs/xml/*.xml` → `/app/backend/outputs/xml/`

### ❌ ELIMINAR (carpetas redundantes)
- `/outputs/` (raíz)
- `/uploads/` (raíz)
- `/app/outputs/`
- `/app/backend/api/outputs/`
- `/app/backend/api/uploads/`

## 🚀 Cómo Ejecutar

```bash
# 1. Asegúrate de estar en la raíz del proyecto
cd /workspaces/tarantulahawk

# 2. Opcional: Haz un respaldo por si acaso
tar -czf backup_pre_consolidation_$(date +%Y%m%d_%H%M%S).tar.gz \
    outputs/ uploads/ app/outputs/ app/backend/api/outputs/ app/backend/api/uploads/ \
    2>/dev/null || echo "Algunas carpetas no existen, continuando..."

# 3. Dar permisos de ejecución al script
chmod +x consolidate_folders.sh

# 4. Ejecutar la consolidación
bash consolidate_folders.sh

# 5. Verificar que todo funcionó
cd app/backend
python api/enhanced_main_api.py
```

## 📋 Verificación Post-Ejecución

```bash
# Verificar que las carpetas redundantes fueron eliminadas
! [ -d "outputs" ] && echo "✅ /outputs/ eliminado" || echo "❌ /outputs/ aún existe"
! [ -d "uploads" ] && echo "✅ /uploads/ eliminado" || echo "❌ /uploads/ aún existe"
! [ -d "app/outputs" ] && echo "✅ /app/outputs/ eliminado" || echo "❌ /app/outputs/ aún existe"

# Verificar que la estructura centralizada existe
[ -d "app/backend/outputs" ] && echo "✅ /app/backend/outputs/ existe" || echo "❌ Falta"
[ -d "app/backend/uploads" ] && echo "✅ /app/backend/uploads/ existe" || echo "❌ Falta"
```

## 📖 Documentación Completa

Ver `FOLDER_CONSOLIDATION.md` para detalles completos sobre:
- Diagnóstico del problema
- Estructura antes/después
- Impacto en el código
- Rutas de referencia
- Verificación detallada

## 🔄 Reversión (si algo sale mal)

Si ejecutaste el respaldo sugerido arriba:

```bash
# Restaurar desde el backup
tar -xzf backup_pre_consolidation_*.tar.gz
```

## 📞 Soporte

Si encuentras algún problema después de la consolidación:

1. Verifica que `BASE_DIR` en los scripts Python apunte a `/app/backend/`
2. Revisa los logs del backend en `app/backend/logs/`
3. Consulta `FOLDER_CONSOLIDATION.md` para las rutas correctas

---

**Fecha:** 2025-11-12  
**Versión:** 1.0  
**Estado:** ✅ Listo para ejecutar
