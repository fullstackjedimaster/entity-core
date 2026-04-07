# app/core/model_client.py
from __future__ import annotations

from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status

from app.core.settings import env
from app.schemas import RequestEnvelope

# Base URL for the ec-model service, e.g.:
#   http://localhost:8001
#   https://ec-model.fullstackjedi.dev
EC_MODEL_BASE_URL = env("EC_MODEL_BASE_URL") or "http://localhost:8001"


def _build_url(path: str) -> str:
    base = EC_MODEL_BASE_URL.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return base + path


async def _post(
    path: str,
    payload: Dict[str, Any],
    token: Optional[str] = None,
) -> Dict[str, Any]:
    url = _build_url(path)
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
        except httpx.RequestError as exc:
            # Treat connectivity issues as 502 from the perspective of ec-control.
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to reach ec-model at {url}: {exc}",
            ) from exc

    if resp.status_code >= 400:
        # Surface ec-model error body directly when possible.
        detail = None
        try:
            data = resp.json()
            detail = data.get("detail") or data
        except Exception:
            detail = resp.text

        raise HTTPException(
            status_code=resp.status_code,
            detail=detail,
        )

    try:
        return resp.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Invalid JSON response from ec-model at {url}",
        ) from exc


# ---------------------------------------------------------------------------
#  High-level helpers
# ---------------------------------------------------------------------------

async def call_model_manage(
    envelope: RequestEnvelope,
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """
    POST a RequestEnvelope to ec-model's /api/manage endpoint.
    """
    return await _post("/api/manage", envelope.model_dump(), token)
