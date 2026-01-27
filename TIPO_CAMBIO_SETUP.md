# 📊 Tipo de Cambio MXN/USD - Actualización Diaria

## Overview

Sistema automatizado para actualizar el tipo de cambio MXN/USD diariamente desde APIs públicas (Banxico alternativas).

**Flujo:**
1. Script `actualizar_tipo_cambio.py` se ejecuta **diariamente a las 06:00 CDMX**
2. Obtiene la tasa de **exchangerate-api.com** u **freecurrencyapi** (fallback)
3. Guarda en archivo local (`app/backend/data/tipo_cambio/tipo_cambio_actual.json`)
4. Intenta actualizar en Supabase (`configuracion_so.tipo_cambio_mxn_usd`)
5. API `/api/fx/tipo-cambio` retorna la tasa actual (BD → archivo → fallback)

---

## Setup

### 1️⃣ Agregar Columnas a Supabase

Ejecuta este SQL en el **SQL Editor** de Supabase:

```sql
ALTER TABLE configuracion_so ADD COLUMN IF NOT EXISTS tipo_cambio_mxn_usd DECIMAL(10,6) DEFAULT 17.500000;
ALTER TABLE configuracion_so ADD COLUMN IF NOT EXISTS tipo_cambio_fecha TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_configuracion_tipo_cambio ON configuracion_so(tipo_cambio_fecha DESC);
```

### 2️⃣ Instalar Dependencias Python

```bash
# Si no está instalado
pip install pytz requests
```

### 3️⃣ Configurar Cron Job

#### **En Linux/Mac:**

```bash
# Abrir crontab
crontab -e

# Agregar esta línea (ejecuta 06:00 CDMX = 12:00 UTC):
0 12 * * * cd /workspaces/tarantulahawk && python3 app/backend/scripts/actualizar_tipo_cambio.py >> /var/log/tarantula_fx.log 2>&1
```

#### **En Docker:**

Si el backend corre en Docker, agregar a `Dockerfile` o `docker-compose.yml`:

```yaml
services:
  backend:
    image: my-backend
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    command: |
      bash -c "
      apt-get update && apt-get install -y cron &&
      (crontab -l 2>/dev/null; echo '0 12 * * * cd /app && python3 app/backend/scripts/actualizar_tipo_cambio.py >> /var/log/tarantula_fx.log 2>&1') | crontab - &&
      crond -f
      "
```

#### **En Render/Railway/Heroku (usando GitHub Actions o scheduler):**

Crear archivo `.github/workflows/update-fx.yml`:

```yaml
name: Update FX Rate Daily

on:
  schedule:
    # 06:00 CDMX = 12:00 UTC
    - cron: '0 12 * * *'

jobs:
  update-fx:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      
      - name: Install dependencies
        run: |
          pip install pytz requests supabase
      
      - name: Update FX Rate
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          cd /home/runner/work/tarantulahawk/tarantulahawk
          python3 app/backend/scripts/actualizar_tipo_cambio.py
```

---

## Prueba Manual

```bash
# Ejecutar script manualmente
cd /workspaces/tarantulahawk
python3 app/backend/scripts/actualizar_tipo_cambio.py

# Output esperado:
# [2026-01-27 06:00:00] [INFO] 🔄 Iniciando actualización de tipo de cambio...
# [2026-01-27 06:00:01] [INFO] 📡 Consultando https://api.exchangerate-api.com/v4/latest/MXN...
# [2026-01-27 06:00:02] [INFO] ✅ Tipo de cambio desde exchangerate-api: 1 MXN = 0.058571 USD
# [2026-01-27 06:00:02] [INFO] ✅ Tipo de cambio guardado: 1 MXN = 0.058571 USD (fuente: exchangerate-api.com)
# [2026-01-27 06:00:03] [INFO] ✅ Tipo de cambio actualizado en Supabase BD (1 registros)
# [2026-01-27 06:00:03] [INFO] ✅ Tipo de cambio actualizado exitosamente
```

### Verificar en Supabase

```sql
SELECT tipo_cambio_mxn_usd, tipo_cambio_fecha 
FROM configuracion_so 
LIMIT 1;

-- Resultado esperado:
-- tipo_cambio_mxn_usd | tipo_cambio_fecha
-- 0.058571             | 2026-01-27 12:00:00+00
```

### Verificar API

```bash
curl http://localhost:3000/api/fx/tipo-cambio

# Response:
# {
#   "success": true,
#   "tasa": 0.058571,
#   "fecha_actualizacion": "2026-01-27T06:00:00-06:00",
#   "fuente": "base_datos"
# }
```

---

## Cómo se Usa en Operaciones

El API `/api/operaciones` ahora:

1. **Obtiene la tasa** del helper `getFXRate()`
2. **Convierte MXN → USD** automáticamente
3. **Compara con umbral** de 17,500 USD (no MXN)

**Ejemplo:**
```
Operación:
  Monto: 350,000 MXN
  Tasa actual: 1 MXN = 0.058571 USD
  
Cálculo:
  350,000 MXN ÷ 17.142857 (tasa inversa) = 20,408 USD
  Clasificación: ✅ RELEVANTE (>= 17,500 USD)
```

---

## Fallback & Error Handling

Si el script falla:

1. **Usa el tipo de cambio anterior** (archivo local)
2. **Si no hay anterior**, usa **fallback $17.50**
3. **Logs completos** en `/var/log/tarantula_fx.log`

La operación NO se bloquea si el FX falla - siempre hay fallback.

---

## APIs Utilizadas

### Opción 1: exchangerate-api.com (RECOMENDADO)
- ✅ Gratuito, sin clave
- ✅ Actualizado diariamente
- ✅ Soporte 24/7
- 📊 ~1500 requests/mes gratis

### Opción 2: freecurrencyapi.com (FALLBACK)
- ✅ Gratuito, sin clave
- ✅ Actualizado diariamente
- 📊 ~300 requests/mes gratis

### Opción 3: Banxico API (OFICIAL)
- Requiere registro y token
- Más confiable para MX
- Usar si tienes token disponible

---

## Troubleshooting

### ❌ Error: "ModuleNotFoundError: No module named 'pytz'"

```bash
pip install pytz requests
```

### ❌ Error: "SUPABASE_URL o SERVICE_ROLE_KEY no configurados"

Esto **no detiene** el script - se guarda en archivo local igualmente.

Para actualizar BD:
```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-key
python3 app/backend/scripts/actualizar_tipo_cambio.py
```

### ❌ Cron no se ejecuta

```bash
# Verificar que cron está corriendo
sudo service cron status

# Ver logs
sudo tail -f /var/log/syslog | grep CRON

# Ver crontabs activos
crontab -l
```

---

## Monitoreo

### Ver últimas ejecuciones

```bash
grep "actualizar_tipo_cambio" /var/log/syslog | tail -20
```

### Configurar alertas

Si quieres recibir alertas en caso de error:

```python
# Agregar al final de actualizar_tipo_cambio.py
import smtplib
from email.mime.text import MIMEText

def enviar_alerta(error_msg):
    msg = MIMEText(f"FX Update Error:\n{error_msg}")
    msg['Subject'] = "⚠️ TarantulaHawk FX Error"
    msg['From'] = "alerts@tarantulahawk.com"
    msg['To'] = "devops@miempresa.com"
    
    with smtplib.SMTP('localhost') as server:
        server.send_message(msg)
```

---

## FAQ

**P: ¿Qué pasa si las APIs están caídas?**
R: Se mantiene el tipo de cambio anterior. El umbral de 17,500 USD sigue siendo válido.

**P: ¿Cómo cambio la hora de ejecución?**
R: Modifica el cron. `0 12 * * *` son las 12:00 UTC = 06:00 CDMX. Para 08:00 CDMX: `0 14 * * *`.

**P: ¿Puedo usar Banxico oficial?**
R: Sí. Reemplaza la función `obtener_tipo_cambio_banxico()` con la URL de Banxico + tu token.

**P: ¿Los clientes ven el tipo de cambio usado?**
R: Sí, en la respuesta de creación de operación aparece: `"monto_usd": 20408.16` (resultado de la conversión).
