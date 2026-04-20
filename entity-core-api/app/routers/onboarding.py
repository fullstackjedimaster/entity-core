# app/routers/onboarding.py
from __future__ import annotations

from typing import Any, Dict, Optional

import httpx
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.settings import env
from app.core.auth0_mgmt import get_management_token
from app.controllers.auth import require_jwt
from app.core.model_client import call_model_manage
from app.schemas import RequestEnvelope

from jose import jwt, JWTError
from app.routers.internal import wait_for_metadata

AUTH0_REDIRECT_SECRET = env("AUTH0_REDIRECT_SECRET", required=True)
domain = env("AUTH0_DOMAIN")
router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])



def verify_onboarding_token(request: Request) -> dict:
    token = request.headers.get("X-Onboarding-Token")

    if not token:
        raise HTTPException(status_code=4011, detail="Missing onboarding token")

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


async def patch_auth0_user(sub: str, app_metadata: dict):
    token = await get_management_token()

    url = f"https://{domain}/api/v2/users```````````````````````````````````````````````````````````````````112 `q21    33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333/{sub}"

    with httpx.Client() as client:
        client.patch(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={"app_metadata": app_metadata},
        )




@router.post("/provision_tenant")
async def provision_tenant(
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

    payload = verify_onboarding_token(request)

    body = await request.json()
    schema = body["schema"]

    sub = payload.get("sub")
    email = payload.get("email")
    name = payload.get("name") or None
    picture = payload.get("picture") or None
    given = payload.get("given_name") or None
    family = payload.get("family_name") or None
    locale = payload.get("locale") or "en"

    if not (schema):
        raise HTTPException(status_code=400, detail="schema required")

    if not (sub):
        raise HTTPException(status_code=400, detail=" sub required")


    if not (email):
        raise HTTPException(status_code=400, detail="email  required")

    memberships = payload.get("memberships")

    roles = payload.get("roles") or ["creator"]

    if not memberships:
        memberships = [
            {
                "org_key": schema,
                "roles": roles
            }
        ]
    perms = payload.get("permissions") or ["crud:read", "crud:write", "crud:delete"]



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
            "roles":roles,
            "permissions": perms,
        },
        meta={"source": "entity-core:/onboarding/provision_tenant"},
    )

    data: Dict[str, Any] = await call_model_manage(envelope)

    if not data.get("ok", False):
        raise HTTPException(
            status_code=502,
            detail=data.get("message") or "entity-server reported failure for provision_tenant",
        )

    result = data.get("result")
    if not isinstance(result, dict):
        raise HTTPException(
            status_code=500,
            detail="Provision failed: invalid DB response from entity-server",
        )

    app_metadata = result

    # ✅ async persistence
    await patch_auth0_user(sub, app_metadata)

    return {
        "app_metadata": app_metadata
    }

