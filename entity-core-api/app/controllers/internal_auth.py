# app/controllers/internal_auth.py

from jose import jwt
from app.core.settings import env

EC_SHARED_JWT_SECRET = env("EC_SHARED_JWT_SECRET")

def issue_internal_token(request):
    claims = request.state.claims

    return jwt.encode(
        {
            "iss": "entity-core",
            "sub": "entity-core",
            "schema": request.state.schema,
            "permissions": claims.get("permissions", []),
        },
        EC_SHARED_JWT_SECRET,
        algorithm="HS256",
    )

