# backend/services/kyc_free_apis.py
"""
Servicios KYC usando APIs GRATUITAS públicas
✅ OFAC (gratis, ilimitado)
✅ Lista 69B SAT (scraping ligero)
✅ RFC validación formato (local)
✅ CURP validación formato (local)
"""

import re
import requests
from typing import Dict, List, Optional
from datetime import datetime
import xml.etree.ElementTree as ET

# ==================== 1. VALIDACIÓN RFC (Local - Gratis) ====================

class RFCValidator:
    """Validador de RFC formato México - Sin API externa"""
    
    @staticmethod
    def validar_formato(rfc: str) -> Dict:
        """
        Valida formato de RFC según reglas SAT
        Persona Física: 13 caracteres (4 letras + 6 dígitos + 3 homoclave)
        Persona Moral: 12 caracteres (3 letras + 6 dígitos + 3 homoclave)
        """
        rfc = rfc.upper().strip()
        
        # Validar longitud
        if len(rfc) not in [12, 13]:
            return {
                "valido": False,
                "error": "RFC debe tener 12 o 13 caracteres",
                "tipo_persona": None
            }
        
        # Patrón RFC Persona Física (13 chars)
        patron_fisica = r'^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$'
        # Patrón RFC Persona Moral (12 chars)
        patron_moral = r'^[A-ZÑ&]{3}\d{6}[A-Z0-9]{3}$'
        
        if len(rfc) == 13 and re.match(patron_fisica, rfc):
            return {
                "valido": True,
                "rfc": rfc,
                "tipo_persona": "fisica",
                "formato_correcto": True,
                "nota": "Formato válido - Verificación con SAT recomendada"
            }
        elif len(rfc) == 12 and re.match(patron_moral, rfc):
            return {
                "valido": True,
                "rfc": rfc,
                "tipo_persona": "moral",
                "formato_correcto": True,
                "nota": "Formato válido - Verificación con SAT recomendada"
            }
        else:
            return {
                "valido": False,
                "error": "Formato de RFC inválido",
                "tipo_persona": None
            }
    
    @staticmethod
    def calcular_digito_verificador(rfc_sin_dv: str) -> str:
        """Calcula dígito verificador de RFC (homoclave)"""
        # Implementación simplificada - en producción usar algoritmo completo SAT
        # Ver: https://www.sat.gob.mx/consulta/35799/comprobacion-de-rfc
        return "0"  # Placeholder


# ==================== 2. VALIDACIÓN CURP (Local - Gratis) ====================

class CURPValidator:
    """Validador de CURP formato México - Sin API externa"""
    
    @staticmethod
    def validar_formato(curp: str) -> Dict:
        """
        Valida formato de CURP (18 caracteres)
        Formato: AAAA######HHHHHH##
        Ejemplo: PEGJ850515HDFLRN09
        """
        curp = curp.upper().strip()
        
        if len(curp) != 18:
            return {
                "valido": False,
                "error": "CURP debe tener 18 caracteres",
                "curp": None
            }
        
        # Patrón CURP
        patron = r'^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$'
        
        if not re.match(patron, curp):
            return {
                "valido": False,
                "error": "Formato de CURP inválido",
                "curp": None
            }
        
        # Extraer datos
        sexo = curp[10]  # H o M
        estado = curp[11:13]
        
        return {
            "valido": True,
            "curp": curp,
            "formato_correcto": True,
            "sexo": "Hombre" if sexo == "H" else "Mujer",
            "estado_nacimiento": estado,
            "nota": "Formato válido - Certificación RENAPO recomendada",
            "advertencia": "Esta validación es solo de formato. Para certificación oficial, consultar RENAPO."
        }


# ==================== 3. OFAC - Lista Sanciones (API Pública GRATIS) ====================

class OFACService:
    """
    Búsqueda en lista OFAC (Office of Foreign Assets Control)
    API: https://sanctionssearch.ofac.treas.gov/
    ✅ 100% GRATIS
    ✅ Datos oficiales del Tesoro de EE.UU.
    """
    
    BASE_URL = "https://sanctionssearch.ofac.treas.gov"
    
    @classmethod
    def buscar_nombre(cls, nombre: str, apellido: str = "") -> Dict:
        """
        Busca coincidencias en OFAC por nombre
        
        Returns:
            {
                "encontrado": bool,
                "coincidencias": List[dict],
                "total": int
            }
        """
        try:
            # OFAC tiene web pública pero NO API REST oficial
            # Alternativa: Usar dataset XML público
            
            # URL del dataset XML actualizado diariamente
            xml_url = "https://www.treasury.gov/ofac/downloads/sdn.xml"
            
            response = requests.get(xml_url, timeout=30)
            response.raise_for_status()
            
            # Parsear XML
            root = ET.fromstring(response.content)
            
            # Buscar coincidencias
            coincidencias = []
            nombre_completo = f"{nombre} {apellido}".strip().upper()
            
            for entry in root.findall('.//sdnEntry'):
                firstName = entry.find('.//firstName')
                lastName = entry.find('.//lastName')
                
                if firstName is not None and lastName is not None:
                    nombre_sdn = f"{firstName.text} {lastName.text}".upper()
                    
                    # Fuzzy match simple
                    if nombre in nombre_sdn or nombre_sdn in nombre_completo:
                        coincidencias.append({
                            "nombre": nombre_sdn,
                            "uid": entry.find('.//uid').text if entry.find('.//uid') is not None else None,
                            "tipo": entry.find('.//sdnType').text if entry.find('.//sdnType') is not None else None,
                            "programa": entry.find('.//programList/program').text if entry.find('.//programList/program') is not None else None,
                            "score": 100  # Match exacto
                        })
            
            return {
                "encontrado": len(coincidencias) > 0,
                "coincidencias": coincidencias,
                "total": len(coincidencias),
                "fuente": "OFAC - US Treasury",
                "fecha_consulta": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "encontrado": False,
                "error": str(e),
                "coincidencias": [],
                "total": 0
            }


# ==================== 4. Lista 69B SAT (Base de datos local actualizable) ====================

class Lista69BService:
    """
    Lista 69B del SAT - Empresas fantasma
    Fuente: https://sat.gob.mx/normatividad/52966/conoce-la-lista-completa
    
    IMPORTANTE: Ejecutar scripts/actualizar_lista_69b.py periódicamente
    """
    
    LISTA_PATH = None  # Se inicializa automáticamente
    METADATA_PATH = None
    _cache = None  # Cache en memoria
    _cache_timestamp = None
    
    @classmethod
    def _inicializar_paths(cls):
        """Inicializa rutas de archivos de datos"""
        if cls.LISTA_PATH is None:
            from pathlib import Path
            base_dir = Path(__file__).parent.parent
            data_dir = base_dir / "data" / "lista_69b"
            cls.LISTA_PATH = data_dir / "lista_69b.json"
            cls.METADATA_PATH = data_dir / "metadata.json"
    
    @classmethod
    def _cargar_lista(cls, forzar: bool = False) -> List[Dict]:
        """
        Carga lista desde archivo JSON con cache en memoria
        
        Args:
            forzar: Forzar recarga desde disco ignorando cache
        """
        import json
        from pathlib import Path
        
        cls._inicializar_paths()
        
        # Usar cache si existe y no se fuerza recarga
        if not forzar and cls._cache is not None:
            cache_age = (datetime.now() - cls._cache_timestamp).total_seconds()
            # Cache válido por 1 hora
            if cache_age < 3600:
                return cls._cache
        
        # Cargar desde archivo
        if not cls.LISTA_PATH.exists():
            return []
        
        try:
            with open(cls.LISTA_PATH, 'r', encoding='utf-8') as f:
                cls._cache = json.load(f)
                cls._cache_timestamp = datetime.now()
                return cls._cache
        except Exception as e:
            print(f"Error al cargar Lista 69B: {e}")
            return []
    
    @classmethod
    def obtener_metadata(cls) -> Dict:
        """Obtiene información de la última actualización"""
        import json
        
        cls._inicializar_paths()
        
        if not cls.METADATA_PATH.exists():
            return {
                "total_rfcs": 0,
                "fecha_actualizacion": None,
                "advertencia": "Lista no descargada. Ejecutar: python scripts/actualizar_lista_69b.py"
            }
        
        try:
            with open(cls.METADATA_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {"total_rfcs": 0, "fecha_actualizacion": None}
    
    @classmethod
    def buscar_rfc(cls, rfc: str) -> Dict:
        """
        Busca RFC en lista 69B (empresas fantasma/presuntos)
        
        Args:
            rfc: RFC a buscar (12-13 caracteres)
            
        Returns:
            Diccionario con resultado de búsqueda
        """
        rfc_upper = rfc.upper().strip()
        
        # Cargar lista
        lista = cls._cargar_lista()
        metadata = cls.obtener_metadata()
        
        # Si no hay lista descargada, retornar advertencia
        if not lista:
            return {
                "en_lista": None,  # None = no se pudo verificar
                "rfc": rfc_upper,
                "fuente": "SAT México - Lista 69B",
                "advertencia": "⚠️ Lista no disponible localmente",
                "instruccion": "Ejecutar: python app/backend/scripts/actualizar_lista_69b.py",
                "nota": "La lista debe descargarse periódicamente del SAT"
            }
        
        # Buscar RFC en lista
        for entrada in lista:
            if entrada.get('rfc') == rfc_upper:
                return {
                    "en_lista": True,
                    "rfc": rfc_upper,
                    "tipo_lista": f"69B - {entrada.get('tipo', 'Desconocido').capitalize()}",
                    "fecha_descarga": entrada.get('fecha_descarga'),
                    "fecha_actualizacion_lista": metadata.get('fecha_actualizacion'),
                    "fuente": "SAT México",
                    "advertencia": f"⚠️ Este RFC está en la lista 69B del SAT ({entrada.get('tipo', 'tipo desconocido')})",
                    "detalles": entrada  # Incluir toda la información disponible
                }
        
        # No encontrado
        return {
            "en_lista": False,
            "rfc": rfc_upper,
            "fuente": "SAT México - Lista 69B",
            "fecha_verificacion": datetime.now().isoformat(),
            "fecha_actualizacion_lista": metadata.get('fecha_actualizacion'),
            "total_rfcs_en_lista": metadata.get('total_rfcs', 0),
            "nota": f"RFC no encontrado en lista 69B (última actualización: {metadata.get('fecha_actualizacion', 'desconocida')})"
        }


# ==================== 5. CSNU - ONU Lista Terrorismo (Gratis) ====================

class CSNUService:
    """
    Consejo de Seguridad de Naciones Unidas - Lista de terroristas
    API Pública: https://www.un.org/securitycouncil/
    """
    
    @classmethod
    def buscar_nombre(cls, nombre: str) -> Dict:
        """
        Busca en lista consolidada de sanciones ONU
        """
        try:
            # URL dataset XML ONU
            xml_url = "https://scsanctions.un.org/resources/xml/en/consolidated.xml"
            
            response = requests.get(xml_url, timeout=30)
            response.raise_for_status()
            
            root = ET.fromstring(response.content)
            
            coincidencias = []
            nombre_upper = nombre.upper()
            
            for individual in root.findall('.//INDIVIDUAL'):
                first_name = individual.find('.//FIRST_NAME')
                last_name = individual.find('.//SECOND_NAME')
                
                if first_name is not None and last_name is not None:
                    nombre_completo = f"{first_name.text} {last_name.text}".upper()
                    
                    if nombre_upper in nombre_completo:
                        coincidencias.append({
                            "nombre": nombre_completo,
                            "alias": individual.find('.//FOURTH_NAME').text if individual.find('.//FOURTH_NAME') is not None else None,
                            "nacionalidad": individual.find('.//NATIONALITY').text if individual.find('.//NATIONALITY') is not None else None,
                            "fecha_nacimiento": individual.find('.//INDIVIDUAL_DATE_OF_BIRTH/DATE').text if individual.find('.//INDIVIDUAL_DATE_OF_BIRTH/DATE') is not None else None
                        })
            
            return {
                "encontrado": len(coincidencias) > 0,
                "coincidencias": coincidencias,
                "total": len(coincidencias),
                "fuente": "CSNU - ONU",
                "fecha_consulta": datetime.now().isoformat()
            }
            
        except Exception as e:
            return {
                "encontrado": False,
                "error": str(e),
                "coincidencias": []
            }


# ==================== 6. Servicio Integrado KYC ====================

class KYCService:
    """
    Servicio integrado de validación KYC
    Combina todas las fuentes gratuitas
    """
    
    @classmethod
    async def validar_cliente_completo(
        cls,
        nombre: str,
        apellido_paterno: str,
        apellido_materno: str,
        rfc: str,
        curp: Optional[str] = None
    ) -> Dict:
        """
        Validación completa de cliente usando solo APIs gratuitas
        
        Returns:
            {
                "validaciones": {
                    "rfc": {...},
                    "curp": {...},
                    "listas_negras": {...}
                },
                "score_riesgo": int,  # 0-100
                "aprobado": bool
            }
        """
        
        resultado = {
            "validaciones": {},
            "score_riesgo": 0,
            "aprobado": False,
            "alertas": []
        }
        
        # 1. Validar RFC formato
        rfc_validacion = RFCValidator.validar_formato(rfc)
        resultado["validaciones"]["rfc"] = rfc_validacion
        
        if not rfc_validacion["valido"]:
            resultado["score_riesgo"] += 30
            resultado["alertas"].append("RFC con formato inválido")
        
        # 2. Validar CURP formato (si se proporciona)
        if curp:
            curp_validacion = CURPValidator.validar_formato(curp)
            resultado["validaciones"]["curp"] = curp_validacion
            
            if not curp_validacion["valido"]:
                resultado["score_riesgo"] += 20
                resultado["alertas"].append("CURP con formato inválido")
        
        # 3. Buscar en OFAC
        ofac_result = OFACService.buscar_nombre(nombre, f"{apellido_paterno} {apellido_materno}")
        resultado["validaciones"]["ofac"] = ofac_result
        
        if ofac_result["encontrado"]:
            resultado["score_riesgo"] += 100  # CRÍTICO
            resultado["alertas"].append(f"⛔ ENCONTRADO EN OFAC - {ofac_result['total']} coincidencias")
        
        # 4. Buscar en Lista 69B
        lista69b_result = Lista69BService.buscar_rfc(rfc)
        resultado["validaciones"]["lista_69b"] = lista69b_result
        
        if lista69b_result["en_lista"]:
            resultado["score_riesgo"] += 80  # CRÍTICO
            resultado["alertas"].append("⛔ RFC en Lista 69B del SAT")
        
        # 5. Buscar en CSNU
        csnu_result = CSNUService.buscar_nombre(nombre)
        resultado["validaciones"]["csnu"] = csnu_result
        
        if csnu_result["encontrado"]:
            resultado["score_riesgo"] += 100  # CRÍTICO
            resultado["alertas"].append(f"⛔ ENCONTRADO EN CSNU - {csnu_result['total']} coincidencias")
        
        # Determinar aprobación
        resultado["aprobado"] = resultado["score_riesgo"] < 50
        
        return resultado


# ==================== EJEMPLO DE USO ====================

if __name__ == "__main__":
    import asyncio
    
    # Test
    resultado = asyncio.run(
        KYCService.validar_cliente_completo(
            nombre="Juan",
            apellido_paterno="Pérez",
            apellido_materno="García",
            rfc="RUCF750728UL2",
            curp="RUCF750728HDFZVS08"
        )
    )
    
    print("=== RESULTADO VALIDACIÓN KYC ===")
    print(f"Aprobado: {resultado['aprobado']}")
    print(f"Score Riesgo: {resultado['score_riesgo']}/100")
    print(f"Alertas: {resultado['alertas']}")
    print(f"\nValidaciones:")
    for key, val in resultado['validaciones'].items():
        print(f"  {key}: {val}")