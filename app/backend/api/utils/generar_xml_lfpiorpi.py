#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
XML Generator - Two-Stage LFPIORPI Compliant
Stage 1: Generate incomplete XML with cliente_id
Stage 2: User completes sensitive data (RFC, nombre, CURP)
"""

import pandas as pd
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
import json


def generar_xml_incompleto(df: pd.DataFrame, 
                           rfc_emisor: str = "XAXX010101000",
                           razon_social: str = "Entidad Ejemplo S.A. de C.V.",
                           out_dir: str = "app/backend/outputs/xml") -> Path:
    """
    STAGE 1: Generate incomplete XML (only cliente_id)
    
    Official LFPIORPI XML format for UIF/SAT
    Status: PENDING_COMPLETION - requires user to add sensitive data
    
    Args:
        df: DataFrame with preocupante transactions
        rfc_emisor: RFC of reporting entity
        razon_social: Company name
        out_dir: Output directory
    
    Returns:
        Path to generated XML
    """
    
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    
    print(f"\n{'='*70}")
    print("📄 GENERANDO XML - STAGE 1 (INCOMPLETO)")
    print(f"{'='*70}")
    print(f"Transacciones a reportar: {len(df)}")
    print(f"Emisor: {razon_social}")
    print(f"RFC: {rfc_emisor}\n")
    
    # Root element (LFPIORPI format)
    root = ET.Element("Archivo")
    root.set("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
    root.set("xmlns", "http://www.uif.shcp.gob.mx/recepcion/pld")
    
    # Report metadata
    informe = ET.SubElement(root, "Informe")
    
    # Reporting month
    mes_reportado = ET.SubElement(informe, "MesReportado")
    mes_reportado.text = datetime.now().strftime("%Y-%m")
    
    # Obligated entity (who reports)
    sujeto_obligado = ET.SubElement(informe, "SujetoObligado")
    
    rfc_elem = ET.SubElement(sujeto_obligado, "RFC")
    rfc_elem.text = rfc_emisor
    
    razon_elem = ET.SubElement(sujeto_obligado, "RazonSocial")
    razon_elem.text = razon_social
    
    # Notices section
    avisos = ET.SubElement(informe, "Avisos")
    
    for idx, row in df.iterrows():
        # Individual notice
        aviso = ET.SubElement(avisos, "Aviso")
        
        # Reference number (internal)
        referencia = ET.SubElement(aviso, "ReferenciaAviso")
        referencia.text = f"AVS-{datetime.now().strftime('%Y%m%d')}-{idx+1:05d}"
        
        # Priority (always high for preocupante)
        prioridad = ET.SubElement(aviso, "Prioridad")
        prioridad.text = "Alta"
        
        # Transaction data
        operacion = ET.SubElement(aviso, "Operacion")
        
        fecha_op = ET.SubElement(operacion, "Fecha")
        fecha_op.text = str(row.get("fecha", ""))[:10]  # YYYY-MM-DD
        
        monto_op = ET.SubElement(operacion, "Monto")
        monto_op.text = f"{row.get('monto', 0):.2f}"
        
        moneda = ET.SubElement(operacion, "Moneda")
        moneda.text = "MXN"
        
        tipo_op = ET.SubElement(operacion, "TipoOperacion")
        tipo_op.text = str(row.get("tipo_operacion", ""))
        
        sector = ET.SubElement(operacion, "SectorActividad")
        sector.text = str(row.get("sector_actividad", ""))
        
        frecuencia = ET.SubElement(operacion, "FrecuenciaMensual")
        frecuencia.text = str(row.get("frecuencia_mensual", 1))
        
        # ===================================================================
        # CLIENTE DATA - INCOMPLETE (STAGE 1)
        # ===================================================================
        cliente = ET.SubElement(aviso, "Cliente")
        
        # Internal ID (non-sensitive)
        id_interno = ET.SubElement(cliente, "IDInterno")
        id_interno.text = str(row.get("cliente_id", ""))
        
        # PENDING COMPLETION - User must fill these
        cliente_pendiente = ET.SubElement(cliente, "DatosPendientes")
        cliente_pendiente.set("status", "PENDING_COMPLETION")
        
        # Placeholder fields (empty - to be filled)
        rfc_cliente = ET.SubElement(cliente_pendiente, "RFC")
        rfc_cliente.text = ""
        rfc_cliente.set("required", "true")
        
        nombre = ET.SubElement(cliente_pendiente, "Nombre")
        nombre.text = ""
        nombre.set("required", "true")
        
        apellido_paterno = ET.SubElement(cliente_pendiente, "ApellidoPaterno")
        apellido_paterno.text = ""
        apellido_paterno.set("required", "false")
        
        apellido_materno = ET.SubElement(cliente_pendiente, "ApellidoMaterno")
        apellido_materno.text = ""
        apellido_materno.set("required", "false")
        
        curp = ET.SubElement(cliente_pendiente, "CURP")
        curp.text = ""
        curp.set("required", "true")
        
        # Address (optional in Stage 1)
        domicilio = ET.SubElement(cliente_pendiente, "Domicilio")
        
        calle = ET.SubElement(domicilio, "Calle")
        calle.text = ""
        
        numero = ET.SubElement(domicilio, "Numero")
        numero.text = ""
        
        colonia = ET.SubElement(domicilio, "Colonia")
        colonia.text = ""
        
        cp = ET.SubElement(domicilio, "CodigoPostal")
        cp.text = ""
        
        municipio = ET.SubElement(domicilio, "Municipio")
        municipio.text = ""
        
        estado = ET.SubElement(domicilio, "Estado")
        estado.text = ""
    
    # Generate filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre_archivo = f"aviso_LFPIORPI_INCOMPLETO_{timestamp}.xml"
    ruta_salida = Path(out_dir) / nombre_archivo
    
    # Save with pretty formatting
    tree = ET.ElementTree(root)
    ET.indent(tree, space="  ")
    tree.write(ruta_salida, encoding="utf-8", xml_declaration=True)
    
    print(f"{'='*70}")
    print(f"✅ XML GENERADO (INCOMPLETO)")
    print(f"{'='*70}")
    print(f"Archivo: {ruta_salida}")
    print(f"Avisos: {len(df)}")
    print(f"Status: PENDING_COMPLETION")
    print(f"\n⚠️  SIGUIENTE PASO:")
    print(f"   1. Abrir XML en dashboard")
    print(f"   2. Completar datos de clientes (RFC, nombre, CURP)")
    print(f"   3. Validar y generar XML final para SAT")
    print(f"{'='*70}\n")
    
    # Generate completion guide
    generar_guia_completado(df, out_dir, timestamp)
    
    return ruta_salida


def generar_guia_completado(df: pd.DataFrame, out_dir: str, timestamp: str):
    """
    Generate JSON guide for user to complete XML
    Maps cliente_id to required fields
    """
    
    clientes_unicos = df["cliente_id"].unique()
    
    guia = {
        "timestamp": timestamp,
        "total_clientes": len(clientes_unicos),
        "instrucciones": "Complete los siguientes datos para cada cliente_id",
        "clientes": []
    }
    
    for cliente_id in sorted(clientes_unicos):
        transacciones_cliente = df[df["cliente_id"] == cliente_id]
        
        guia["clientes"].append({
            "cliente_id": int(cliente_id),
            "num_transacciones": len(transacciones_cliente),
            "monto_total": float(transacciones_cliente["monto"].sum()),
            "datos_requeridos": {
                "RFC": "",
                "Nombre": "",
                "ApellidoPaterno": "",
                "ApellidoMaterno": "",
                "CURP": "",
                "Domicilio": {
                    "Calle": "",
                    "Numero": "",
                    "Colonia": "",
                    "CodigoPostal": "",
                    "Municipio": "",
                    "Estado": ""
                }
            }
        })
    
    # Save guide
    guia_path = Path(out_dir) / f"guia_completado_{timestamp}.json"
    with open(guia_path, "w", encoding="utf-8") as f:
        json.dump(guia, f, indent=4, ensure_ascii=False)
    
    print(f"📋 Guía de completado: {guia_path}")
    print(f"   Clientes únicos a completar: {len(clientes_unicos)}\n")


def validar_xml_completo(xml_path: str) -> dict:
    """
    STAGE 2: Validate that XML has all required fields completed
    
    Returns:
        Dictionary with validation results
    """
    
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    resultados = {
        "valido": True,
        "errores": [],
        "advertencias": [],
        "avisos_totales": 0,
        "avisos_completos": 0,
        "avisos_pendientes": 0
    }
    
    avisos = root.findall(".//{http://www.uif.shcp.gob.mx/recepcion/pld}Aviso")
    resultados["avisos_totales"] = len(avisos)
    
    for idx, aviso in enumerate(avisos, 1):
        pendientes = aviso.find(".//{http://www.uif.shcp.gob.mx/recepcion/pld}DatosPendientes")
        
        if pendientes is not None:
            status = pendientes.get("status")
            if status == "PENDING_COMPLETION":
                resultados["avisos_pendientes"] += 1
                resultados["errores"].append(f"Aviso {idx}: Datos de cliente incompletos")
        else:
            resultados["avisos_completos"] += 1
    
    if resultados["avisos_pendientes"] > 0:
        resultados["valido"] = False
    
    return resultados


# ===================================================================
# MAIN EXECUTION
# ===================================================================

def procesar_transacciones_preocupantes(archivo_csv: str, 
                                       rfc_emisor: str = None,
                                       razon_social: str = None):
    """
    Main function: Generate XML for reportable transactions
    
    Args:
        archivo_csv: Path to enriched CSV with predictions
        rfc_emisor: RFC of reporting entity (optional)
        razon_social: Company name (optional)
    """
    
    print(f"\n{'='*70}")
    print("🚀 GENERADOR DE XML LFPIORPI")
    print(f"{'='*70}")
    print(f"Archivo: {archivo_csv}\n")
    
    # Load data
    df = pd.read_csv(archivo_csv)
    
    # Filter only "preocupante" transactions
    df_preocupante = df[df["clasificacion_lfpiorpi"] == "preocupante"].copy()
    
    print(f"📊 Transacciones analizadas: {len(df):,}")
    print(f"⚠️  Transacciones PREOCUPANTES: {len(df_preocupante):,}")
    print(f"✅ Transacciones normales: {len(df) - len(df_preocupante):,}\n")
    
    if len(df_preocupante) == 0:
        print("✅ No hay transacciones que reportar a UIF/SAT")
        print("   Todas las transacciones están dentro de parámetros normales\n")
        return None
    
    # Ask for entity data if not provided
    if rfc_emisor is None:
        rfc_emisor = input("RFC del emisor (Enter para default): ").strip() or "XAXX010101000"
    
    if razon_social is None:
        razon_social = input("Razón social (Enter para default): ").strip() or "Entidad Ejemplo S.A. de C.V."
    
    # Generate incomplete XML
    xml_path = generar_xml_incompleto(df_preocupante, rfc_emisor, razon_social)
    
    return xml_path


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("\n❌ ERROR: Falta argumento")
        print("Uso: python generar_xml_lfpiorpi.py <archivo_enriquecido.csv>")
        print("\nEjemplo:")
        print("  python generar_xml_lfpiorpi.py backend/datasets/dataset_pld_lfpiorpi_1k_enriquecido.csv\n")
        sys.exit(1)
    
    archivo = sys.argv[1]
    
    if not Path(archivo).exists():
        print(f"\n❌ ERROR: Archivo no encontrado: {archivo}\n")
        sys.exit(1)
    
    # Process
    xml_path = procesar_transacciones_preocupantes(archivo)
    
    if xml_path:
        print(f"{'='*70}")
        print("✅ PROCESO COMPLETADO")
        print(f"{'='*70}")
        print(f"XML incompleto generado: {xml_path}")
        print(f"Complete los datos de clientes antes de enviar a SAT\n")