#!/usr/bin/env python3
"""
Ejemplo completo de uso del sistema Lista 69B SAT
Demuestra el flujo completo desde descarga hasta validación KYC
"""

import asyncio
import sys
from pathlib import Path

# Agregar path del backend
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from services.kyc_free_apis import Lista69BService, KYCService

async def ejemplo_flujo_completo():
    """
    Ejemplo completo de flujo KYC con Lista 69B
    """
    
    print("\n" + "="*70)
    print("📋 EJEMPLO COMPLETO - VALIDACIÓN KYC CON LISTA 69B SAT")
    print("="*70 + "\n")
    
    # ========== PASO 1: Verificar estado de la lista ==========
    print("🔍 PASO 1: Verificar estado de Lista 69B local")
    print("-" * 70)
    
    metadata = Lista69BService.obtener_metadata()
    
    if metadata.get('total_rfcs', 0) > 0:
        print(f"✅ Lista descargada correctamente")
        print(f"   📊 Total RFCs: {metadata['total_rfcs']:,}")
        print(f"   📅 Última actualización: {metadata.get('fecha_actualizacion', 'N/A')}")
        
        if metadata.get('tipos'):
            print(f"   📂 Tipos:")
            for tipo, cantidad in metadata['tipos'].items():
                print(f"      - {tipo.capitalize()}: {cantidad:,} RFCs")
    else:
        print("⚠️  Lista NO descargada aún")
        print("💡 Ejecutar: python actualizar_lista_69b.py")
        print("\nContinuando con ejemplo usando validación de formato...")
    
    # ========== PASO 2: Ejemplo búsqueda RFC individual ==========
    print("\n🔎 PASO 2: Búsqueda de RFC individual en Lista 69B")
    print("-" * 70)
    
    # RFC de ejemplo (probablemente no existe en la lista)
    rfc_prueba = "XAXX010101000"
    
    print(f"Buscando RFC: {rfc_prueba}")
    resultado_69b = Lista69BService.buscar_rfc(rfc_prueba)
    
    if resultado_69b.get('en_lista') is None:
        print(f"⚠️  {resultado_69b.get('advertencia', 'No se pudo verificar')}")
    elif resultado_69b.get('en_lista'):
        print(f"❌ RFC ENCONTRADO EN LISTA 69B")
        print(f"   Tipo: {resultado_69b.get('tipo_lista')}")
        print(f"   ⚠️  {resultado_69b.get('advertencia')}")
    else:
        print(f"✅ RFC NO está en Lista 69B")
        print(f"   {resultado_69b.get('nota')}")
    
    # ========== PASO 3: Validación KYC completa ==========
    print("\n🎯 PASO 3: Validación KYC completa de cliente")
    print("-" * 70)
    
    # Datos de ejemplo
    cliente_ejemplo = {
        "nombre": "Juan",
        "apellido_paterno": "Pérez",
        "apellido_materno": "García",
        "rfc": "PEGJ850515HD7",
        "curp": "PEGJ850515HDFRRS08"
    }
    
    print(f"Cliente: {cliente_ejemplo['nombre']} {cliente_ejemplo['apellido_paterno']} {cliente_ejemplo['apellido_materno']}")
    print(f"RFC: {cliente_ejemplo['rfc']}")
    print(f"CURP: {cliente_ejemplo['curp']}")
    print("\nEjecutando validación completa...")
    
    resultado_kyc = await KYCService.validar_cliente_completo(
        nombre=cliente_ejemplo['nombre'],
        apellido_paterno=cliente_ejemplo['apellido_paterno'],
        apellido_materno=cliente_ejemplo['apellido_materno'],
        rfc=cliente_ejemplo['rfc'],
        curp=cliente_ejemplo['curp']
    )
    
    # Mostrar resultados
    print("\n📊 RESULTADOS DE VALIDACIÓN KYC:")
    print("-" * 70)
    print(f"✓ Aprobado: {'✅ SÍ' if resultado_kyc['aprobado'] else '❌ NO'}")
    print(f"✓ Score de Riesgo: {resultado_kyc['score_riesgo']}/100")
    
    if resultado_kyc['alertas']:
        print(f"\n⚠️  ALERTAS ({len(resultado_kyc['alertas'])}):")
        for i, alerta in enumerate(resultado_kyc['alertas'], 1):
            print(f"   {i}. {alerta}")
    else:
        print("\n✅ Sin alertas - Cliente de bajo riesgo")
    
    # Detalles de validaciones
    print("\n📋 DETALLE DE VALIDACIONES:")
    print("-" * 70)
    
    for nombre_validacion, datos in resultado_kyc['validaciones'].items():
        print(f"\n🔹 {nombre_validacion.upper().replace('_', ' ')}:")
        
        if nombre_validacion == 'rfc':
            if datos.get('valido'):
                print(f"   ✅ Formato válido ({datos.get('tipo_persona', 'N/A')})")
            else:
                print(f"   ❌ {datos.get('error')}")
        
        elif nombre_validacion == 'curp':
            if datos.get('valido'):
                print(f"   ✅ Formato válido")
                print(f"   👤 Sexo: {datos.get('sexo')}")
                print(f"   📍 Estado: {datos.get('estado_nacimiento')}")
            else:
                print(f"   ❌ {datos.get('error')}")
        
        elif nombre_validacion == 'ofac':
            if datos.get('encontrado'):
                print(f"   ❌ ENCONTRADO EN OFAC")
                print(f"   📊 Coincidencias: {datos.get('total', 0)}")
            else:
                print(f"   ✅ No encontrado en OFAC")
        
        elif nombre_validacion == 'csnu':
            if datos.get('encontrado'):
                print(f"   ❌ ENCONTRADO EN CSNU (ONU)")
                print(f"   📊 Coincidencias: {datos.get('total', 0)}")
            else:
                print(f"   ✅ No encontrado en CSNU")
        
        elif nombre_validacion == 'lista_69b':
            if datos.get('en_lista'):
                print(f"   ❌ ENCONTRADO EN LISTA 69B SAT")
                print(f"   ⚠️  {datos.get('advertencia')}")
            elif datos.get('en_lista') is None:
                print(f"   ⚠️  {datos.get('advertencia', 'No se pudo verificar')}")
            else:
                print(f"   ✅ No está en Lista 69B")
    
    # ========== PASO 4: Recomendación final ==========
    print("\n" + "="*70)
    print("🎯 RECOMENDACIÓN FINAL")
    print("="*70)
    
    if resultado_kyc['score_riesgo'] == 0:
        print("✅ CLIENTE DE BAJO RIESGO")
        print("   → Continuar con proceso de alta normal")
        print("   → Documentación estándar requerida")
    elif resultado_kyc['score_riesgo'] < 50:
        print("⚠️  CLIENTE DE RIESGO MEDIO")
        print("   → Requiere verificación adicional")
        print("   → Solicitar documentación complementaria")
    elif resultado_kyc['score_riesgo'] < 80:
        print("🔶 CLIENTE DE RIESGO ALTO")
        print("   → Requiere aprobación de oficial de cumplimiento")
        print("   → Investigación detallada de origen de recursos")
    else:
        print("🛑 CLIENTE DE RIESGO CRÍTICO")
        print("   → NO ACEPTAR")
        print("   → Reportar a UIF si es necesario")
        print("   → Documentar razón de rechazo")
    
    print("\n" + "="*70)
    print("✅ EJEMPLO COMPLETADO")
    print("="*70 + "\n")


async def ejemplo_busquedas_multiples():
    """
    Ejemplo de búsqueda de múltiples RFCs
    """
    
    print("\n" + "="*70)
    print("🔎 BÚSQUEDA MÚLTIPLE DE RFCs EN LISTA 69B")
    print("="*70 + "\n")
    
    # Lista de RFCs de ejemplo
    rfcs_probar = [
        "XAXX010101000",
        "VECJ880326XXX",
        "AAA010101AAA",
        "PEGJ850515HD7",
        "LOOO800425XXX"
    ]
    
    resultados = []
    
    for rfc in rfcs_probar:
        resultado = Lista69BService.buscar_rfc(rfc)
        resultados.append({
            'rfc': rfc,
            'en_lista': resultado.get('en_lista'),
            'tipo': resultado.get('tipo_lista', 'N/A')
        })
    
    # Mostrar tabla de resultados
    print("RFC             | En Lista | Tipo")
    print("-" * 70)
    
    for r in resultados:
        estado = "❌ SÍ" if r['en_lista'] else "✅ NO" if r['en_lista'] is False else "⚠️  N/D"
        print(f"{r['rfc']:15} | {estado:8} | {r['tipo']}")
    
    print("\n")


# ==================== MENÚ PRINCIPAL ====================

def mostrar_menu():
    """Muestra menú de opciones"""
    print("\n" + "="*70)
    print("📋 SISTEMA DE VALIDACIÓN LISTA 69B SAT")
    print("="*70)
    print("\n1. 🎯 Ejemplo completo de validación KYC")
    print("2. 🔎 Búsqueda múltiple de RFCs")
    print("3. 📊 Ver metadata de lista")
    print("4. 🔍 Buscar RFC específico")
    print("5. ❌ Salir")
    print("\n" + "="*70)


async def main():
    """Función principal con menú interactivo"""
    
    while True:
        mostrar_menu()
        opcion = input("\nSeleccione una opción (1-5): ").strip()
        
        if opcion == "1":
            await ejemplo_flujo_completo()
        
        elif opcion == "2":
            await ejemplo_busquedas_multiples()
        
        elif opcion == "3":
            metadata = Lista69BService.obtener_metadata()
            print("\n📊 METADATA DE LISTA 69B:")
            print("-" * 70)
            for key, value in metadata.items():
                print(f"{key}: {value}")
        
        elif opcion == "4":
            rfc = input("\nIngrese RFC a buscar: ").strip().upper()
            resultado = Lista69BService.buscar_rfc(rfc)
            print("\n📋 RESULTADO:")
            print("-" * 70)
            for key, value in resultado.items():
                print(f"{key}: {value}")
        
        elif opcion == "5":
            print("\n👋 ¡Hasta luego!\n")
            break
        
        else:
            print("\n❌ Opción inválida. Intente de nuevo.")
        
        input("\nPresione ENTER para continuar...")


if __name__ == "__main__":
    # Ejecutar menú interactivo
    asyncio.run(main())
