from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request, Depends, HTTPException
from app.controllers.auth import require_jwt
from app.controllers.internal_auth import issue_internal_token
from app.core.model_client import call_model_manage
from app.schemas import CreateEntityBody, RequestEnvelope, EntityResponse

router = APIRouter(
    prefix="/api/entities",
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


# ---------------------------------------------------------------------------
# List entities
# ---------------------------------------------------------------------------

@router.get("")
async def list_entities(request: Request):
    internal_token = issue_internal_token(request)


    envelope = RequestEnvelope(
        operation="execute",
        target="ec.list_entities",
        id=None,
        args=None,
        meta={"source": "entity-core:/api/entities"},
    )

    data = await call_model_manage(envelope, token=internal_token)
    result = _unwrap_result(data, "entity-server failed listing entities")

    rows = result.get("rows", [])

    return {
        "entities": [
            r["entity"]
            for r in rows
            if isinstance(r, dict) and "entity" in r
        ]
    }


# ---------------------------------------------------------------------------
# Get entity template
# ---------------------------------------------------------------------------

@router.get("/{entity}", response_model=EntityResponse)
async def get_entity(request: Request, schema:str, entity: str):
    internal_token = issue_internal_token(request)
    envelope = RequestEnvelope(
        operation="execute",
        target="ec.get_entity",
        id=None,
        args={"schema":schema,
            "entity": entity},
        meta={"source": "entity-core:/api/entities/{entity}"},
    )

    data = await call_model_manage(envelope, token=internal_token )
    ent = _unwrap_result(data, "entity-server failed get_entity")

    if ent is None:
        raise HTTPException(status_code=404, detail="Template not found")

    if isinstance(ent, dict) and "entity" in ent:
        return EntityResponse(
            entity=ent["entity"]
        )

    return EntityResponse(entity=entity)


# ---------------------------------------------------------------------------
# Create entity
# ---------------------------------------------------------------------------

@router.post("/{entity}")
async def create_entity(request: Request,  body: CreateEntityBody):

    if not body.entity_json:
        raise HTTPException(status_code=400, detail="Missing entity_json")
    # 👇 ADD DEBUG HERE (right after validation, before DB work)
    print("ENTITY_JSON TYPE:", type(body.entity_json))
    print("ENTITY_JSON VALUE:", body.entity_json)
    internal_token = issue_internal_token(request)
    envelope = RequestEnvelope(
        operation="execute",
        target="ec.create_entity",
        id=None,
        args={
            "schema": body.schema,
            "entity": body.entity,
            "entity_json": body.entity_json,
        },
        meta={"source": "entity-core:/api/entities/{entity}:POST"},
    )

    data = await call_model_manage(envelope, token=  internal_token)
    _unwrap_result(data, "entity-server failed create_entity")

    return {"status": "ok"}


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