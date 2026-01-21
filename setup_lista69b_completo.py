#!/usr/bin/env python3
"""
Script de instalación y configuración de Lista 69B SAT
Ejecutar: python3 setup_lista69b_completo.py
"""

import os
import sys
import subprocess
import json
from pathlib import Path
from datetime import datetime

def print_header(titulo):
    """Imprime encabezado formateado"""
    print("\n" + "="*70)
    print(f"🚀 {titulo}")
    print("="*70 + "\n")

def print_success(msg):
    """Imprime mensaje de éxito"""
    print(f"✅ {msg}")

def print_error(msg):
    """Imprime mensaje de error"""
    print(f"❌ {msg}")

def print_warning(msg):
    """Imprime mensaje de advertencia"""
    print(f"⚠️  {msg}")

def print_info(msg):
    """Imprime mensaje de info"""
    print(f"ℹ️  {msg}")

def instalar_dependencias():
    """Instala dependencias necesarias"""
    print_header("PASO 1/3: Instalando Dependencias")
    
    dependencias = [
        "requests",
        "beautifulsoup4",
        "pandas",
        "openpyxl"
    ]
    
    print(f"Instalando {len(dependencias)} paquetes...")
    
    try:
        for dep in dependencias:
            print(f"  📦 {dep}...", end=" ")
            resultado = subprocess.run(
                [sys.executable, "-m", "pip", "install", "-q", dep],
                capture_output=True,
                timeout=60
            )
            if resultado.returncode == 0:
                print("✅")
            else:
                print(f"⚠️  (puede estar instalado)")
        
        print_success("Dependencias listas")
        return True
    except Exception as e:
        print_error(f"Error instalando dependencias: {e}")
        return False

def ejecutar_descarga():
    """Ejecuta descarga de Lista 69B"""
    print_header("PASO 2/3: Descargando Lista 69B del SAT")
    
    script_path = Path(__file__).parent / "app" / "backend" / "scripts" / "actualizar_lista_69b.py"
    
    if not script_path.exists():
        print_error(f"Script no encontrado: {script_path}")
        return False
    
    print(f"Ejecutando: {script_path.name}")
    print("(Esto puede tardar 1-2 minutos...)\n")
    
    try:
        resultado = subprocess.run(
            [sys.executable, str(script_path)],
            cwd=script_path.parent,
            timeout=300
        )
        
        if resultado.returncode == 0:
            print_success("Lista 69B descargada correctamente")
            
            # Verificar metadata
            metadata_path = script_path.parent / ".." / "data" / "lista_69b" / "metadata.json"
            if metadata_path.exists():
                with open(metadata_path) as f:
                    metadata = json.load(f)
                    total = metadata.get("total_rfcs", 0)
                    if total > 0:
                        print_info(f"Total RFCs: {total:,}")
                        if metadata.get("tipos"):
                            for tipo, cantidad in metadata["tipos"].items():
                                print(f"         - {tipo}: {cantidad:,}")
            return True
        else:
            print_warning("La descarga completó pero con warnings")
            return True
            
    except subprocess.TimeoutExpired:
        print_error("Timeout descargando lista (>5min)")
        return False
    except Exception as e:
        print_error(f"Error en descarga: {e}")
        return False

def configurar_cron():
    """Configura cron para actualización automática"""
    print_header("PASO 3/3: Configurando Actualización Automática (Cron)")
    
    script_path = Path(__file__).parent / "app" / "backend" / "scripts" / "actualizar_lista_69b.py"
    
    if not script_path.exists():
        print_warning("Script no encontrado, no se configuró cron")
        return False
    
    # Comando a ejecutar
    python_cmd = sys.executable
    cron_command = f"0 6 * * * cd {script_path.parent} && {python_cmd} {script_path.name} >> {script_path.parent}/../data/lista_69b/cron.log 2>&1"
    
    print(f"⏰ Horario: Diariamente a las 6:00 AM UTC")
    print(f"🐍 Python: {python_cmd}")
    print(f"📁 Directorio: {script_path.parent}")
    print()
    
    try:
        # Obtener crontab actual
        resultado_get = subprocess.run(
            ["crontab", "-l"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        crontab_actual = resultado_get.stdout if resultado_get.returncode == 0 else ""
        
        # Verificar si ya existe
        if "actualizar_lista_69b.py" in crontab_actual:
            print_warning("Cron ya configurado para Lista 69B")
            print("\n📋 Cron actual:")
            for linea in crontab_actual.split("\n"):
                if "actualizar_lista_69b.py" in linea:
                    print(f"   {linea}")
            return True
        
        # Agregar nuevo cron
        nuevo_crontab = crontab_actual + cron_command + "\n"
        
        resultado_set = subprocess.run(
            ["crontab", "-"],
            input=nuevo_crontab,
            text=True,
            capture_output=True,
            timeout=5
        )
        
        if resultado_set.returncode == 0:
            print_success("Cron configurado exitosamente")
            print("\n📋 Comando agregado:")
            print(f"   {cron_command}")
            print("\n💡 Comandos útiles:")
            print("   Ver cron:      crontab -l")
            print("   Editar cron:   crontab -e")
            print("   Ver logs:      tail -f app/backend/data/lista_69b/cron.log")
            return True
        else:
            print_warning("No se pudo configurar cron (es normal en algunos entornos)")
            print("\n💡 Puedes hacerlo manualmente:")
            print("   crontab -e")
            print(f"   Agregar: {cron_command}")
            return True
            
    except FileNotFoundError:
        print_warning("Comando 'crontab' no disponible en este sistema")
        print("   (Normal en Windows, Docker, o algunos entornos)")
        print(f"\n💡 Puedes ejecutar manualmente periodicamente:")
        print(f"   python3 {script_path}")
        return True
    except Exception as e:
        print_warning(f"Error configurando cron: {e}")
        return True

def mostrar_resumen():
    """Muestra resumen final"""
    print_header("✅ CONFIGURACIÓN COMPLETADA")
    
    data_path = Path(__file__).parent / "app" / "backend" / "data" / "lista_69b"
    
    print("📊 ESTADO:")
    
    # Verificar cron
    try:
        resultado = subprocess.run(
            ["crontab", "-l"],
            capture_output=True,
            text=True
        )
        if "actualizar_lista_69b.py" in resultado.stdout:
            print("   ✅ Actualización automática (cron): ACTIVA")
        else:
            print("   ⚠️  Actualización automática (cron): No configurada")
    except:
        pass
    
    # Verificar metadata
    metadata_file = data_path / "metadata.json"
    if metadata_file.exists():
        try:
            with open(metadata_file) as f:
                metadata = json.load(f)
                total = metadata.get("total_rfcs", 0)
                fecha = metadata.get("fecha_actualizacion", "desconocida")
                print(f"   ✅ Lista descargada: {total:,} RFCs")
                print(f"   📅 Última actualización: {fecha}")
        except:
            pass
    
    print(f"\n📁 Archivos en: {data_path}")
    if data_path.exists():
        for archivo in data_path.glob("*"):
            tamaño = archivo.stat().st_size
            tamaño_str = f"{tamaño/1024/1024:.1f}MB" if tamaño > 1024*1024 else f"{tamaño/1024:.1f}KB"
            print(f"   {archivo.name:30} {tamaño_str:>10}")
    
    print(f"\n💡 PRÓXIMOS PASOS:")
    print("   1. Ver metadata:")
    print("      cat app/backend/data/lista_69b/metadata.json")
    print("   2. Probar búsqueda:")
    print("      python3 app/backend/scripts/test_lista_69b.py")
    print("   3. Ejemplo interactivo:")
    print("      python3 app/backend/scripts/ejemplo_lista_69b.py")
    print("   4. Ver cron:")
    print("      crontab -l | grep actualizar_lista_69b")
    print()

def main():
    """Función principal"""
    print("\n" + "╔" + "="*68 + "╗")
    print("║" + " "*15 + "LISTA 69B SAT - SETUP COMPLETO" + " "*24 + "║")
    print("╚" + "="*68 + "╝")
    
    # Paso 1: Dependencias
    if not instalar_dependencias():
        print_error("No se pudieron instalar dependencias")
        sys.exit(1)
    
    # Paso 2: Descarga
    if not ejecutar_descarga():
        print_warning("Hubo un problema en la descarga")
        # Continuar igual
    
    # Paso 3: Cron
    configurar_cron()
    
    # Resumen
    mostrar_resumen()
    
    print("="*70 + "\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())
