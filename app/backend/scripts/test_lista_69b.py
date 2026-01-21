#!/usr/bin/env python3
"""
Script de prueba rápida para actualización Lista 69B
Ejecutar: python test_lista_69b.py
"""

import sys
from pathlib import Path

# Agregar path del backend
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from services.kyc_free_apis import Lista69BService

def test_busqueda():
    """Test de búsqueda en Lista 69B"""
    
    print("="*60)
    print("🧪 TEST - LISTA 69B SAT")
    print("="*60)
    
    # Obtener metadata
    metadata = Lista69BService.obtener_metadata()
    print("\n📊 METADATA:")
    print(f"  Total RFCs: {metadata.get('total_rfcs', 0)}")
    print(f"  Última actualización: {metadata.get('fecha_actualizacion', 'N/A')}")
    
    if metadata.get('tipos'):
        print("  Tipos:")
        for tipo, cantidad in metadata['tipos'].items():
            print(f"    - {tipo}: {cantidad}")
    
    # Test de búsqueda
    print("\n🔍 TEST DE BÚSQUEDA:")
    
    # RFC de ejemplo (probablemente no existe)
    test_rfc = "XAXX010101000"
    
    resultado = Lista69BService.buscar_rfc(test_rfc)
    
    print(f"\nRFC buscado: {test_rfc}")
    print(f"En lista: {resultado.get('en_lista')}")
    
    if resultado.get('en_lista') is None:
        print(f"⚠️  {resultado.get('advertencia')}")
        print(f"💡 {resultado.get('instruccion')}")
    elif resultado.get('en_lista'):
        print(f"⚠️  {resultado.get('advertencia')}")
        print(f"Tipo: {resultado.get('tipo_lista')}")
    else:
        print(f"✅ {resultado.get('nota')}")
    
    print("\n" + "="*60)

if __name__ == "__main__":
    test_busqueda()
