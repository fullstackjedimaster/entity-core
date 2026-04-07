# app/routers/template.py
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.controllers.auth import require_jwt
from app.core.model_client import call_model_manage
from app.schemas import RequestEnvelope

router = APIRouter(
    prefix="/api/template",
    tags=["template"],
)


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


# ---------------------------------------------------------------------------
# Pydantic models (unchanged API shape)
# ---------------------------------------------------------------------------

class TemplateSummary(BaseModel):
    entity_name: str


class TemplateUpsertRequest(BaseModel):
    template: Dict[str, Any]


class TemplateResponse(BaseModel):
    entity_name: str
    template: Dict[str, Any]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=List[TemplateSummary],
)
async def list_templates(
    request: Request,
    user: dict = Depends(require_jwt([])),
) -> List[TemplateSummary]:
    """
    List entity_names that have templates for the caller's tenant/schema.

    Now completely delegated to entity-server via call_model_manage.
    """
    token = _extract_bearer_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.listTemplates",
        id=None,
        args={},  # schema derived by entity-server from JWT
        meta={"source": "entity-core:/api/template"},
    )

    data: Dict[str, Any] = await call_model_manage(envelope, token=token)

    if not data.get("ok", False):
        raise HTTPException(
            status_code=502,
            detail=data.get("message") or "entity-server reported failure for listTemplates",
        )

    result = data.get("result")
    if isinstance(result, dict) and "rows" in result:
        rows = result["rows"]
    else:
        rows = result or []

    summaries: List[TemplateSummary] = []
    for row in rows:
        if isinstance(row, dict) and "entity_name" in row:
            summaries.append(TemplateSummary(entity_name=str(row["entity_name"])))
    return summaries


@router.get(
    "/{entity_name}",
    response_model=TemplateResponse,
)
async def get_template(
    request: Request,
    entity_name: str,
    user: dict = Depends(require_jwt([])),
) -> TemplateResponse:
    """
    Get a template JSON for the given entity_name in the caller's schema.
    """
    token = _extract_bearer_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.getTemplate",
        id=None,
        args={"entity_name": entity_name},
        meta={"source": "entity-core:/api/template/{entity_name}:GET"},
    )

    data: Dict[str, Any] = await call_model_manage(envelope, token=token)

    if not data.get("ok", False):
        raise HTTPException(
            status_code=502,
            detail=data.get("message") or "entity-server reported failure for getTemplate",
        )

    tpl = data.get("result")
    if tpl is None:
        raise HTTPException(status_code=404, detail="Template not found")

    if isinstance(tpl, dict) and "template" in tpl and "entity_name" in tpl:
        return TemplateResponse(entity_name=tpl["entity_name"], template=tpl["template"])

    # Fallback: assume tpl is the raw template dict
    return TemplateResponse(entity_name=entity_name, template=tpl)


@router.post(
    "/{entity_name}",
    response_model=TemplateResponse,
)
async def upsert_template(
    request: Request,
    entity_name: str,
    payload: TemplateUpsertRequest,
    user: dict = Depends(require_jwt([])),
) -> TemplateResponse:
    """
    Upsert a template for the given entity_name in the caller's schema.
    """
    token = _extract_bearer_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.insertTemplate",
        id=None,
        args={
            "entity_name": entity_name,
            "template": payload.template,
        },
        meta={"source": "entity-core:/api/template/{entity_name}:POST"},
    )

    data: Dict[str, Any] = await call_model_manage(envelope, token=token)

    if not data.get("ok", False):
        raise HTTPException(
            status_code=502,
            detail=data.get("message") or "entity-server reported failure for insertTemplate",
        )

    result = data.get("result")

    if isinstance(result, dict) and "entity_name" in result and "template" in result:
        return TemplateResponse(
            entity_name=result["entity_name"],
            template=result["template"],
        )

    # Fallback if server just echoes template
    return TemplateResponse(entity_name=entity_name, template=payload.template)
