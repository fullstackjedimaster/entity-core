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
from app.schemas import RequestEnvelope, EntityResponse

router = APIRouter(prefix="/api/internal", tags=["internal"])

# This consumes the Authorization header but we only use it on the NO-AUTH endpoint
no_auth = HTTPBearer(auto_error=False)
domain = env("AUTH0_DOMAIN")

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

def _unwrap_result(data: Dict[str, Any], error_msg: str):
    if not data.get("ok", False):
        raise HTTPException(status_code=502, detail=data.get("message") or error_msg)
    return data.get("result")




# -----------------------------


@router.get("/wait_for_metadata", dependencies=[Depends(no_auth)])
async def wait_for_metadata(sub: str = Query(...), org_id: str = Query(...)):
    token = await get_management_token()
    url = f"https://{domain}/api/v2/users/{sub}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        for attempt in range(30):
            resp = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
            )

            if resp.is_success:
                meta = resp.json().get("app_metadata", {})

                print(f"[wait_for_metadata] attempt={attempt} meta={meta}")

                if meta.get("org_id") == org_id:
                    return {"ok": True, "meta": meta}

            await asyncio.sleep(1)  # consistent pacing

    return JSONResponse({"ok": False}, status_code=202)

# ----------------------------------------------------
# /internal/schemas/list — admin-level call via entity-server
# ----------------------------------------------------

