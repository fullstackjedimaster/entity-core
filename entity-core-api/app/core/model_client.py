from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status
from jose import jwt

from app.core.settings import env
from app.schemas import RequestEnvelope

# Base URL for the entity-server service.
# IMPORTANT:
#   Use the site root here, not /manage or /api/manage.
#   Example:
#       https://entity-server.fullstackjedi.dev
EC_MODEL_BASE_URL = env("EC_MODEL_BASE_URL") or "http://localhost:8003"

# Shared secret used for internal entity-core -> entity-server service JWTs.
# Prefer EC_SHARED_JWT_SECRET if present; fall back to EC_SHARED_JWT_SECRET.
EC_SHARED_JWT_SECRET = env("EC_SHARED_JWT_SECRET")

if not EC_SHARED_JWT_SECRET:
    raise RuntimeError(
        "[entity-core] EC_SHARED_JWT_SECRET or EC_SHARED_JWT_SECRET must be set "
        "for internal service JWT generation."
    )


def _build_url(path: str) -> str:
    base = EC_MODEL_BASE_URL.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return base + path


def _mint_internal_token() -> str:
    now = datetime.now(timezone.utc)

    payload = {
        "iss": "entity-core",
        "sub": "entity-core",
        "iat": now,
        "exp": now + timedelta(minutes=5),
        "scope": "internal",
    }

    return jwt.encode(
        payload,
        EC_SHARED_JWT_SECRET,
        algorithm="HS256",
    )

async def _post(
    path: str,
    payload: Dict[str, Any],
    token: Optional[str] = None,
) -> Dict[str, Any]:
    url = _build_url(path)
    headers: Dict[str, str] = {"Content-Type": "application/json"}

    if token:
        headers["Authorization"] = f"Bearer {token}"
    else:
        headers["Authorization"] = f"Bearer {_mint_internal_token()}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to reach entity-server at {url}: {exc}",
            ) from exc

    if resp.status_code >= 400:
        try:
            data = resp.json()
            detail = data.get("detail")
        except Exception:
            detail = resp.text

        raise HTTPException(status_code=resp.status_code, detail=detail)

    return resp.json()


# ---------------------------------------------------------------------------
#  High-level helpers
# ---------------------------------------------------------------------------

async def call_model_manage(
    envelope: RequestEnvelope,
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    POST a RequestEnvelope to entity-server's /api/manage endpoint.
    """
    return await _post("/api/manage", envelope.model_dump(), token)


async def call_model_execute(
    envelope: RequestEnvelope,
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    POST a RequestEnvelope to entity-server's /api/manage endpoint.
    """
    return await _post("/api/action", envelope.model_dump(), token)