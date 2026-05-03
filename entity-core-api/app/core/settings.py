import os
from pathlib import Path
from dotenv import load_dotenv

# Optional local-dev fallback only.
# In Docker, variables should already be injected by docker compose.
LOCAL_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
if LOCAL_ENV_PATH.exists():
    load_dotenv(LOCAL_ENV_PATH)


def env(name: str, default: str | None = None, required: bool = False) -> str:
    value = os.getenv(name, default)
    if required and (value is None or value == ""):
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value if value is not None else ""


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


AUTH0_DOMAIN = env("AUTH0_DOMAIN", required=True)
AUTH0_AUDIENCE = env("AUTH0_AUDIENCE", required=True)
AUTH0_ISSUER = env("AUTH0_ISSUER", "")
AUTH0_NAMESPACE = env("AUTH0_NAMESPACE", "https://fullstackjedi.dev")

AUTH0_M2M_CLIENT_ID = env("AUTH0_M2M_CLIENT_ID", "")
AUTH0_M2M_CLIENT_SECRET = env("AUTH0_M2M_CLIENT_SECRET", "")
AUTH0_REDIRECT_SECRET = env("AUTH0_REDIRECT_SECRET", "")

APP_DATABASE_URL = env("APP_DATABASE_URL", required=True)


CORS_ORIGINS = env("CORS_ORIGINS", "")
DISABLE_AUTH = env_bool("DISABLE_AUTH", False)
EC_SHARED_JWT_SECRET = env("EC_SHARED_JWT_SECRET", "")
AUTH0_MANAGEMENT_AUDIENCE= env("https://dev-gttnobig6h3trkvm.us.auth0.com/api/v2/", "")