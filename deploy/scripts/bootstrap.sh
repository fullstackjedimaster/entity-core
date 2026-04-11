#!/usr/bin/env bash
set -euo pipefail

log() { echo -e "\033[1;32m[init-postgres] $*\033[0m"; }
err() { echo -e "\033[1;31m[init-postgres] $*\033[0m" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"


# -------------------------------------------------------------------
# Bootstrap/admin connection inputs
# -------------------------------------------------------------------
POSTGRES_HOST="${POSTGRES_HOST:-${DATABASE_HOST:-entity-core-postgres}}"
POSTGRES_PORT="${POSTGRES_PORT:-${DATABASE_PORT:-5432}}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"


# Explicit DSNs only. No shared/ambiguous DATABASE_URL.
POSTGRES_DATABASE_URL="${POSTGRES_DATABASE_URL:-}"


log "Using POSTGRES_DATABASE_URL=$POSTGRES_DATABASE_URL"

psql "$POSTGRES_DATABASE_URL" \
  -v app_user="$APP_POSTGRES_USER" \
  -v app_password="$APP_POSTGRES_PASSWORD" \
  -v app_db="$APP_POSTGRES_DB" \
  -f /scripts/bootstrap_admin.sql


log "Done."