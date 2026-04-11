#!/usr/bin/env bash
set -euo pipefail

log() { echo -e "\033[1;32m[bootstrap] $*\033[0m"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

POSTGRES_HOST="${POSTGRES_HOST:-entity-core-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

POSTGRES_DATABASE_URL="${POSTGRES_DATABASE_URL:-}"

if [[ -z "$POSTGRES_DATABASE_URL" ]]; then
  POSTGRES_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable"
fi

log "Using POSTGRES_DATABASE_URL=$POSTGRES_DATABASE_URL"

psql "$POSTGRES_DATABASE_URL" \
  -v app_user="$APP_POSTGRES_USER" \
  -v app_password="$APP_POSTGRES_PASSWORD" \
  -v app_db="$APP_POSTGRES_DB" \
  -f "$DEPLOY_DIR/scripts/bootstrap_admin.sql"

log "Done."