# 📜 Scripts Backend - TarantulaHawk

## 📋 Lista 69B SAT - Actualización Automática

### 🚀 Inicio Rápido

```bash
# 1. Instalar dependencias
./instalar_dependencias_lista69b.sh

# 2. Descargar Lista 69B del SAT
python actualizar_lista_69b.py

# 3. Probar funcionamiento
python test_lista_69b.py
```

---

## 📁 Archivos

### `actualizar_lista_69b.py` ⭐
Script principal para descargar y actualizar automáticamente la Lista 69B del SAT.

**Uso**:
```bash
python actualizar_lista_69b.py
```

**Funcionalidades**:
- ✅ Descarga automática desde SAT
- ✅ Procesamiento de archivos Excel
- ✅ Validación de RFCs
- ✅ Eliminación de duplicados
- ✅ Generación de JSON y TXT
- ✅ Logging completo
- ✅ Metadata con estadísticas

**Salida** (en `app/backend/data/lista_69b/`):
- `lista_69b.json` - Lista completa
- `lista_69b_rfcs.txt` - Solo RFCs (1 por línea)
- `metadata.json` - Info de actualización
- `actualizacion.log` - Historial

---

### `instalar_dependencias_lista69b.sh`
Instala todas las dependencias Python necesarias.

**Uso**:
```bash
chmod +x instalar_dependencias_lista69b.sh
./instalar_dependencias_lista69b.sh
```

**Dependencias instaladas**:
- `requests` - HTTP requests
- `beautifulsoup4` - HTML parsing
- `pandas` - Excel processing
- `openpyxl` - Excel reader
- `tabula-py` - PDF tables (opcional)
- `PyPDF2` - PDF reader (opcional)

---

### `test_lista_69b.py`
Script de prueba para verificar funcionamiento de Lista 69B.

**Uso**:
```bash
python test_lista_69b.py
```

**Verifica**:
- ✅ Metadata de lista descargada
- ✅ Búsqueda de RFC
- ✅ Funcionamiento de cache
- ✅ Mensajes de error si no está descargada

---

## 🔄 Automatización

### Cron (Diario 6am)

```bash
crontab -e
```

Agregar:
```bash
0 6 * * * cd /workspaces/tarantulahawk && python app/backend/scripts/actualizar_lista_69b.py
```

---

## 📊 Monitoreo

### Ver última actualización
```bash
cat ../data/lista_69b/metadata.json | python -m json.tool
```

### Contar RFCs
```bash
wc -l ../data/lista_69b/lista_69b_rfcs.txt
```

### Ver log
```bash
tail -f ../data/lista_69b/actualizacion.log
```

---

## 🐛 Troubleshooting

### Error: "Lista no disponible localmente"
**Solución**: Ejecutar `python actualizar_lista_69b.py`

### Error: "ModuleNotFoundError: No module named 'pandas'"
**Solución**: Ejecutar `./instalar_dependencias_lista69b.sh`

### Error: "No se encontraron enlaces de descarga"
**Solución**: 
1. Descargar manualmente desde: https://www.sat.gob.mx/consulta/92764
2. Colocar Excel en `../data/lista_69b/`
3. Actualizar URLs en el script

---

## 📖 Documentación Completa

Ver: [LISTA_69B_AUTOMATIZACION.md](../../../LISTA_69B_AUTOMATIZACION.md)

---

## 🔗 Enlaces

- **SAT Lista 69B**: https://www.sat.gob.mx/consulta/92764/descarga-de-listados-completos
- **Documentación**: https://www.sat.gob.mx/normatividad/52966/conoce-la-lista-completa
- **Artículo 69-B CFF**: Código Fiscal de la Federación

---

Última actualización: 2026-01-20
