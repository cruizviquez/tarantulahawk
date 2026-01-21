#!/usr/bin/env python3
"""
Verificador de estado - Lista 69B SAT
Muestra el estado actual de la instalación y configuración
"""

import subprocess
import json
import sys
from pathlib import Path
from datetime import datetime

def print_section(titulo):
    print("\n" + "="*70)
    print(f"📋 {titulo}")
    print("="*70)

def print_ok(msg):
    print(f"✅ {msg}")

def print_error(msg):
    print(f"❌ {msg}")

def print_warning(msg):
    print(f"⚠️  {msg}")

def print_info(msg):
    print(f"ℹ️  {msg}")

def main():
    print("\n" + "╔" + "="*68 + "╗")
    print("║" + " "*18 + "VERIFICADOR LISTA 69B SAT" + " "*25 + "║")
    print("╚" + "="*68 + "╝\n")
    
    proyecto_root = Path(__file__).parent
    backend_scripts = proyecto_root / "app/backend/scripts"
    data_dir = proyecto_root / "app/backend/data/lista_69b"
    
    # 1. Verificar archivos de script
    print_section("1. SCRIPTS")
    
    scripts_requeridos = [
        "actualizar_lista_69b.py",
        "test_lista_69b.py",
        "ejemplo_lista_69b.py"
    ]
    
    for script in scripts_requeridos:
        ruta = backend_scripts / script
        if ruta.exists():
            tamaño = ruta.stat().st_size
            print_ok(f"{script} ({tamaño:,} bytes)")
        else:
            print_error(f"{script} - NO ENCONTRADO")
    
    # 2. Verificar archivos de datos
    print_section("2. DATOS DESCARGADOS")
    
    if not data_dir.exists():
        print_warning("Directorio de datos no existe yet")
        print_info("Ejecutar: bash INSTALAR_LISTA_69B.sh")
    else:
        archivos_datos = {
            "lista_69b.json": "Lista completa",
            "lista_69b_rfcs.txt": "Solo RFCs",
            "metadata.json": "Metadata",
            "actualizacion.log": "Log de operaciones"
        }
        
        for archivo, desc in archivos_datos.items():
            ruta = data_dir / archivo
            if ruta.exists():
                tamaño = ruta.stat().st_size
                print_ok(f"{archivo:30} {tamaño:>10,} bytes - {desc}")
                
                # Mostrar info adicional
                if archivo == "metadata.json":
                    try:
                        with open(ruta) as f:
                            meta = json.load(f)
                            print(f"    └─ Total RFCs: {meta.get('total_rfcs', 0):,}")
                            print(f"    └─ Actualización: {meta.get('fecha_actualizacion', 'N/A')}")
                    except:
                        pass
            else:
                print_warning(f"{archivo:30} - NO ENCONTRADO")
    
    # 3. Verificar dependencias Python
    print_section("3. DEPENDENCIAS PYTHON")
    
    dependencias = {
        "requests": "HTTP requests",
        "bs4": "Web scraping",
        "pandas": "Excel processing",
        "openpyxl": "Excel reader"
    }
    
    for modulo, desc in dependencias.items():
        try:
            __import__(modulo)
            print_ok(f"{modulo:20} {desc}")
        except ImportError:
            print_warning(f"{modulo:20} NO INSTALADO")
    
    # 4. Verificar cron
    print_section("4. AUTOMATIZACIÓN (CRON)")
    
    try:
        resultado = subprocess.run(
            ["crontab", "-l"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if resultado.returncode == 0:
            if "actualizar_lista_69b.py" in resultado.stdout:
                print_ok("Cron configurado para Lista 69B")
                for linea in resultado.stdout.split("\n"):
                    if "actualizar_lista_69b.py" in linea:
                        print(f"    └─ {linea}")
            else:
                print_warning("Cron NO configurado para Lista 69B")
                print_info("Para configurar: bash INSTALAR_LISTA_69B.sh")
        else:
            print_warning("No se pudo leer crontab")
    except FileNotFoundError:
        print_warning("Comando crontab no disponible (Windows/Docker?)")
        print_info("Ejecutar manualmente: python3 app/backend/scripts/actualizar_lista_69b.py")
    except Exception as e:
        print_warning(f"Error verificando cron: {e}")
    
    # 5. Verificar integración con KYC
    print_section("5. INTEGRACIÓN KYC")
    
    kyc_service = proyecto_root / "app/backend/services/kyc_free_apis.py"
    if kyc_service.exists():
        with open(kyc_service) as f:
            contenido = f.read()
            if "Lista69BService" in contenido and "_cargar_lista" in contenido:
                print_ok("Lista69BService integrado en kyc_free_apis.py")
            else:
                print_warning("Lista69BService puede no estar correctamente integrado")
    
    # 6. Resumen y recomendaciones
    print_section("6. PRÓXIMOS PASOS")
    
    if not (data_dir / "metadata.json").exists():
        print_warning("Lista 69B no descargada aún")
        print("\n🚀 Para completar la instalación:\n")
        print("   bash INSTALAR_LISTA_69B.sh\n")
    else:
        print_ok("Sistema completamente configurado\n")
        print("💡 Comandos útiles:\n")
        print("   Ver logs:      tail -f app/backend/data/lista_69b/actualizacion.log")
        print("   Actualizar:    python3 app/backend/scripts/actualizar_lista_69b.py")
        print("   Probar:        python3 app/backend/scripts/test_lista_69b.py")
        print("   Interactivo:   python3 app/backend/scripts/ejemplo_lista_69b.py")
        print("   Ver cron:      crontab -l | grep actualizar_lista_69b")
        print()
    
    print("="*70 + "\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())
