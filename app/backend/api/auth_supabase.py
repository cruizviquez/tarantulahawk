"""
Supabase JWT authentication utilities.
Extracted from enhanced_main_api to avoid circular imports.
"""
import os
from typing import Dict

from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
import httpx

load_dotenv()

# Supabase configuration
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

security = HTTPBearer()

# Warn early if config is missing
if not SUPABASE_URL:
    print("⚠️  WARNING: SUPABASE_URL not configured")
if not SUPABASE_JWT_SECRET:
    print("⚠️  WARNING: SUPABASE_JWT_SECRET not configured")
else:
    print(f"✅ Supabase configurado: {SUPABASE_URL[:30]}...")


async def verificar_token_supabase(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict:
    """Validate Supabase JWT locally (with secret) or via Supabase API."""
    try:
        token = credentials.credentials

        # Local verification using JWT secret
        if SUPABASE_JWT_SECRET:
            try:
                payload = jwt.decode(
                    token,
                    SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated",
                    options={"verify_aud": True},
                )

                user_id = payload.get("sub")
                email = payload.get("email")
                role = payload.get("role")

                if not user_id:
                    raise HTTPException(
                        status_code=401, detail="Token inválido: no contiene user_id"
                    )

                print(
                    f"[AUTH] ✅ Usuario autenticado: {email} (ID: {user_id[:8]}..., Role: {role})"
                )

                # ⚠️ NO devolver balance/tier hardcodeados - deben venir de DB
                return {
                    "user_id": user_id,
                    "email": email,
                    "role": role,
                }

            except jwt.ExpiredSignatureError:
                print("[AUTH] ❌ Token expirado")
                raise HTTPException(
                    status_code=401,
                    detail="Token expirado. Por favor inicia sesión nuevamente.",
                )
            except jwt.InvalidAudienceError:
                print("[AUTH] ❌ Audience inválida")
                raise HTTPException(
                    status_code=401, detail="Token inválido: audience no coincide"
                )
            except jwt.JWTError as e:
                print(f"[AUTH] ❌ JWT Error: {e}")
                raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")

        # Remote verification via Supabase API
        print("[AUTH] ⚠️  JWT Secret no configurado, usando API de Supabase")
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise HTTPException(
                status_code=500, detail="Configuración de Supabase incompleta"
            )

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                },
                timeout=5.0,
            )

            if response.status_code == 401:
                print("[AUTH] ❌ Token rechazado por Supabase")
                raise HTTPException(status_code=401, detail="Token inválido o expirado")
            if response.status_code != 200:
                print(f"[AUTH] ❌ Error de Supabase: {response.status_code}")
                raise HTTPException(
                    status_code=500, detail="Error verificando token con Supabase"
                )

            user_data = response.json()
            user_id = user_data.get("id")
            email = user_data.get("email")
            role = user_data.get("role", "authenticated")

            if not user_id:
                raise HTTPException(
                    status_code=401, detail="Respuesta de Supabase inválida"
                )

            print(f"[AUTH] ✅ Usuario verificado vía API: {email} (ID: {user_id[:8]}...)")

            # ⚠️ NO devolver balance/tier hardcodeados - deben venir de DB
            return {
                "user_id": user_id,
                "email": email,
                "role": role,
            }

    except HTTPException:
        raise
    except httpx.TimeoutException:
        print("[AUTH] ❌ Timeout verificando con Supabase")
        raise HTTPException(status_code=504, detail="Timeout verificando autenticación")
    except Exception as e:
        print(f"[AUTH] ❌ Error inesperado: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Error interno de autenticación: {str(e)}"
        )


# Backwards compatibility alias
validar_supabase_jwt = verificar_token_supabase
