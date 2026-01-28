#!/usr/bin/env python3
"""Test script for operaciones_api endpoint"""

import sys
import json
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "app" / "backend" / "api"))

def test_obtener_config():
    """Test config loading"""
    print("\n=== Testing obtener_config ===")
    try:
        from operaciones_api import obtener_config
        config = obtener_config()
        
        assert "lfpiorpi" in config, "Missing lfpiorpi key"
        assert "umbrales" in config["lfpiorpi"], "Missing umbrales key"
        
        umbrales = config["lfpiorpi"]["umbrales"]
        print(f"✅ Config loaded successfully")
        print(f"   Found {len(umbrales)} umbrales")
        print(f"   Keys: {list(umbrales.keys())[:5]}...")
        return True
    except Exception as e:
        print(f"❌ Error loading config: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_obtener_actividades_dropdown():
    """Test dropdown activities extraction"""
    print("\n=== Testing obtener_actividades_dropdown ===")
    try:
        from operaciones_api import obtener_actividades_dropdown
        opciones = obtener_actividades_dropdown()
        
        assert isinstance(opciones, list), "Expected list"
        assert len(opciones) > 0, "No actividades found"
        
        # Check structure of first item
        if opciones:
            first = opciones[0]
            required_keys = {"id", "nombre", "aviso_uma", "efectivo_max_uma"}
            assert required_keys.issubset(first.keys()), f"Missing keys in first item: {first.keys()}"
        
        print(f"✅ Dropdown loaded successfully")
        print(f"   Found {len(opciones)} vulnerable activities")
        print(f"   First 3: {json.dumps(opciones[:3], indent=2)}")
        return True
    except Exception as e:
        print(f"❌ Error loading dropdown: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_endpoint():
    """Test the FastAPI endpoint directly"""
    print("\n=== Testing FastAPI endpoint ===")
    try:
        from fastapi.testclient import TestClient
        from enhanced_main_api import app
        
        client = TestClient(app)
        response = client.get("/api/operaciones/opciones-actividades")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total" in data, "Missing 'total' in response"
        assert "opciones" in data, "Missing 'opciones' in response"
        
        print(f"✅ Endpoint works correctly")
        print(f"   Status: {response.status_code}")
        print(f"   Total opciones: {data['total']}")
        print(f"   Response keys: {list(data.keys())}")
        print(f"   First opciones: {json.dumps(data['opciones'][:2], indent=2)}")
        return True
    except Exception as e:
        print(f"❌ Error testing endpoint: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("Testing operaciones_api.py")
    print("=" * 50)
    
    results = []
    results.append(("Config Loading", test_obtener_config()))
    results.append(("Dropdown Extract", test_obtener_actividades_dropdown()))
    results.append(("FastAPI Endpoint", test_endpoint()))
    
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
    
    all_passed = all(r[1] for r in results)
    sys.exit(0 if all_passed else 1)
