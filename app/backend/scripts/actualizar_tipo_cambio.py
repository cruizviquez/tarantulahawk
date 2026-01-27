#!/usr/bin/env python3
"""
Script para actualizar el tipo de cambio MXN/USD diariamente desde Banxico
Se ejecuta diariamente: 0 6 * * * python actualizar_tipo_cambio.py

Fuentes:
1. Banxico API (oficial)
2. Fallback: open API pública
3. Fallback final: mantener el último valor conocido
"""

import os
import sys
import json
import requests
from datetime import datetime
from pathlib import Path
import pytz
from typing import Optional

# Zona horaria de Ciudad de México
MEXICO_CITY_TZ = pytz.timezone('America/Mexico_City')

# Directorio de almacenamiento
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
FX_DIR = DATA_DIR / "tipo_cambio"
FX_DIR.mkdir(parents=True, exist_ok=True)

FX_FILE = FX_DIR / "tipo_cambio_actual.json"

def getNowCDMX():
    """Obtiene el timestamp actual en zona horaria de CDMX"""
    return datetime.now(tz=MEXICO_CITY_TZ)

def toISOStringCDMX(dt: datetime = None) -> str:
    """Convierte una fecha a ISO string con zona horaria de CDMX"""
    if dt is None:
        dt = getNowCDMX()
    elif dt.tzinfo is None:
        dt = pytz.utc.localize(dt).astimezone(MEXICO_CITY_TZ)
    else:
        dt = dt.astimezone(MEXICO_CITY_TZ)
    return dt.isoformat()

def log(mensaje: str, nivel: str = "INFO"):
    """Log con timestamp en CDMX"""
    timestamp = getNowCDMX().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{nivel}] {mensaje}")

def obtener_tipo_cambio_banxico() -> Optional[float]:
    """
    Obtiene el tipo de cambio desde Banxico
    
    Nota: Banxico requiere autenticación, pero hay fuentes públicas alternativas.
    Si tienes token de Banxico, reemplaza la URL.
    
    Banxico GraphQL endpoint (requiere token):
    https://www.banxico.org.mx/
    
    Fallback a alternativa pública sin autenticación.
    """
    try:
        # Intento 1: API pública exchangerate-api.com (sin límite para desarrollo)
        url = "https://api.exchangerate-api.com/v4/latest/MXN"
        log(f"📡 Consultando {url}...")
        
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            tasa = data.get('rates', {}).get('USD')
            if tasa and tasa > 0:
                log(f"✅ Tipo de cambio desde exchangerate-api: 1 MXN = {tasa:.6f} USD")
                return float(tasa)
        else:
            log(f"⚠️ exchangerate-api retornó status {response.status_code}", "WARNING")
    except Exception as e:
        log(f"⚠️ Error con exchangerate-api: {str(e)}", "WARNING")
    
    try:
        # Intento 2: API alternativa (api.freecurrencyapi.com - limitado pero gratuito)
        url = "https://api.freecurrencyapi.com/v1/latest?base_currency=MXN&currencies=USD"
        log(f"📡 Consultando alternativa: freecurrencyapi...")
        
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            tasa = data.get('data', {}).get('USD')
            if tasa and tasa > 0:
                log(f"✅ Tipo de cambio desde freecurrencyapi: 1 MXN = {tasa:.6f} USD")
                return float(tasa)
        else:
            log(f"⚠️ freecurrencyapi retornó status {response.status_code}", "WARNING")
    except Exception as e:
        log(f"⚠️ Error con freecurrencyapi: {str(e)}", "WARNING")
    
    log("❌ No se pudo obtener el tipo de cambio desde APIs externas", "ERROR")
    return None

def cargar_tipo_cambio_anterior() -> Optional[dict]:
    """Carga el último tipo de cambio conocido del archivo"""
    try:
        if FX_FILE.exists():
            with open(FX_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        log(f"⚠️ Error leyendo tipo de cambio anterior: {str(e)}", "WARNING")
    return None

def guardar_tipo_cambio(tasa: float, fuente: str = "API") -> bool:
    """Guarda el tipo de cambio en archivo y retorna éxito"""
    try:
        data = {
            "tasa_mxn_usd": tasa,
            "fecha_actualizacion": toISOStringCDMX(),
            "fuente": fuente,
            "descripcion": "1 MXN = tasa_mxn_usd USD (para convertir: cantidad_mxn / tasa = cantidad_usd)"
        }
        
        with open(FX_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        log(f"✅ Tipo de cambio guardado: 1 MXN = {tasa:.6f} USD (fuente: {fuente})")
        return True
    except Exception as e:
        log(f"❌ Error guardando tipo de cambio: {str(e)}", "ERROR")
        return False

def actualizar_en_supabase(tasa: float) -> bool:
    """
    Intenta actualizar el tipo de cambio en Supabase (tabla configuracion_so)
    Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
    """
    try:
        from supabase import create_client
        
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not supabase_url or not supabase_key:
            log("⚠️ SUPABASE_URL o SERVICE_ROLE_KEY no configurados - saltando BD", "WARNING")
            return False
        
        supabase = create_client(supabase_url, supabase_key)
        
        # Intentar actualizar todas las configuraciones (se asume que hay al menos una)
        result = supabase.table('configuracion_so').update({
            'tipo_cambio_mxn_usd': tasa,
            'tipo_cambio_fecha': toISOStringCDMX(),
            'updated_at': toISOStringCDMX()
        }).execute()
        
        if result.data:
            log(f"✅ Tipo de cambio actualizado en Supabase BD ({len(result.data)} registros)")
            return True
        else:
            log("⚠️ No hay configuraciones en BD para actualizar", "WARNING")
            return False
    except ImportError:
        log("⚠️ Supabase client no instalado - saltando BD update", "WARNING")
        return False
    except Exception as e:
        log(f"⚠️ Error actualizando Supabase: {str(e)}", "WARNING")
        return False

def main():
    """Flujo principal"""
    log("🔄 Iniciando actualización de tipo de cambio...")
    
    # Intento 1: Obtener nuevo tipo de cambio desde APIs
    tasa_nueva = obtener_tipo_cambio_banxico()
    
    # Si obtenemos una tasa nueva, guardarla
    if tasa_nueva:
        guardar_tipo_cambio(tasa_nueva, "exchangerate-api.com")
        actualizar_en_supabase(tasa_nueva)
        log("✅ Tipo de cambio actualizado exitosamente")
        return 0
    
    # Si falla obtener nueva tasa, usar la anterior
    log("⚠️ No se pudo obtener nueva tasa - usando valor anterior", "WARNING")
    tasa_anterior = cargar_tipo_cambio_anterior()
    
    if tasa_anterior:
        tasa = tasa_anterior.get('tasa_mxn_usd', 17.5)
        log(f"✅ Usando tasa anterior: 1 MXN = {tasa:.6f} USD")
        actualizar_en_supabase(tasa)
        return 0
    
    # Fallback final: usar tasa por defecto
    log("❌ No hay tasa anterior - usando fallback $17.50 MXN/USD", "ERROR")
    guardar_tipo_cambio(17.5, "fallback_default")
    actualizar_en_supabase(17.5)
    return 1

if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)
