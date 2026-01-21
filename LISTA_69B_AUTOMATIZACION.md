# 📋 Actualización Automática de Lista 69B SAT

## 🎯 Descripción

Sistema automatizado para descargar y mantener actualizada la **Lista 69B del SAT** (Empresas que no desvirtuaron operaciones con EDOS - Empresas que facturan Operaciones Simuladas).

**Fuente oficial**: https://www.sat.gob.mx/consulta/92764/descarga-de-listados-completos

---

## 🚀 Instalación

### 1. Instalar dependencias

```bash
chmod +x app/backend/scripts/instalar_dependencias_lista69b.sh
./app/backend/scripts/instalar_dependencias_lista69b.sh
```

O manualmente:
```bash
pip install requests beautifulsoup4 pandas openpyxl tabula-py PyPDF2
```

### 2. Ejecutar primera descarga

```bash
python app/backend/scripts/actualizar_lista_69b.py
```

---

## 📂 Archivos generados

Después de la primera ejecución, se crearán automáticamente:

```
app/backend/data/lista_69b/
├── lista_69b.json          # Lista completa con todos los datos
├── lista_69b_rfcs.txt      # Solo RFCs (1 por línea)
├── metadata.json           # Información de la actualización
└── actualizacion.log       # Historial de ejecuciones
```

### Ejemplo de `lista_69b.json`:
```json
[
  {
    "rfc": "ABC123456XYZ",
    "tipo": "definitivos",
    "fecha_descarga": "2026-01-20T10:30:00",
    "nombre": "EMPRESA EJEMPLO SA DE CV",
    "situacion": "Definitivo Art 69-B CFF"
  }
]
```

### Ejemplo de `metadata.json`:
```json
{
  "total_rfcs": 12543,
  "fecha_actualizacion": "2026-01-20T10:30:00",
  "fuente": "SAT México - Lista 69B",
  "version_script": "1.0.0",
  "tipos": {
    "definitivos": 8234,
    "presuntos": 4309
  }
}
```

---

## 🔄 Automatización

### Opción 1: Cron (Linux/Mac)

Editar crontab:
```bash
crontab -e
```

Agregar línea para ejecución diaria a las 6:00 AM:
```bash
0 6 * * * cd /workspaces/tarantulahawk && /usr/bin/python3 app/backend/scripts/actualizar_lista_69b.py >> /var/log/lista69b.log 2>&1
```

### Opción 2: Systemd Timer (Linux)

Crear `/etc/systemd/system/lista69b.service`:
```ini
[Unit]
Description=Actualizar Lista 69B SAT

[Service]
Type=oneshot
User=www-data
WorkingDirectory=/workspaces/tarantulahawk
ExecStart=/usr/bin/python3 app/backend/scripts/actualizar_lista_69b.py
```

Crear `/etc/systemd/system/lista69b.timer`:
```ini
[Unit]
Description=Timer para actualizar Lista 69B diariamente

[Timer]
OnCalendar=daily
OnCalendar=06:00
Persistent=true

[Install]
WantedBy=timers.target
```

Activar:
```bash
sudo systemctl enable lista69b.timer
sudo systemctl start lista69b.timer
```

### Opción 3: GitHub Actions (CI/CD)

Crear `.github/workflows/actualizar-lista69b.yml`:
```yaml
name: Actualizar Lista 69B

on:
  schedule:
    - cron: '0 6 * * *'  # Diario 6am UTC
  workflow_dispatch:  # Manual

jobs:
  actualizar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Instalar dependencias
        run: |
          pip install requests beautifulsoup4 pandas openpyxl
      
      - name: Ejecutar actualización
        run: |
          python app/backend/scripts/actualizar_lista_69b.py
      
      - name: Commit y push
        run: |
          git config user.name "Bot Lista 69B"
          git config user.email "bot@tarantulahawk.com"
          git add app/backend/data/lista_69b/
          git commit -m "🤖 Actualización automática Lista 69B SAT" || exit 0
          git push
```

---

## 🔍 Uso en el código

### Búsqueda de RFC

```python
from app.backend.services.kyc_free_apis import Lista69BService

# Buscar RFC
resultado = Lista69BService.buscar_rfc("ABC123456XYZ")

if resultado["en_lista"]:
    print(f"⚠️ ALERTA: {resultado['advertencia']}")
    print(f"Tipo: {resultado['tipo_lista']}")
else:
    print("✅ RFC no está en Lista 69B")
```

### Verificar metadata

```python
metadata = Lista69BService.obtener_metadata()

print(f"Total RFCs en lista: {metadata['total_rfcs']}")
print(f"Última actualización: {metadata['fecha_actualizacion']}")
print(f"Tipos: {metadata['tipos']}")
```

### Búsqueda directa en archivo

```python
from app.backend.scripts.actualizar_lista_69b import buscar_rfc_en_lista

entrada = buscar_rfc_en_lista("ABC123456XYZ")
if entrada:
    print(f"RFC encontrado: {entrada}")
```

---

## 📊 Monitoreo

### Ver log de ejecuciones

```bash
tail -f app/backend/data/lista_69b/actualizacion.log
```

### Verificar última actualización

```bash
cat app/backend/data/lista_69b/metadata.json | jq '.fecha_actualizacion'
```

### Contar RFCs descargados

```bash
wc -l app/backend/data/lista_69b/lista_69b_rfcs.txt
```

---

## ⚙️ Configuración avanzada

### Cambiar directorio de datos

Editar en `actualizar_lista_69b.py`:
```python
DATA_DIR = Path("/ruta/personalizada/lista_69b")
```

### Ajustar timeout de descarga

```python
response = self.session.get(url, timeout=120)  # 2 minutos
```

### Forzar recarga sin cache

```python
lista = Lista69BService._cargar_lista(forzar=True)
```

---

## 🐛 Troubleshooting

### ❌ Error: "No se encontraron enlaces de descarga"

**Causa**: El SAT cambió la estructura de su página web.

**Solución**:
1. Visitar manualmente: https://www.sat.gob.mx/consulta/92764/descarga-de-listados-completos
2. Descargar archivos Excel de "Definitivos" y "Presuntos"
3. Colocarlos en `app/backend/data/lista_69b/`
4. Ejecutar script manualmente

### ❌ Error: "No se encontró columna RFC en el Excel"

**Causa**: El SAT cambió el formato de sus archivos Excel.

**Solución**: Revisar manualmente el Excel y actualizar el código en `_descargar_excel()` para buscar la columna correcta.

### ⚠️ Advertencia: "Lista no disponible localmente"

**Causa**: No se ha ejecutado nunca `actualizar_lista_69b.py`.

**Solución**:
```bash
python app/backend/scripts/actualizar_lista_69b.py
```

---

## 📅 Frecuencia de actualización recomendada

- **Producción**: Diaria (6:00 AM)
- **Desarrollo**: Semanal
- **Testing**: Manual según necesidad

El SAT actualiza la lista mensualmente, pero es recomendable verificar diariamente por cambios.

---

## 🔒 Seguridad

### Validación de datos descargados

El script valida automáticamente:
- ✅ Formato de RFC (12-13 caracteres)
- ✅ Estructura del Excel
- ✅ Encoding UTF-8
- ✅ Eliminación de duplicados

### Respaldo automático

Antes de actualizar, hacer respaldo:
```bash
cp app/backend/data/lista_69b/lista_69b.json \
   app/backend/data/lista_69b/lista_69b_backup_$(date +%Y%m%d).json
```

---

## 📈 Estadísticas

El script genera automáticamente:
- Total de RFCs descargados
- Distribución por tipo (definitivos/presuntos)
- Timestamp de última actualización
- Historial en log

---

## 🤝 Contribuir

Para mejorar el script:

1. Fork del repositorio
2. Crear rama: `git checkout -b feature/mejora-lista69b`
3. Commit: `git commit -m 'Mejora en descarga Lista 69B'`
4. Push: `git push origin feature/mejora-lista69b`
5. Pull Request

---

## 📞 Soporte

- **Documentación SAT**: https://www.sat.gob.mx/consulta/92764
- **Issues GitHub**: https://github.com/cruizviquez/tarantulahawk/issues
- **Email**: soporte@tarantulahawk.com

---

## 📜 Licencia

Este script es parte del proyecto TarantulaHawk y está bajo la misma licencia del proyecto principal.

**Nota legal**: Los datos de la Lista 69B son propiedad del SAT (Servicio de Administración Tributaria de México) y se utilizan únicamente con fines de cumplimiento normativo PLD/FT.
