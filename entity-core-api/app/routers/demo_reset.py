# app/routers/demo_reset.py
from __future__ import annotations

import hmac
from typing import Any

from fastapi import APIRouter, Header, HTTPException, status

from app.core.auth0_mgmt import delete_auth0_user
from app.core.model_client import call_model_manage
from app.core.settings import env
from app.schemas import RequestEnvelope

router = APIRouter(prefix="/api/internal/demo", tags=["internal-demo"])

DEMO_RESET_SECRET = env("DEMO_RESET_SECRET", required=True)


def require_demo_reset_secret(
    x_demo_reset_secret: str | None = Header(default=None),
) -> None:
    """
    Protect the destructive reset endpoint with a server-to-server secret.

    This endpoint must be called by the portfolio server, never directly from
    browser JavaScript. Keeping the secret server-side prevents visitors from
    resetting the demo at arbitrary times.
    """
    supplied = x_demo_reset_secret or ""

    if not hmac.compare_digest(supplied, DEMO_RESET_SECRET):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found",
        )


@router.post("/reset")
async def reset_entity_core_demo(
    x_demo_reset_secret: str | None = Header(default=None),
) -> dict[str, Any]:
    require_demo_reset_secret(x_demo_reset_secret)

    # The database function drops every provisioned tenant schema, removes the
    # matching global ec.tenant/ec.entity rows, and returns the Auth0 subjects
    # that belonged to those demo tenants.
    envelope = RequestEnvelope(
        operation="execute",
        target="reset_demo",
        id=None,
        data={},
        args={},
        meta={"reason": "portfolio-toggle-demo"},
    )

    data = await call_model_manage(envelope)

    if not data.get("ok", False):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=data.get("message") or "Entity Server failed to reset demo data",
        )

    result = data.get("result")

    if not isinstance(result, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Entity Server returned an invalid reset result",
        )

    raw_users = result.get("auth0_users", [])
    auth0_users = [str(value) for value in raw_users if value]

    deleted_users: list[str] = []
    user_delete_errors: list[dict[str, str]] = []

    # The database wipe is intentionally authoritative. Auth0 deletion follows
    # immediately afterward and is best-effort because Management API
    # propagation and user lifecycle timing can occasionally lag.
    for sub in auth0_users:
        try:
            await delete_auth0_user(sub)
            deleted_users.append(sub)
        except Exception as exc:
            user_delete_errors.append(
                {
                    "sub": sub,
                    "error": str(exc),
                }
            )

    return {
        "ok": len(user_delete_errors) == 0,
        "database": {
            "schemas_dropped": result.get("schemas_dropped", []),
            "tenant_count": result.get("tenant_count", 0),
        },
        "auth0": {
            "requested": auth0_users,
            "deleted": deleted_users,
            "errors": user_delete_errors,
        },
    }
