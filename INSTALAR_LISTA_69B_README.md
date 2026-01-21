# 🚀 INSTALACIÓN RÁPIDA - LISTA 69B SAT

## Una línea para hacerlo todo:

```bash
bash INSTALAR_LISTA_69B.sh
```

O si prefieres Python:

```bash
python3 setup_lista69b_completo.py
```

---

## ¿Qué hace?

✅ Instala dependencias (pandas, requests, beautifulsoup4, openpyxl)  
✅ Descarga Lista 69B del SAT (primero)  
✅ Configura cron para actualización diaria a las 6:00 AM  
✅ Genera archivos JSON y TXT de búsqueda rápida  
✅ Muestra resumen de configuración  

---

## Después de instalar:

### Ver actualización automática (cron):
```bash
crontab -l | grep actualizar_lista_69b
```

### Actualizar manualmente:
```bash
python3 app/backend/scripts/actualizar_lista_69b.py
```

### Probar funcionamiento:
```bash
python3 app/backend/scripts/test_lista_69b.py
```

### Ejemplo interactivo:
```bash
python3 app/backend/scripts/ejemplo_lista_69b.py
```

### Ver estadísticas:
```bash
cat app/backend/data/lista_69b/metadata.json
wc -l app/backend/data/lista_69b/lista_69b_rfcs.txt
tail -f app/backend/data/lista_69b/actualizacion.log
```

---

## 📖 Documentación completa:

```bash
cat LISTA_69B_AUTOMATIZACION.md    # Docs detallada
cat LISTA_69B_QUICK_REFERENCE.txt  # Guía rápida
```

---

**¡Listo! Tu sistema está automatizado y el cron se ejecutará diariamente a las 6am** ⏰
