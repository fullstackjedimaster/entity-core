from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request, Depends, HTTPException
from app.controllers.auth import require_jwt
from app.controllers.internal_auth import issue_internal_token
from app.core.model_client import call_model_manage
from app.schemas import CreateEntityBody, RequestEnvelope, EntityResponse

router = APIRouter(
    prefix="/api/crud",
    dependencies=[Depends(require_jwt())]
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_bearer_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Authorization header must be: Bearer <token>",
        )
    return parts[1]


def _unwrap_result(data: Dict[str, Any], error_msg: str):
    if not data.get("ok", False):
        raise HTTPException(status_code=502, detail=data.get("message") or error_msg)
    return data.get("result")





@router.get("/{entity}")
async def list_items(
    entity: str,
    request: Request,
    token_payload: dict = Depends(require_jwt()),
):
    entity_schema = token_payload.get("https://fullstackjedi.dev/entity_schema")

    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="list",
        target=f"{entity_schema}.{entity}",
        id=None,
        args=None,
        meta={"source": "entity-core:/api/entities"},
    )

    data = await call_model_manage(envelope, token=internal_token)
    result = _unwrap_result(data, "entity-server failed list_entities")

    return {
        "items": result or []
    }

@router.get("/{entity}/{id}")
async def get_item(
    request: Request,
    entity: str,
    id: str,
    token_payload: dict = Depends(require_jwt()),
):
    entity_schema = token_payload.get("https://fullstackjedi.dev/entity_schema")

    if not entity_schema:
        raise HTTPException(status_code=400, detail="Missing entity_schema claim")

    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="read",
        target=f"{entity_schema}.{entity}",
        id=id,
        args=None,
        meta={"source": "entity-core:/api/entities/{entity_name}"},
    )

    data = await call_model_manage(envelope, token=internal_token)
    ent = _unwrap_result(data, "entity-server failed get_entity")

    if not ent:
        raise HTTPException(status_code=404, detail="Entity not found")

    return ent
# ---------------------------------------------------------------------------
# Create entity
# ---------------------------------------------------------------------------

@router.post("/{entity}")
async def create_item(
    request: Request,
    entity: str,
    body: CreateEntityBody,
    token_payload: dict = Depends(require_jwt()),
):
    if not body.data:
        raise HTTPException(status_code=400, detail="Missing data")

    entity_schema = token_payload.get("https://fullstackjedi.dev/entity_schema")
    if not entity_schema:
        raise HTTPException(status_code=400, detail="Missing entity_schema claim")

    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="create",
        target=f"{entity_schema}.{entity}",
        id="00000000-0000-0000-0000-000000000000",
        args=body.data,
        meta={"source": "entity-core:/api/entities/{entity_name}:POST"},
    )

    data = await call_model_manage(envelope, token=internal_token)
    result = _unwrap_result(data, "entity-server failed create_entity")

    return  result

@router.post("/{entity}/{id}")
async def update_item(
    request: Request,
    entity: str,
    id:str,
    body: CreateEntityBody,
    token_payload: dict = Depends(require_jwt()),
):
    if not body.data:
        raise HTTPException(status_code=400, detail="Missing data")

    entity_schema = token_payload.get("https://fullstackjedi.dev/entity_schema")
    if not entity_schema:
        raise HTTPException(status_code=400, detail="Missing entity_schema claim")

    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="update",
        target=f"{entity_schema}.{entity}",
        id=id,
        args=body.data,
        meta={"source": "entity-core:/api/entities/{entity_name}:POST"},
    )

    data = await call_model_manage(envelope, token=internal_token)
    result = _unwrap_result(data, "entity-server failed create_entity")

    return  result

# ---------------------------------------------------------------------------
# Form metadata
# ---------------------------------------------------------------------------

@router.get("/{entity}/form_metadata")
async def get_form_metadata(request: Request, entity: str):
    await require_jwt([f"read:{entity}"])(request)
    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.get_form_metadata",
        id=None,
        args={"entity": entity},
        meta={"source": "entity-core:/api/entities/{entity}/form_metadata"},
    )

    data = await call_model_manage(envelope, token= internal_token )
    result = _unwrap_result(data, "entity-server failed form_metadata")

    if isinstance(result, dict) and "rows" in result:
        return result["rows"]

    if isinstance(result, list):
        return result

    raise HTTPException(status_code=500, detail="Unexpected result format")


# ---------------------------------------------------------------------------
# Column options
# ---------------------------------------------------------------------------

@router.get("/options/{entity}/{column}")
async def get_column_options(
    request: Request,
    entity: str,
    column: str,
    filter: Optional[str] = None,
):
    await require_jwt([f"read:{entity}"])(request)
    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation="execute",
        target="ec.get_column_options",
        id=None,
        args={
            "entity": entity,
            "column": column,
            "filter": filter,
        },
        meta={"source": "entity-core:/api/entities/options"},
    )

    data = await call_model_manage(envelope, token= internal_token )
    result = _unwrap_result(data, "entity-server failed column_options")

    values: List[Any] = []

    if isinstance(result, list):
        for item in result:
            values.append(item.get("value") if isinstance(item, dict) else item)
        return values

    if isinstance(result, dict) and "rows" in result:
        for row in result["rows"]:
            if isinstance(row, dict):
                values.append(row.get("value"))
        return values

    raise HTTPException(status_code=500, detail="Unexpected result format")