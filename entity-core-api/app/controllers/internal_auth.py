# app/controllers/internal_auth.py

from jose import jwt
from app.core.settings import env

EC_SHARED_JWT_SECRET = env("EC_SHARED_JWT_SECRET")
print(claims.get("schema"))
def issue_internal_token(request):
    claims = request.state.claims
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "iss": "entity-core",
            "sub": "entity-core",
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "scope": "internal",
            "schema": claims.get("schema"),
            "permissions": claims.get("permissions", []),
        },
        EC_SHARED_JWT_SECRET,
        algorithm="HS256",
    )

from datetime import datetime, timedelta, timezone