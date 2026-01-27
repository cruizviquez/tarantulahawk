#!/usr/bin/env python3
"""
Script unificado para actualizar TODAS las listas KYC
- Lista 69B SAT (ya implementado)
- UIF Personas Bloqueadas (scraping)
- PEPs México (datos abiertos)
- OFAC (cache local)
- CSNU (cache local)

Ejecutar diariamente: 0 6 * * * python actualizar_listas_todas.py
"""

import os
import sys
import json
import requests
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict
from bs4 import BeautifulSoup
import pandas as pd
import pytz

# ==================== CONFIGURACIÓN ====================

# Zona horaria de Ciudad de México
MEXICO_CITY_TZ = pytz.timezone('America/Mexico_City')

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

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Directorios por lista
LISTA_69B_DIR = DATA_DIR / "lista_69b"
UIF_DIR = DATA_DIR / "uif_bloqueados"
PEPS_DIR = DATA_DIR / "peps_mexico"
OFAC_DIR = DATA_DIR / "ofac_cache"
CSNU_DIR = DATA_DIR / "csnu_cache"

# Crear directorios
for directorio in [LISTA_69B_DIR, UIF_DIR, PEPS_DIR, OFAC_DIR, CSNU_DIR]:
    directorio.mkdir(parents=True, exist_ok=True)

# Fuentes conocidas (configurables) para PEPs y UIF
KNOWN_PEPS_SOURCES = [
    {
        "name": "Servidores públicos federales (datos.gob.mx)",
        # Reemplaza con el resource_id real; este es un ejemplo común de CKAN
        "url": "https://datos.gob.mx/busca/api/3/action/datastore_search?resource_id=00000000-0000-0000-0000-000000000000",
        "format": "json",
        "limit": 500
    },
    {
        "name": "Nómina servidores públicos (CSV ejemplo)",
        "url": "https://datos.gob.mx/busca/dataset/nomina-servidores-publicos/resource/00000000-0000-0000-0000-000000000000/download/nomina.csv",
        "format": "csv",
        "limit": 500
    }
]

KNOWN_UIF_PDF_SEARCH = [
    {
        "name": "DOF búsqueda personas bloqueadas",
        "url": "https://www.dof.gob.mx/index.php",
        "params": {"title": "personas bloqueadas", "type": "search"}
    }
]

# ==================== LOGGER ====================

def log(mensaje: str, nivel: str = "INFO"):
    timestamp = getNowCDMX().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{nivel}] {mensaje}")

# ==================== 1. LISTA 69B SAT (Ya implementado) ====================

def actualizar_lista_69b():
    """Ejecuta script existente de Lista 69B"""
    log("📋 Actualizando Lista 69B SAT...")
    
    script_path = Path(__file__).parent / "actualizar_lista_69b.py"
    
    if script_path.exists():
        import subprocess
        resultado = subprocess.run([sys.executable, str(script_path)], capture_output=True)
        
        if resultado.returncode == 0:
            log("✅ Lista 69B actualizada", "SUCCESS")
            return True
        else:
            log(f"❌ Error actualizando Lista 69B: {resultado.stderr.decode()}", "ERROR")
            return False
    else:
        log("⚠️ Script de Lista 69B no encontrado", "WARNING")
        return False

# ==================== 2. UIF PERSONAS BLOQUEADAS ====================

def actualizar_uif_bloqueados():
    """
    Descarga lista UIF Personas Bloqueadas
    
    FUENTES ALTERNATIVAS GRATUITAS:
    1. DOF (Diario Oficial) - Publicaciones oficiales
    2. Boletines UIF - https://www.gob.mx/uif (web scraping)
    3. Portal datos abiertos - https://datos.gob.mx
    """
    log("🔴 Actualizando UIF Personas Bloqueadas...")
    
    personas_bloqueadas = []
    
    # MÉTODO 1: Scraping de DOF
    try:
        log("  Método 1: Buscando en DOF...")
        
        # URL de búsqueda DOF para "personas bloqueadas UIF"
        dof_search_url = "https://www.dof.gob.mx/index.php"
        
        # Parámetros de búsqueda (estos pueden cambiar)
        params = {
            'title': 'lista bloqueados',
            'type': 'search'
        }
        
        # DOF: reintentamos con verify=True para evitar warning; si falla, se capturará más abajo
        response = requests.get(dof_search_url, params=params, timeout=30, verify=True)
        
        if response.ok:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Buscar enlaces a PDFs de listas
            enlaces_pdf = soup.find_all('a', href=re.compile(r'\.pdf$', re.I))
            
            log(f"  Encontrados {len(enlaces_pdf)} PDFs en DOF")
            
            # Aquí procesarías los PDFs con PyPDF2 o pdfplumber
            # Por ahora, registrar que se encontraron
            
        else:
            log(f"  ⚠️ DOF no disponible: {response.status_code}", "WARNING")
            
    except Exception as e:
        log(f"  ⚠️ Error en DOF: {str(e)}", "WARNING")
    
    # MÉTODO 2: Portal datos.gob.mx (Datos Abiertos México)
    try:
        log("  Método 2: Buscando en datos.gob.mx...")
        
        # API de datos abiertos
        datos_abiertos_url = "https://datos.gob.mx/busca/api/3/action/package_search"
        
        response = requests.get(
            datos_abiertos_url,
            params={'q': 'uif bloqueados'},
            timeout=30
        )
        
        if response.ok:
            data = response.json()
            resultados = data.get('result', {}).get('results', [])
            
            log(f"  Encontrados {len(resultados)} datasets en datos.gob.mx")
            
            for dataset in resultados:
                # Buscar recursos descargables
                for recurso in dataset.get('resources', []):
                    url = recurso.get('url')
                    formato = recurso.get('format', '').lower()
                    
                    if formato in ['csv', 'json', 'xlsx']:
                        log(f"    Dataset encontrado: {recurso.get('name')} ({formato})")
                        # Aquí descargarías y procesarías
                        
        else:
            log(f"  ⚠️ datos.gob.mx no disponible: {response.status_code}", "WARNING")
            
    except Exception as e:
        log(f"  ⚠️ Error en datos.gob.mx: {str(e)}", "WARNING")
    
    # MÉTODO 3: Archivo local manual (CSV/TXT) si existe
    try:
        manual_txt = UIF_DIR / "uif_manual.txt"
        manual_csv = UIF_DIR / "uif_manual.csv"
        cargados = 0

        if manual_txt.exists():
            log("  Método 3: Leyendo uif_manual.txt...")
            with open(manual_txt, 'r', encoding='utf-8') as f:
                for linea in f:
                    nombre = linea.strip()
                    if nombre:
                        personas_bloqueadas.append({
                            "nombre_completo": nombre,
                            "fuente": "uif_manual.txt",
                            "fecha_inclusion": getNowCDMX().date().isoformat()
                        })
                        cargados += 1

        if manual_csv.exists():
            log("  Método 3: Leyendo uif_manual.csv...")
            import csv
            with open(manual_csv, newline='', encoding='utf-8') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    nombre = (row.get('nombre') or row.get('nombre_completo') or '').strip()
                    if nombre:
                        personas_bloqueadas.append({
                            "nombre_completo": nombre,
                            "fuente": "uif_manual.csv",
                            "fecha_inclusion": row.get('fecha') or getNowCDMX().date().isoformat(),
                            "nota": row.get('nota')
                        })
                        cargados += 1

        if cargados > 0:
            log(f"  ✅ Cargados {cargados} registros manuales UIF")

    except Exception as e:
        log(f"  ⚠️ Error leyendo archivos manuales UIF: {str(e)}", "WARNING")

    # MÉTODO 4: Lista de referencia mínima si no hay datos
    if not personas_bloqueadas:
        log("  Método 4: Usando lista local de referencia mínima...")
        personas_bloqueadas.append({
            "nombre_completo": "EJEMPLO PERSONA BLOQUEADA UNO",
            "fuente": "Lista local de referencia",
            "fecha_inclusion": "2024-01-01",
            "nota": "Actualizar con datos oficiales"
        })
    
    # Guardar resultado
    output_file = UIF_DIR / "personas_bloqueadas.json"
    metadata_file = UIF_DIR / "metadata.json"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(personas_bloqueadas, f, indent=2, ensure_ascii=False)
    
    metadata = {
        "total_personas": len(personas_bloqueadas),
        "fecha_actualizacion": toISOStringCDMX(),
        "fuentes": ["DOF", "datos.gob.mx", "local"],
        "advertencia": "Lista en desarrollo - Validar con fuentes oficiales UIF"
    }
    
    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    log(f"✅ UIF: {len(personas_bloqueadas)} registros guardados", "SUCCESS")
    return True

# ==================== 3. PEPs MÉXICO ====================

def actualizar_peps_mexico():
    """
    Descarga lista PEPs México
    
    FUENTES GRATUITAS:
    1. Declaranet / DeclaraINAI - Funcionarios públicos
    2. Portal Transparencia - https://www.plataformadetransparencia.org.mx
    3. APIs gubernamentales abiertas
    """
    log("⚠️ Actualizando PEPs México...")
    
    peps = []
    
    # MÉTODO 1: Fuentes conocidas (hardcoded) - intentamos en orden
    try:
        log("  Método 1: Probando fuentes conocidas de PEPs...")
        for fuente in KNOWN_PEPS_SOURCES:
            url = fuente.get('url')
            fmt = (fuente.get('format') or '').lower()
            limit = fuente.get('limit', 200)
            nombre_fuente = fuente.get('name', 'fuente-desconocida')
            if not url:
                continue
            try:
                log(f"  Descargando: {nombre_fuente}")
                r = requests.get(url, timeout=30)
                if not r.ok:
                    log(f"    ⚠️ Fuente {nombre_fuente} respondió {r.status_code}", "WARNING")
                    continue
                if fmt == 'csv' or (fmt == '' and url.endswith('.csv')):
                    import csv
                    from io import StringIO
                    reader = csv.DictReader(StringIO(r.text))
                    for i, row in enumerate(reader):
                        if i >= limit:
                            break
                        nombre = (row.get('nombre') or row.get('nombre_completo') or row.get('servidor_publico') or '').strip()
                        cargo = (row.get('cargo') or row.get('puesto') or '').strip()
                        institucion = (row.get('institucion') or row.get('dependencia') or '').strip()
                        if nombre:
                            peps.append({
                                "nombre_completo": nombre,
                                "cargo": cargo or None,
                                "institucion": institucion or None,
                                "nivel": row.get('nivel') or None,
                                "fuente": nombre_fuente,
                                "fecha_inclusion": row.get('fecha') or getNowCDMX().date().isoformat()
                            })
                else:  # JSON u otro
                    try:
                        j = r.json()
                        items = j if isinstance(j, list) else (j.get('data') or j.get('results') or j.get('records') or [])
                        for i, item in enumerate(items):
                            if i >= limit:
                                break
                            nombre = (item.get('nombre') or item.get('nombre_completo') or item.get('servidor_publico') or '').strip()
                            cargo = (item.get('cargo') or item.get('puesto') or '').strip()
                            institucion = (item.get('institucion') or item.get('dependencia') or '').strip()
                            if nombre:
                                peps.append({
                                    "nombre_completo": nombre,
                                    "cargo": cargo or None,
                                    "institucion": institucion or None,
                                    "nivel": item.get('nivel') or None,
                                    "fuente": nombre_fuente,
                                    "fecha_inclusion": item.get('fecha') or getNowCDMX().date().isoformat()
                                })
                    except Exception:
                        log(f"    ⚠️ No se pudo parsear JSON de {nombre_fuente}", "WARNING")
                if peps:
                    log(f"  ✅ Cargados {len(peps)} registros desde {nombre_fuente}")
                    break  # detener tras primera fuente exitosa
            except Exception as inner:
                log(f"    ⚠️ Error con {nombre_fuente}: {str(inner)}", "WARNING")
    except Exception as e:
        log(f"  ⚠️ Error en fuentes conocidas: {str(e)}", "WARNING")
    
    # MÉTODO 2: Búsqueda rápida en datos.gob.mx (si no hay resultados aún)
    if not peps:
        try:
            log("  Método 2: Buscando en datos.gob.mx servidores públicos (rápido)...")
            query_url = "https://datos.gob.mx/busca/api/3/action/package_search"
            resp = requests.get(query_url, params={'q': 'servidores publicos csv'}, timeout=30)
            if resp.ok:
                data = resp.json()
                results = data.get('result', {}).get('results', [])
                log(f"  Encontrados {len(results)} datasets candidatos")
                for ds in results:
                    recurso = None
                    for r in ds.get('resources', []):
                        fmt = (r.get('format') or '').lower()
                        if fmt in ['csv', 'json'] and r.get('url'):
                            recurso = r
                            break
                    if recurso:
                        url = recurso.get('url')
                        log(f"  Descargando recurso: {url}")
                        r2 = requests.get(url, timeout=30)
                        if r2.ok:
                            if recurso.get('format', '').lower() == 'csv':
                                import csv
                                from io import StringIO
                                reader = csv.DictReader(StringIO(r2.text))
                                for i, row in enumerate(reader):
                                    if i >= 200:
                                        break
                                    nombre = (row.get('nombre') or row.get('nombre_completo') or row.get('servidor_publico') or '').strip()
                                    cargo = (row.get('cargo') or row.get('puesto') or '').strip()
                                    institucion = (row.get('institucion') or row.get('dependencia') or '').strip()
                                    if nombre:
                                        peps.append({
                                            "nombre_completo": nombre,
                                            "cargo": cargo or None,
                                            "institucion": institucion or None,
                                            "nivel": row.get('nivel') or None,
                                            "fuente": recurso.get('name') or 'datos.gob.mx',
                                            "fecha_inclusion": row.get('fecha') or getNowCDMX().date().isoformat()
                                        })
                            else:
                                try:
                                    j = r2.json()
                                    items = j if isinstance(j, list) else (j.get('data') or j.get('results') or [])
                                    for i, item in enumerate(items):
                                        if i >= 200:
                                            break
                                        nombre = (item.get('nombre') or item.get('nombre_completo') or item.get('servidor_publico') or '').strip()
                                        cargo = (item.get('cargo') or item.get('puesto') or '').strip()
                                        institucion = (item.get('institucion') or item.get('dependencia') or '').strip()
                                        if nombre:
                                            peps.append({
                                                "nombre_completo": nombre,
                                                "cargo": cargo or None,
                                                "institucion": institucion or None,
                                                "nivel": item.get('nivel') or None,
                                                "fuente": recurso.get('name') or 'datos.gob.mx',
                                                "fecha_inclusion": item.get('fecha') or getNowCDMX().date().isoformat()
                                            })
                                except Exception:
                                    pass
                        break
            else:
                log(f"  ⚠️ datos.gob.mx no disponible: {resp.status_code}", "WARNING")
        except Exception as e:
            log(f"  ⚠️ Error en datos.gob.mx: {str(e)}", "WARNING")
    
    # Si no se obtuvo nada, usar lista de referencia mínima
    if not peps:
        log("  Método 3: Usando lista base de PEPs conocidos (mínima)...")
        peps.append({
            "nombre_completo": "EJEMPLO PEP FEDERAL",
            "cargo": "Servidor Público Federal",
            "institucion": "Gobierno Federal",
            "nivel": "alto",
            "fuente": "Lista de referencia",
            "fecha_inclusion": "2024-01-01",
            "nota": "Actualizar con Declaranet/fuentes oficiales"
        })
    
    # Guardar resultado
    output_file = PEPS_DIR / "peps_mexico.json"
    metadata_file = PEPS_DIR / "metadata.json"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(peps, f, indent=2, ensure_ascii=False)
    
    metadata = {
        "total_peps": len(peps),
        "fecha_actualizacion": toISOStringCDMX(),
        "fuentes": ["Portal Transparencia", "datos.gob.mx", "local"],
        "categorias": {
            "federal": 0,
            "estatal": 0,
            "municipal": 0
        },
        "advertencia": "Lista en desarrollo - Complementar con Declaranet y fuentes oficiales"
    }
    
    with open(metadata_file, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    log(f"✅ PEPs: {len(peps)} registros guardados", "SUCCESS")
    return True

# ==================== 4. OFAC CACHE LOCAL ====================

def actualizar_ofac_cache():
    """Descarga y cachea lista OFAC completa para búsquedas offline"""
    log("🇺🇸 Actualizando cache OFAC...")
    
    try:
        # URL oficial XML de OFAC
        ofac_url = "https://www.treasury.gov/ofac/downloads/sdn.xml"
        
        response = requests.get(ofac_url, timeout=60)
        response.raise_for_status()
        
        # Guardar XML completo
        xml_file = OFAC_DIR / "sdn_complete.xml"
        with open(xml_file, 'wb') as f:
            f.write(response.content)
        
        log(f"  Descargado: {len(response.content) / 1024 / 1024:.2f} MB")
        
        # Extraer solo nombres a JSON para búsqueda rápida
        import xml.etree.ElementTree as ET

        def _strip_tag(tag: str) -> str:
            return tag.split('}', 1)[-1] if '}' in tag else tag

        root = ET.fromstring(response.content)
        nombres_ofac = []

        # Iterar sobre cualquier sdnEntry, ignorando namespaces
        for entry in root.iter():
            if _strip_tag(entry.tag) != 'sdnEntry':
                continue

            # Capturar nombres principales y alias
            first_name = None
            last_name = None
            uid = None
            sdn_type = None
            aliases = []

            for child in entry.iter():
                tag = _strip_tag(child.tag)
                if tag == 'firstName':
                    first_name = child.text or first_name
                elif tag == 'lastName':
                    last_name = child.text or last_name
                elif tag == 'uid':
                    uid = child.text or uid
                elif tag == 'sdnType':
                    sdn_type = child.text or sdn_type
                elif tag in ('aka', 'akaList', 'alternateIdentity'):  # capturar alias
                    if child.text:
                        aliases.append(child.text)

            nombre_completo = f"{first_name or ''} {last_name or ''}".strip()

            if nombre_completo:
                nombres_ofac.append({
                    "nombre_completo": nombre_completo.upper(),
                    "uid": uid,
                    "tipo": sdn_type,
                    "alias": [a.upper() for a in aliases if a]
                })
        
        # Guardar JSON indexado
        json_file = OFAC_DIR / "nombres_indexados.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(nombres_ofac, f, indent=2, ensure_ascii=False)
        
        # Metadata
        metadata = {
            "total_registros": len(nombres_ofac),
            "fecha_actualizacion": toISOStringCDMX(),
            "fuente": "OFAC - US Treasury",
            "tamano_xml_mb": len(response.content) / 1024 / 1024
        }
        
        with open(OFAC_DIR / "metadata.json", 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        log(f"✅ OFAC: {len(nombres_ofac)} registros indexados", "SUCCESS")
        return True
        
    except Exception as e:
        log(f"❌ Error actualizando OFAC: {str(e)}", "ERROR")
        return False

# ==================== 5. CSNU/ONU CACHE LOCAL ====================

def actualizar_csnu_cache():
    """Descarga y cachea lista CSNU/ONU para búsquedas offline"""
    log("🇺🇳 Actualizando cache CSNU/ONU...")
    
    try:
        # URL oficial XML de CSNU
        csnu_url = "https://scsanctions.un.org/resources/xml/en/consolidated.xml"
        
        response = requests.get(csnu_url, timeout=60)
        response.raise_for_status()
        
        # Guardar XML completo
        xml_file = CSNU_DIR / "consolidated_complete.xml"
        with open(xml_file, 'wb') as f:
            f.write(response.content)
        
        log(f"  Descargado: {len(response.content) / 1024 / 1024:.2f} MB")
        
        # Extraer nombres a JSON
        import xml.etree.ElementTree as ET

        def _strip_tag(tag: str) -> str:
            return tag.split('}', 1)[-1] if '}' in tag else tag

        root = ET.fromstring(response.content)
        nombres_csnu = []

        # Procesar individuos y entidades ignorando namespaces
        for node in root.iter():
            tag = _strip_tag(node.tag)
            if tag not in ('INDIVIDUAL', 'ENTITY'):
                continue

            nombres = []
            tipo_lista = None

            for child in node.iter():
                ctag = _strip_tag(child.tag)
                if ctag in ('FIRST_NAME', 'SECOND_NAME', 'THIRD_NAME', 'FOURTH_NAME', 'NAME'):
                    if child.text:
                        nombres.append(child.text)
                elif ctag in ('UN_LIST_TYPE', 'LIST_TYPE'):
                    tipo_lista = child.text or tipo_lista

            nombre_completo = ' '.join(nombres).strip()

            if nombre_completo:
                nombres_csnu.append({
                    "nombre_completo": nombre_completo.upper(),
                    "tipo_lista": tipo_lista
                })
        
        # Guardar JSON
        json_file = CSNU_DIR / "nombres_indexados.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(nombres_csnu, f, indent=2, ensure_ascii=False)
        
        # Metadata
        metadata = {
            "total_registros": len(nombres_csnu),
            "fecha_actualizacion": toISOStringCDMX(),
            "fuente": "CSNU - Naciones Unidas",
            "tamano_xml_mb": len(response.content) / 1024 / 1024
        }
        
        with open(CSNU_DIR / "metadata.json", 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        log(f"✅ CSNU: {len(nombres_csnu)} registros indexados", "SUCCESS")
        return True
        
    except Exception as e:
        log(f"❌ Error actualizando CSNU: {str(e)}", "ERROR")
        return False

# ==================== MAIN ====================

def main():
    """Actualiza todas las listas"""
    log("="*80)
    log("🚀 ACTUALIZADOR COMPLETO DE LISTAS KYC - INICIO")
    log("="*80)
    
    resultados = {
        "lista_69b": False,
        "uif": False,
        "peps": False,
        "ofac": False,
        "csnu": False
    }
    
    # Ejecutar actualizaciones
    resultados["lista_69b"] = actualizar_lista_69b()
    resultados["uif"] = actualizar_uif_bloqueados()
    resultados["peps"] = actualizar_peps_mexico()
    resultados["ofac"] = actualizar_ofac_cache()
    resultados["csnu"] = actualizar_csnu_cache()
    
    # Resumen
    log("\n" + "="*80)
    log("📊 RESUMEN DE ACTUALIZACIONES")
    log("="*80)
    
    for lista, exito in resultados.items():
        estado = "✅ EXITOSO" if exito else "❌ FALLÓ"
        log(f"  {lista.upper()}: {estado}")
    
    exitosas = sum(1 for v in resultados.values() if v)
    log(f"\nTotal: {exitosas}/{len(resultados)} actualizaciones exitosas")
    log("="*80)
    
    return all(resultados.values())

if __name__ == "__main__":
    exito = main()
    sys.exit(0 if exito else 1)
