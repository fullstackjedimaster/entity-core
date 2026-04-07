# ── app/middleware/schema_context.py ──
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware


class SchemaContextMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, default_schema: str = "public"):
        super().__init__(app)
        self.default_schema = default_schema


async def dispatch(self, request: Request, call_next):
    claims = request.scope.get("claims") or {}
    schema = claims.get("https://crud-server.fullstackjedi.dev/schema", self.default_schema)
    request.state.schema = schema
    return await call_next(request)