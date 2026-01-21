#!/usr/bin/env python3
"""
Script para descargar y actualizar automáticamente la Lista 69B del SAT
Autor: TarantulaHawk Team
Fecha: 2026-01-20

Lista 69B: Contribuyentes que no desvirtuaron operaciones con EDOS
Fuente: https://www.sat.gob.mx/consulta/92764/descarga-de-listados-completos

REQUISITOS:
- pip install requests beautifulsoup4 pandas openpyxl tabula-py PyPDF2

EJECUCIÓN:
- Manual: python actualizar_lista_69b.py
- Cron (diario 6am): 0 6 * * * /path/to/python /path/to/actualizar_lista_69b.py
"""

import os
import sys
import json
import requests
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
import pandas as pd

# ==================== CONFIGURACIÓN ====================

# Directorio de datos (crear si no existe)
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data" / "lista_69b"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Archivos de salida
LISTA_JSON = DATA_DIR / "lista_69b.json"
LISTA_TXT = DATA_DIR / "lista_69b_rfcs.txt"
METADATA_JSON = DATA_DIR / "metadata.json"
LOG_FILE = DATA_DIR / "actualizacion.log"

# URLs del SAT (pueden cambiar, verificar periódicamente)
SAT_BASE_URL = "https://www.sat.gob.mx"
SAT_LISTA_URL = "https://www.sat.gob.mx/aplicacion/operacion/31274/consulta-tu-lista-de-proveedores"
SAT_DOWNLOAD_URL = "https://www.sat.gob.mx/consulta/92764/descarga-de-listados-completos"

# ==================== LOGGING ====================

class Logger:
    """Logger simple a archivo y consola"""
    
    @staticmethod
    def log(mensaje: str, nivel: str = "INFO"):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_line = f"[{timestamp}] [{nivel}] {mensaje}"
        
        # Escribir a archivo
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_line + "\n")
        
        # Imprimir a consola
        print(log_line)
    
    @staticmethod
    def info(msg): Logger.log(msg, "INFO")
    
    @staticmethod
    def error(msg): Logger.log(msg, "ERROR")
    
    @staticmethod
    def success(msg): Logger.log(msg, "SUCCESS")
    
    @staticmethod
    def warning(msg): Logger.log(msg, "WARNING")


# ==================== DESCARGADOR ====================

class Lista69BDownloader:
    """Descargador de la Lista 69B del SAT"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.lista_rfcs = []
        self.metadata = {}
    
    def descargar_desde_sat(self) -> bool:
        """
        Descarga la lista directamente del SAT
        
        NOTA: El SAT publica la lista en formato Excel (.xlsx) mensualmente
        URL típica: https://www.sat.gob.mx/consulta/92764/descarga-de-listados-completos
        """
        try:
            Logger.info("🌐 Conectando al SAT para descargar Lista 69B...")
            
            # Paso 1: Obtener página de descarga
            response = self.session.get(SAT_DOWNLOAD_URL, timeout=30)
            response.raise_for_status()
            
            # Paso 2: Parsear HTML para encontrar enlace de descarga Excel
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Buscar enlaces que contengan "definitivos" o "presuntos" y ".xlsx"
            enlaces_excel = []
            for link in soup.find_all('a', href=True):
                href = link['href']
                texto = link.get_text().lower()
                
                if '.xlsx' in href or 'excel' in texto or 'definitivos' in texto or 'presuntos' in texto:
                    # Si es URL relativa, completar
                    if href.startswith('/'):
                        href = SAT_BASE_URL + href
                    elif not href.startswith('http'):
                        continue
                    
                    enlaces_excel.append({
                        'url': href,
                        'texto': link.get_text().strip(),
                        'tipo': 'definitivos' if 'definitivos' in texto else 'presuntos'
                    })
            
            if not enlaces_excel:
                Logger.warning("⚠️ No se encontraron enlaces de descarga directa en el SAT")
                Logger.info("📋 Intentando método alternativo (URLs conocidas)...")
                return self._descargar_metodo_alternativo()
            
            Logger.info(f"✅ Encontrados {len(enlaces_excel)} archivos Excel en el SAT")
            
            # Paso 3: Descargar archivos Excel
            for enlace in enlaces_excel:
                Logger.info(f"📥 Descargando: {enlace['texto']}")
                self._descargar_excel(enlace['url'], enlace['tipo'])
            
            return len(self.lista_rfcs) > 0
            
        except Exception as e:
            Logger.error(f"❌ Error al descargar desde SAT: {str(e)}")
            return False
    
    def _descargar_excel(self, url: str, tipo: str):
        """Descarga y procesa archivo Excel del SAT"""
        try:
            # Descargar archivo
            response = self.session.get(url, timeout=60)
            response.raise_for_status()
            
            # Guardar temporalmente
            temp_file = DATA_DIR / f"temp_{tipo}.xlsx"
            with open(temp_file, 'wb') as f:
                f.write(response.content)
            
            Logger.info(f"✅ Archivo descargado: {temp_file.name} ({len(response.content)} bytes)")
            
            # Leer Excel con pandas
            df = pd.read_excel(temp_file)
            
            Logger.info(f"📊 Excel leído: {len(df)} filas, columnas: {list(df.columns)}")
            
            # Buscar columna de RFC (puede tener diferentes nombres)
            rfc_column = None
            for col in df.columns:
                if 'rfc' in col.lower():
                    rfc_column = col
                    break
            
            if rfc_column is None:
                Logger.error(f"❌ No se encontró columna RFC en el Excel. Columnas: {list(df.columns)}")
                return
            
            # Extraer RFCs
            rfcs_extraidos = 0
            for _, row in df.iterrows():
                rfc = str(row[rfc_column]).strip().upper()
                
                # Validar formato básico RFC
                if self._validar_rfc_formato(rfc):
                    entrada = {
                        'rfc': rfc,
                        'tipo': tipo,
                        'fecha_descarga': datetime.now().isoformat(),
                    }
                    
                    # Agregar campos adicionales si existen
                    for col in df.columns:
                        if col != rfc_column:
                            entrada[col.lower().replace(' ', '_')] = str(row[col])
                    
                    self.lista_rfcs.append(entrada)
                    rfcs_extraidos += 1
            
            Logger.success(f"✅ Extraídos {rfcs_extraidos} RFCs válidos del tipo '{tipo}'")
            
            # Limpiar archivo temporal
            temp_file.unlink()
            
        except Exception as e:
            Logger.error(f"❌ Error al procesar Excel: {str(e)}")
    
    def _validar_rfc_formato(self, rfc: str) -> bool:
        """Valida formato básico de RFC"""
        if not rfc or rfc == 'nan' or len(rfc) < 12:
            return False
        
        # Patrón RFC: 12-13 caracteres alfanuméricos
        patron = r'^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$'
        return bool(re.match(patron, rfc))
    
    def _descargar_metodo_alternativo(self) -> bool:
        """
        Método alternativo usando URLs directas conocidas
        El SAT suele publicar en estas URLs:
        """
        urls_conocidas = [
            # Definitivos (Art. 69-B, cuarto párrafo CFF)
            "https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461173659796&ssbinary=true",
            
            # Presuntos (Art. 69-B, primer párrafo CFF)  
            "https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461173659795&ssbinary=true",
        ]
        
        exito = False
        for i, url in enumerate(urls_conocidas):
            tipo = "definitivos" if i == 0 else "presuntos"
            try:
                Logger.info(f"📥 Intentando descargar desde URL conocida ({tipo})...")
                self._descargar_excel(url, tipo)
                exito = True
            except Exception as e:
                Logger.warning(f"⚠️ Fallo en URL conocida: {str(e)}")
        
        return exito
    
    def guardar_datos(self):
        """Guarda la lista descargada en archivos JSON y TXT"""
        try:
            # Eliminar duplicados por RFC
            rfcs_unicos = {}
            for entrada in self.lista_rfcs:
                rfc = entrada['rfc']
                if rfc not in rfcs_unicos:
                    rfcs_unicos[rfc] = entrada
            
            self.lista_rfcs = list(rfcs_unicos.values())
            
            Logger.info(f"📊 Total de RFCs únicos: {len(self.lista_rfcs)}")
            
            # Guardar JSON completo
            with open(LISTA_JSON, 'w', encoding='utf-8') as f:
                json.dump(self.lista_rfcs, f, indent=2, ensure_ascii=False)
            
            Logger.success(f"✅ Guardado JSON: {LISTA_JSON}")
            
            # Guardar TXT (solo RFCs, para búsqueda rápida)
            with open(LISTA_TXT, 'w', encoding='utf-8') as f:
                for entrada in self.lista_rfcs:
                    f.write(entrada['rfc'] + '\n')
            
            Logger.success(f"✅ Guardado TXT: {LISTA_TXT}")
            
            # Guardar metadata
            self.metadata = {
                'total_rfcs': len(self.lista_rfcs),
                'fecha_actualizacion': datetime.now().isoformat(),
                'fuente': 'SAT México - Lista 69B',
                'version_script': '1.0.0',
                'tipos': {}
            }
            
            # Contar por tipo
            for entrada in self.lista_rfcs:
                tipo = entrada.get('tipo', 'desconocido')
                self.metadata['tipos'][tipo] = self.metadata['tipos'].get(tipo, 0) + 1
            
            with open(METADATA_JSON, 'w', encoding='utf-8') as f:
                json.dump(self.metadata, f, indent=2, ensure_ascii=False)
            
            Logger.success(f"✅ Guardado metadata: {METADATA_JSON}")
            
            # Mostrar resumen
            Logger.info("\n" + "="*60)
            Logger.info("📈 RESUMEN DE ACTUALIZACIÓN")
            Logger.info("="*60)
            Logger.info(f"Total RFCs: {self.metadata['total_rfcs']}")
            Logger.info(f"Fecha: {self.metadata['fecha_actualizacion']}")
            for tipo, cantidad in self.metadata['tipos'].items():
                Logger.info(f"  - {tipo.capitalize()}: {cantidad} RFCs")
            Logger.info("="*60 + "\n")
            
        except Exception as e:
            Logger.error(f"❌ Error al guardar datos: {str(e)}")
            raise


# ==================== HELPER: BÚSQUEDA RÁPIDA ====================

def buscar_rfc_en_lista(rfc: str) -> Optional[Dict]:
    """
    Busca un RFC en la lista local
    Uso: from actualizar_lista_69b import buscar_rfc_en_lista
    """
    rfc = rfc.upper().strip()
    
    if not LISTA_JSON.exists():
        return None
    
    with open(LISTA_JSON, 'r', encoding='utf-8') as f:
        lista = json.load(f)
    
    for entrada in lista:
        if entrada['rfc'] == rfc:
            return entrada
    
    return None


def obtener_metadata() -> Dict:
    """Obtiene metadata de la última actualización"""
    if not METADATA_JSON.exists():
        return {}
    
    with open(METADATA_JSON, 'r', encoding='utf-8') as f:
        return json.load(f)


# ==================== MAIN ====================

def main():
    """Función principal"""
    Logger.info("="*60)
    Logger.info("🚀 ACTUALIZADOR LISTA 69B SAT - INICIO")
    Logger.info("="*60)
    
    try:
        # Crear instancia del descargador
        downloader = Lista69BDownloader()
        
        # Descargar lista
        if not downloader.descargar_desde_sat():
            Logger.error("❌ No se pudo descargar la lista del SAT")
            Logger.warning("💡 Sugerencia: Verificar URLs del SAT o descargar manualmente")
            Logger.warning("💡 URL: https://www.sat.gob.mx/consulta/92764/descarga-de-listados-completos")
            return False
        
        # Guardar datos
        downloader.guardar_datos()
        
        Logger.success("✅ ACTUALIZACIÓN COMPLETADA EXITOSAMENTE")
        return True
        
    except Exception as e:
        Logger.error(f"❌ Error crítico: {str(e)}")
        import traceback
        Logger.error(traceback.format_exc())
        return False
    
    finally:
        Logger.info("="*60)
        Logger.info(f"📁 Archivos generados en: {DATA_DIR}")
        Logger.info(f"📋 Log disponible en: {LOG_FILE}")
        Logger.info("="*60)


if __name__ == "__main__":
    exito = main()
    sys.exit(0 if exito else 1)
