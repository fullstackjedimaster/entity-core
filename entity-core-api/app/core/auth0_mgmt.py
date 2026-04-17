# app/core/auth0_mgmt.py

import time
import httpx
from app.core.settings import env

AUTH0_DOMAIN = env("AUTH0_DOMAIN")
AUTH0_M2M_CLIENT_ID = env("AUTH0_M2M_CLIENT_ID")
AUTH0_M2M_CLIENT_SECRET = env("AUTH0_M2M_CLIENT_SECRET")
AUTH0_MANAGEMENT_AUDIENCE = env("AUTH0_MANAGEMENT_AUDIENCE")

_cached_token = None
_cached_expiry = 0  # UNIX timestamp when token expires


async def get_management_token() -> str:
    """
    Returns a valid Auth0 Management API access token.
    Automatically refreshes the token when expired or expiring soon.
    """
    global _cached_token, _cached_expiry

    now = time.time()
    # Return cached token if valid for at least another 60 seconds
    if _cached_token and now < (_cached_expiry - 60):
        # print("[auth0] Using cached management token.")
        return _cached_token

    print(f"[auth0] Requesting new management token from https://{AUTH0_DOMAIN}/oauth/token")

    payload = {
        "grant_type": "client_credentials",
        "client_id": AUTH0_M2M_CLIENT_ID,
        "client_secret": AUTH0_M2M_CLIENT_SECRET,
        "audience": AUTH0_MANAGEMENT_AUDIENCE,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(f"https://{AUTH0_DOMAIN}/oauth/token", json=payload)
        if resp.status_code != 200:
            raise RuntimeError(
                f"Auth0 token request failed: {resp.status_code} {resp.text}"
            )

        data = resp.json()
        _cached_token = data["access_token"]
        _cached_expiry = now + data.get("expires_in", 3600)

        print(f"[auth0] ✅ Management token updated and cached{data}")

        return _cached_token
