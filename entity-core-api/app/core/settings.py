import os
from pathlib import Path
from dotenv import load_dotenv

# -----------------------------------------------------------------------------
# Global .env loader — ensures every import gets the same vars
# -----------------------------------------------------------------------------

# This is the canonical path for both systemd and debug runs
DEFAULT_ENV_PATH = Path("/etc/default/crud-server")

# Fallback to local .env if you’re developing outside the droplet
LOCAL_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"

# Load in strict order: /etc/default first, then .env overrides if present
if DEFAULT_ENV_PATH.exists():
    load_dotenv(DEFAULT_ENV_PATH)
if LOCAL_ENV_PATH.exists() and LOCAL_ENV_PATH != DEFAULT_ENV_PATH:
    load_dotenv(LOCAL_ENV_PATH, override=True)

# Convenience alias
env = os.getenv
