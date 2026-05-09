from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request, Depends, HTTPException

from app.controllers.auth import require_jwt
from app.controllers.internal_auth import (
    issue_internal_token,
    get_entity_schema_from_claims,
)
from app.core.model_client import call_model_manage
from app.schemas import CreateEntityBody, RequestEnvelope

router = APIRouter(prefix="/api/entities")


def _unwrap_result(data: Dict[str, Any], error_msg: str):
    if not data.get("ok", False):
        raise HTTPException(
            status_code=502,
            detail=data.get("message") or error_msg,
        )

    return data.get("result")


@router.get("")
async def list_entities(
    request: Request,
    token_payload: dict = Depends(require_jwt()),
):
    entity_schema = get_entity_schema_from_claims(token_payload)
    internal_token = issue_internal_token(request, token_payload)

    envelope = RequestEnvelope(
        operation="execute",
        target="list_entities",
        id=None,
        data={},
        args={"entity_schema": entity_schema},
        meta={"source": "entity-core-api:/api/entities:GET"},
    )

    data = await call_model_manage(envelope, token=internal_token)
    result = _unwrap_result(data, "entity-server failed list_entities")

    return {
        "entities": result or [],
    }


@router.get("/{entity_name}")
async def get_entity(
    request: Request,
    entity_name: str,
    token_payload: dict = Depends(require_jwt()),
):
    entity_schema = get_entity_schema_from_claims(token_payload)
    internal_token = issue_internal_token(request, token_payload)

    envelope = RequestEnvelope(
        operation="execute",
        target="get_entity",
        id=None,
        data={},
        args={
            "entity_schema": entity_schema,
            "entity_name": entity_name,
        },
        meta={"source": "entity-core-api:/api/entities/{entity_name}:GET"},
    )

    data = await call_model_manage(envelope, token=internal_token)
    ent = _unwrap_result(data, "entity-server failed get_entity")

    if not ent:
        raise HTTPException(status_code=404, detail="Entity not found")

    return ent


@router.post("/{entity_name}")
async def create_entity(
    request: Request,
    entity_name: str,
    body: CreateEntityBody,
    token_payload: dict = Depends(require_jwt()),
):
    if not body.entity_json:
        raise HTTPException(status_code=400, detail="Missing entity_json")

    entity_schema = get_entity_schema_from_claims(token_payload)
    internal_token = issue_internal_token(request, token_payload)

    envelope = RequestEnvelope(
        operation="execute",
        target="create_entity",
        id=None,
        data=body.entity_json,
        args={
            "entity_schema": entity_schema,
            "entity_name": entity_name,
            "entity_json": body.entity_json,
        },
        meta={"source": "entity-core-api:/api/entities/{entity_name}:POST"},
    )

    data = await call_model_manage(envelope, token=internal_token)
    _unwrap_result(data, "entity-server failed create_entity")

    return {
        "entity_name": entity_name,
        "entity_json": body.entity_json,
    }


@router.get("/{entity_name}/form_metadata")
async def get_form_metadata(
    request: Request,
    entity_name: str,
    token_payload: dict = Depends(require_jwt()),
):
    entity_schema = get_entity_schema_from_claims(token_payload)
    internal_token = issue_internal_token(request, token_payload)

    envelope = RequestEnvelope(
        operation="execute",
        target="get_form_metadata",
        id=None,
        data={},
        args={
            "entity_schema": entity_schema,
            "entity_name": entity_name,
        },
        meta={
            "source": "entity-core-api:/api/entities/{entity_name}/form_metadata:GET"
        },
    )

    data = await call_model_manage(envelope, token=internal_token)
    result = _unwrap_result(data, "entity-server failed form_metadata")


    if isinstance(result, dict):
        return result

    raise HTTPException(status_code=500, detail="Unexpected result format")


@router.get("/{entity_name}/options/{column}")
async def get_column_options(
    request: Request,
    entity_name: str,
    column: str,
    filter: Optional[str] = None,
    token_payload: dict = Depends(require_jwt()),
):
    entity_schema = get_entity_schema_from_claims(token_payload)
    internal_token = issue_internal_token(request, token_payload)

    envelope = RequestEnvelope(
        operation="execute",
        target="get_column_options",
        id=None,
        data={},
        args={
            "entity_schema": entity_schema,
            "entity_name": entity_name,
            "column": column,
            "filter": filter,
        },
        meta={
            "source": "entity-core-api:/api/entities/{entity_name}/options/{column}:GET",
        },
    )

    data = await call_model_manage(envelope, token=internal_token)
    result = _unwrap_result(data, "entity-server failed get_column_options")

    if not isinstance(result, list):
        raise HTTPException(
            status_code=500,
            detail="Expected get_column_options to return a list",
        )

    return result

@router.get("/{entity_name}/foreign-key-options/{column}")
async def get_foreign_key_options(
    request: Request,
    entity_name: str,
    column: str,
    parentField: Optional[str] = None,
    parentValue: Optional[str] = None,
    token_payload: dict = Depends(require_jwt()),
):
    entity_schema = get_entity_schema_from_claims(token_payload)
    internal_token = issue_internal_token(request, token_payload)

    envelope = RequestEnvelope(
        operation="execute",
        target="get_foreign_key_options",
        id=None,
        data={},
        args={
            "entity_schema": entity_schema,
            "entity_name": entity_name,
            "column_name": column,
            "parent_field": parentField,
            "parent_value": parentValue,
        },
        meta={
            "source": "entity-core-api:/api/entities/{entity_name}/foreign-key-options/{column}:GET",
        },
    )

    data = await call_model_manage(envelope, token=internal_token)
    result = _unwrap_result(data, "entity-server failed get_foreign_key_options")

    if not isinstance(result, dict):
        raise HTTPException(
            status_code=500,
            detail="Expected get_foreign_key_options to return a JSON object",
        )

    return result.get(column, [])