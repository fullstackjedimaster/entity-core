# app/routers/internal.py
from __future__ import annotations

from typing import Any, Dict, List, Optional

import asyncio
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer

from app.core.settings import env
from app.core.auth0_mgmt import get_management_token
from app.controllers.auth import require_jwt
from app.core.model_client import call_model_manage
from app.schemas import RequestEnvelope

router = APIRouter(prefix="/api/internal", tags=["internal"])

# This consumes the Authorization header but we only use it on the NO-AUTH endpoint
no_auth = HTTPBearer(auto_error=False)


def _extract_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Authorization header must be in the format: Bearer <token>",
        )
    return parts[1]


# ----------------------------------------------------
# /internal/wait_for_metadata — polling with NO AUTH
# ----------------------------------------------------

@router.get("/wait_for_metadata", dependencies=[Depends(no_auth)])
async def wait_for_metadata(
    sub: str = Query(...),
    org_id: str = Query(...),
):
    """
    Poll Auth0 Management API until app_metadata shows the desired org_id/schema.
    This remains an entity-core concern; no DB involved.
    """
    domain = env("AUTH0_DOMAIN")
    token = await get_management_token()
    url = f"https://{domain}/api/v2/users/{sub}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        for attempt in range(24):
            await asyncio.sleep(0.5)
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            if not resp.is_success:
                continue

            meta = resp.json().get("app_metadata", {})
            print(f"[wait_for_metadata] Attempt {attempt}: {meta}")

            if meta.get("org_id") == org_id and meta.get("schema") == org_id:
                print(f"[wait_for_metadata] ✅ Metadata propagated for {sub}")
                return {"ok": True, "meta": meta}

    return JSONResponse({"ok": False, "pending": True}, status_code=202)


# ----------------------------------------------------
# /internal/schemas/list — admin-level call via entity-server
# ----------------------------------------------------

@router.get("/schemas/list")
async def list_schemas(
    request: Request,
    _claims: Dict[str, Any] = Depends(require_jwt(["admin:read"])),
) -> List[str]:
    """
    List non-system schemas for the current Postgres instance.

    Old behavior:
      - Direct SELECT from information_schema.schemata.

    New behavior:
      - entity-core builds a RequestEnvelope and calls entity-server.
      - entity-server is responsible for querying information_schema.
    """
    token = _extract_bearer_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.list_schemas",
        id=None,
        args={},
        meta={"source": "entity-core:/internal/schemas/list"},
    )

    data: Dict[str, Any] = await call_model_manage(envelope, token=token)

    if not data.get("ok", False):
        raise HTTPException(
            status_code=502,
            detail=data.get("message") or "entity-server reported failure for list_schemas",
        )

    result = data.get("result")
    # Accept either {"schemas":[...]} or a raw list
    if isinstance(result, dict) and "schemas" in result:
        return [str(s) for s in result["schemas"]]

    if isinstance(result, list):
        return [str(s) for s in result]

    raise HTTPException(
        status_code=500,
        detail="Unexpected result format from entity-server for list_schemas",
    )
