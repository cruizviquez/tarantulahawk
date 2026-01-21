#!/usr/bin/env python3
"""Test if auth_supabase imports correctly"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "app" / "backend"))

try:
    from api.auth_supabase import verificar_token_supabase, validar_supabase_jwt
    print("✅ auth_supabase imported successfully!")
    print(f"   - verificar_token_supabase: {verificar_token_supabase.__name__}")
    print(f"   - validar_supabase_jwt: {validar_supabase_jwt.__name__}")
except Exception as e:
    print(f"❌ Failed to import auth_supabase: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Now test enhanced_main_api
try:
    from api import enhanced_main_api
    print("✅ enhanced_main_api imported successfully!")
except Exception as e:
    print(f"❌ Failed to import enhanced_main_api: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n✅ All imports successful!")
