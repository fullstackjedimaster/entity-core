from fastapi import Request, HTTPException
from app.schemas import TenantContext

def get_tenant_context(request: Request) -> TenantContext:
    ctx = getattr(request.state, "ctx", None)
    if not ctx:
        raise HTTPException(500, "Tenant context missing")
    return ctx