from typing import Any, Dict

from fastapi import APIRouter, Request, Depends, HTTPException

from app.controllers.auth import require_jwt
from app.controllers.internal_auth import issue_internal_token
from app.core.model_client import call_model_manage
from app.schemas import RequestEnvelope

router = APIRouter(
    prefix="/api/crud",
    dependencies=[Depends(require_jwt())],
)


def _unwrap_result(data: Dict[str, Any], error_msg: str):
    if not data.get("ok", False):
        raise HTTPException(status_code=502, detail=data.get("message") or error_msg)

    return data.get("result")


@router.post("/{entity}")
async def manage_crud_entity(
    entity: str,
    body: RequestEnvelope,
    request: Request,
    token_payload: dict = Depends(require_jwt()),
):
    internal_token = issue_internal_token(request)

    envelope = RequestEnvelope(
        operation=body.operation,
        target=body.target or entity,
        id=body.id,
        data=body.data,
        args=getattr(body, "args", None),
        meta={
            **(body.meta or {}),
            "source": f"entity-core:/api/crud/{entity}:POST",
        },
    )

    data = await call_model_manage(envelope, token=internal_token)
    result = _unwrap_result(data, "entity-server failed manage_crud_entity")

    return {
        "items": result or []
    }