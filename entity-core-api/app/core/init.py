# app/core/init.py
import asyncpg
from fastapi import FastAPI
from app.core.settings import env


# -----------------------------------------------------------------------------
# JWKS preload helper
# -----------------------------------------------------------------------------
import asyncio, httpx
from app.core.settings import env

async def preload_jwks(app):
    """
    Fetch Auth0 JWKS (JSON Web Key Set) and attach to app.state.jwks.
    Retries a few times at startup so we don't fail if network is slow.
    """
    AUTH0_DOMAIN = env("AUTH0_DOMAIN")
    jwks_uri = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
    for attempt in range(5):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(jwks_uri)
                resp.raise_for_status()
                app.state.jwks = resp.json()
                print(f"[crud-server] ✅ JWKS preloaded successfully from {jwks_uri}")
                return
        except Exception as e:
            print(f"[crud-server] ⚠️ JWKS preload attempt {attempt+1}/5 failed: {e}")
            await asyncio.sleep(3)
    print("[crud-server] ❌ JWKS preload failed after 5 attempts.")
