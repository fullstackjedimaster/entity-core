# app/controllers/internal_auth.py

from jose import jwt
from app.core.settings import env
from typing import Optional

EC_SHARED_JWT_SECRET = env("EC_SHARED_JWT_SECRET")

def issue_internal_token(request):

    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "iss": "entity-core",
            "sub": "entity-core",
            "iat": now,
            "exp": now + timedelta(minutes=5),
            "scope": "internal",
        },
        EC_SHARED_JWT_SECRET,
        algorithm="HS256",
    )

from datetime import datetime, timedelta, timezone