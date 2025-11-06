# ML Runner - Sistema de Inferencia Robusto

## 🎯 Arquitectura

```
Usuario sube CSV → Validador Enriquecedor → pending/ → ML Runner → processed/
                                                                 ↓
                                                              failed/
```

## 📁 Estructura de carpetas

```
app/backend/outputs/enriched/
├── pending/           # Archivos enriquecidos esperando procesamiento
│   └── {analysis_id}.csv
├── processed/         # Archivos procesados exitosamente
│   ├── {analysis_id}.csv
│   └── {analysis_id}.json  # Resultados ML
└── failed/            # Archivos con errores
    ├── {analysis_id}.csv
    └── {analysis_id}_error.json
```

## 🔧 Flujo de Inferencia

### 1. Upload (API)
```python
# enhanced_main_api.py - endpoint /api/portal/upload
1. Usuario sube archivo.csv
2. Se valida estructura básica
3. Se llama validador_enriquecedor con training_mode=False
4. Se genera outputs/enriched/pending/{analysis_id}.csv
```

### 2. Enriquecimiento (validador_enriquecedor.py)
```python
# Modo inferencia (training_mode=False):
- NO incluye columna clasificacion_lfpiorpi
- Genera 26 features numéricas + temporales
- Guarda en pending/ con nombre único (analysis_id)
```

### 3. Procesamiento ML (ml_runner.py)
```python
# Lee pending/{analysis_id}.csv
1. Alinea features a PKL columns (one-hot + relleno de faltantes)
2. Ejecuta 3 capas ML:
   - Supervisado (Ensemble Stacking)
   - No Supervisado (Isolation Forest + KMeans)
   - Refuerzo (Q-Learning thresholds)
3. Aplica guardrails LFPIORPI
4. Guarda resultados en processed/{analysis_id}.json
5. Mueve CSV a processed/ o failed/
```

### 4. Retorno de Resultados (API)
```python
# Lee processed/{analysis_id}.json
- Cobra transacciones vía Supabase billing
- Retorna resultados al usuario
```

## 🚀 Uso

### Modo sincrónico (API Portal)
```bash
# El endpoint /api/portal/upload ejecuta automáticamente:
POST /api/portal/upload
→ enriquece en pending/
→ ejecuta ml_runner.py {analysis_id}
→ retorna resultados
```

### Modo manual (debugging/testing)
```bash
# Procesar todos los pending
cd /workspaces/tarantulahawk/app/backend/api
python3 ml_runner.py

# Procesar archivo específico
python3 ml_runner.py <analysis_id>
```

### Modo batch/cron (futura escala)
```bash
# Worker que procesa pending/ cada N segundos
while true; do
    python3 ml_runner.py
    sleep 10
done
```

## 📊 Alineación de Features

El runner usa `align_features()` para:
1. Eliminar columnas no usadas (cliente_id, fecha, clasificacion_lfpiorpi)
2. One-hot encode categóricas (tipo_operacion, sector_actividad, fraccion)
3. Rellenar features faltantes:
   - Dummies no vistas: 0
   - Numéricas: median del batch (o 0 si todo es NaN)
4. Sanitizar INF/NaN
5. Ordenar según `model_data['columns']`

## ⚠️ Consideraciones para Escala

### Para 10k+ usuarios concurrentes:
1. **Storage**: Mover pending/processed/failed a S3/Supabase Storage
2. **Queue**: Usar tabla DB o Redis para encolar jobs (no filesystem)
3. **Workers**: Múltiples instancias del runner con pulling desde queue
4. **Idempotencia**: analysis_id único + retry logic
5. **Async**: Endpoint retorna 202 Accepted + webhook/polling para resultados

### Actual (1 instancia, FS local):
- ✅ Maneja 1-10 usuarios simultáneos
- ✅ Atomic writes (tempfile + shutil.move)
- ✅ Nombres únicos (analysis_id = UUID)
- ⚠️  Sin retry logic
- ⚠️  Sin clustering (1 worker)

## 🔒 Seguridad

- Validación de tamaño de archivo (500MB max)
- Sanitización de features (INF/NaN)
- Timeout en runner (5 min)
- Error handling con traceback guardado
- No expone paths internos en errores públicos

## 📈 Métricas Clave

Monitor en logs:
- `⏱️  Tiempo de enriquecimiento`
- `⏱️  Tiempo de inferencia (3 capas)`
- `📊 Clasificación: preocupante/inusual/relevante/limpio`
- `⚖️  Guardrails aplicados`
- `✅/❌ Exitosos vs fallidos`

## 🐛 Debugging

```bash
# Ver archivos pendientes
ls -lh /workspaces/tarantulahawk/app/backend/outputs/enriched/pending/

# Ver resultados procesados
ls -lh /workspaces/tarantulahawk/app/backend/outputs/enriched/processed/

# Ver errores
cat /workspaces/tarantulahawk/app/backend/outputs/enriched/failed/*_error.json

# Logs del runner (si se ejecuta manualmente)
python3 ml_runner.py 2>&1 | tee runner.log
```

## ✅ Smoke Test

```bash
# 1. Preparar CSV de prueba
cat > test_input.csv << EOF
cliente_id,monto,fecha,tipo_operacion,sector_actividad
12345,50000,2025-01-15,efectivo,casa_cambio
12346,180000,2025-01-16,transferencia_nacional,inmobiliaria
EOF

# 2. Enriquecer (modo inferencia)
cd /workspaces/tarantulahawk/app/backend/api/utils
python3 validador_enriquecedor.py test_input.csv random null false test_001

# 3. Verificar pending
ls -lh ../../outputs/enriched/pending/test_001.csv

# 4. Ejecutar runner
cd /workspaces/tarantulahawk/app/backend/api
python3 ml_runner.py test_001

# 5. Verificar resultados
cat ../../outputs/enriched/processed/test_001.json
```

## 📝 Notas de Implementación

- **PKL columns**: El runner lee `model_data['columns']` de cada PKL
- **No config editing**: No se edita config_modelos.json por upload
- **Atomic moves**: Evita condiciones de carrera en FS
- **training_mode**: Separación clara entre entrenamiento e inferencia
- **Billing**: Solo se cobra después de ML exitoso
