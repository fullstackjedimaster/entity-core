# app/routers/onboarding.py
from __future__ import annotations

from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.settings import env
from app.core.auth0_mgmt import get_management_token
from app.controllers.auth import require_jwt
from app.core.model_client import call_model_manage
from app.schemas import RequestEnvelope

from jose import jwt, JWTError

AUTH0_REDIRECT_SECRET = env("AUTH0_REDIRECT_SECRET", required=True)
router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


def _stripped(v: Optional[str]) -> str:
    return (v or "").strip()



def verify_onboarding_token(request: Request) -> dict:
    token = request.headers.get("X-Onboarding-Token")

    if not token:
        raise HTTPException(status_code=401, detail="Missing onboarding token")

    secret = AUTH0_REDIRECT_SECRET

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
        )
        return payload

    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid onboarding token: {e}")

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


@router.post("/onboarding/provision_tenant")
async def provision_tenant(
    payload: Dict[str, Any],
    request: Request
):
    """
    Provision a new tenant schema/org and seed the requesting user as creator.

    New flow:
      - entity-core builds RequestEnvelope(target='ec.provision_tenant')
      - entity-server calls the ec.provision_tenant(...) DB function
      - entity-core then patches Auth0 app_metadata based on DB result
    """
    # ---- input ----------------------------------------------------------------
    schema = _stripped(payload.get("schema"))
    sub = _stripped(payload.get("sub"))
    email = _stripped(payload.get("email"))
    name = payload.get("name") or None
    picture = payload.get("picture") or None
    given = payload.get("given_name") or None
    family = payload.get("family_name") or None
    locale = payload.get("locale") or "en"

    if not (schema and sub and email):
        raise HTTPException(status_code=400, detail="schema, sub, email are required")

    initial_roles = payload.get("roles") or ["creator"]
    initial_perms = payload.get("permissions") or ["crud:read", "crud:write", "crud:delete"]

    claims = verify_onboarding_token(request)

    # ---- DB call via entity-server --------------------------------------------
    envelope = RequestEnvelope(
        operation="execute",
        target="ec.provision_tenant",
        id=None,
        args={
            "schema": schema,
            "sub": sub,
            "email": email,
            "name": name,
            "picture": picture,
            "given_name": given,
            "family_name": family,
            "locale": locale,
            "roles": initial_roles,
            "permissions": initial_perms,
        },
        meta={"source": "entity-core:/onboarding/provision_tenant"},
    )

    data: Dict[str, Any] = await call_model_manage(envelope)

    if not data.get("ok", False):
        raise HTTPException(
            status_code=502,
            detail=data.get("message") or "entity-server reported failure for provision_tenant",
        )

    db_result = data.get("result")
    if not isinstance(db_result, dict):
        raise HTTPException(
            status_code=500,
            detail="Provision failed: invalid DB response from entity-server",
        )

    # ---- auth0 patch -----------------------------------------------------------
    domain = env("AUTH0_DOMAIN")
    mgmt_token = await get_management_token()

    app_metadata = {
        "schema": schema,
        "org_id": db_result.get("root_org_id") or schema,
        "roles": db_result.get("roles") or [],
        "permissions": db_result.get("permissions") or [],
    }

    patch_url = f"https://{domain}/api/v2/users/{sub}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.patch(
                patch_url,
                headers={
                    "Authorization": f"Bearer {mgmt_token}",
                    "Content-Type": "application/json",
                },
                json={"app_metadata": app_metadata},
            )
            resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Auth0 patch failed: {e}")

    # ---- success ---------------------------------------------------------------
    return {
        "status": "ok",
        "provision": db_result,
        "app_metadata": app_metadata,
        "patched": True,
    }
