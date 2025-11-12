# 🧹 Consolidación de Carpetas - Resumen

## Problema Identificado

El proyecto tenía múltiples carpetas duplicadas que causaban confusión:

### Antes de la consolidación:
```
/
├── outputs/              (❌ Redundante - vacía)
│   ├── reports/
│   └── xml/
├── uploads/              (❌ Redundante - solo sample.csv)
│   └── sample.csv
├── app/
│   ├── api/              (✅ Rutas Next.js - mantener)
│   ├── outputs/          (❌ Redundante - estructura vacía)
│   │   └── enriched/pending/
│   └── backend/
│       ├── outputs/      (✅ MANTENER - datos reales)
│       │   ├── enriched/
│       │   │   ├── pending/
│       │   │   ├── processed/
│       │   │   └── failed/
│       │   ├── reports/
│       │   ├── xml/
│       │   ├── modelo_ensemble_stack.pkl
│       │   └── otros modelos...
│       ├── uploads/      (✅ MANTENER - archivos de trabajo)
│       │   ├── *.csv (múltiples archivos)
│       │   └── archived/
│       └── api/
│           ├── outputs/  (❌ Redundante)
│           └── uploads/  (❌ Redundante)
```

## Solución Implementada

### Después de la consolidación:
```
/
├── app/
│   ├── api/              (✅ Rutas Next.js)
│   └── backend/
│       ├── outputs/      (✅ FUENTE DE VERDAD)
│       │   ├── enriched/
│       │   │   ├── pending/
│       │   │   ├── processed/
│       │   │   └── failed/
│       │   ├── reports/
│       │   ├── xml/
│       │   └── *.pkl (modelos)
│       ├── uploads/      (✅ FUENTE DE VERDAD)
│       │   ├── *.csv
│       │   ├── archived/
│       │   └── sample.csv
│       └── api/
│           ├── enhanced_main_api.py
│           ├── ml_runner.py
│           └── ... (sin subcarpetas redundantes)
```

## Carpetas Eliminadas

1. ❌ `/outputs/` - Vacía, no usada por el código
2. ❌ `/uploads/` - Solo contenía sample.csv (movido)
3. ❌ `/app/outputs/` - Estructura vacía
4. ❌ `/app/backend/api/outputs/` - Redundante
5. ❌ `/app/backend/api/uploads/` - Redundante

## Archivos Preservados

- ✅ `sample.csv` → Movido a `/app/backend/uploads/`
- ✅ Archivos pending → Consolidados en `/app/backend/outputs/enriched/pending/`
- ✅ XMLs → Movidos a `/app/backend/outputs/xml/`

## Código Afectado

### ✅ No requiere cambios
Todos los scripts Python ya usan `BASE_DIR` correctamente:

```python
# enhanced_main_api.py
BASE_DIR = Path(__file__).resolve().parent.parent  # → /app/backend/
archived_dir = BASE_DIR / "uploads" / "archived" / user_id
processed_path = BASE_DIR / "outputs" / "enriched" / "processed"

# ml_runner.py
BASE_DIR = Path(__file__).parent.parent  # → /app/backend/
PENDING_DIR = BASE_DIR / "outputs" / "enriched" / "pending"
PROCESSED_DIR = BASE_DIR / "outputs" / "enriched" / "processed"

# predictor_adaptive.py
self.outputs_dir = self.base_dir / "outputs"
self.models_dir = self.base_dir / "models"
```

### ✅ Una referencia hardcodeada (correcta)
```python
# generar_xml_lfpiorpi.py
out_dir: str = "app/backend/outputs/xml"  # ✅ Ya apunta a la ubicación correcta
```

## Cómo Ejecutar la Consolidación

```bash
# 1. Dar permisos de ejecución
chmod +x consolidate_folders.sh

# 2. Ejecutar desde la raíz del proyecto
bash consolidate_folders.sh

# 3. Verificar que el backend funciona
cd app/backend
source venv/bin/activate  # o activa tu entorno virtual
python api/enhanced_main_api.py
```

## Verificación Post-Consolidación

### 1. Verificar estructura
```bash
tree -L 3 app/backend/outputs/
tree -L 2 app/backend/uploads/
```

### 2. Verificar que no hay carpetas huérfanas
```bash
# Estas carpetas NO deben existir:
ls outputs/ 2>/dev/null && echo "❌ /outputs/ aún existe" || echo "✅ /outputs/ eliminado"
ls uploads/ 2>/dev/null && echo "❌ /uploads/ aún existe" || echo "✅ /uploads/ eliminado"
ls app/outputs/ 2>/dev/null && echo "❌ /app/outputs/ aún existe" || echo "✅ /app/outputs/ eliminado"
```

### 3. Probar el backend
```bash
cd app/backend
python api/enhanced_main_api.py
# Debe iniciar sin errores de rutas
```

### 4. Probar upload y análisis
```bash
# Verificar que los archivos se guardan correctamente en:
# - /app/backend/uploads/ (temporales)
# - /app/backend/outputs/enriched/pending/ (para ML)
# - /app/backend/outputs/enriched/processed/ (resultados)
```

## Beneficios de la Consolidación

✅ **Claridad:** Una sola fuente de verdad para outputs y uploads  
✅ **Menos errores:** No hay confusión sobre qué carpeta usar  
✅ **Fácil respaldo:** Todas las salidas en `/app/backend/outputs/`  
✅ **Mantenibilidad:** Estructura simple y predecible  
✅ **Sin cambios en código:** Los scripts ya usaban rutas relativas correctas  

## Rutas de Referencia

| Propósito | Ruta |
|-----------|------|
| Archivos temporales de upload | `/app/backend/uploads/` |
| Archivos archivados | `/app/backend/uploads/archived/{user_id}/` |
| CSV enriquecido pendiente ML | `/app/backend/outputs/enriched/pending/` |
| Resultados procesados (CSV + JSON) | `/app/backend/outputs/enriched/processed/` |
| Archivos que fallaron | `/app/backend/outputs/enriched/failed/` |
| Modelos ML | `/app/backend/outputs/*.pkl` |
| XMLs generados | `/app/backend/outputs/xml/` |
| Reportes | `/app/backend/outputs/reports/` |

## Notas Importantes

- ⚠️ **No crear nuevas carpetas en la raíz:** Mantener todo bajo `/app/backend/`
- ⚠️ **Usar rutas relativas con BASE_DIR:** No hardcodear rutas absolutas
- ⚠️ **Documentar nuevas carpetas:** Si se necesita crear una nueva estructura

## Fecha de Consolidación
2025-11-12

## Autor
Consolidación automatizada - TarantulaHawk Project
