#!/usr/bin/env bash
set -euo pipefail

log() { echo -e "\033[1;32m[init-postgres] $*\033[0m"; }
err() { echo -e "\033[1;31m[init-postgres] $*\033[0m" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Prefer deploy/scripts/ec.sql, but also allow deploy/ec.sql for flexibility.
SQL_FILE="${SQL_FILE:-}"
if [[ -z "${SQL_FILE}" ]]; then
  if [[ -f "$DEPLOY_DIR/scripts/ec.sql" ]]; then
    SQL_FILE="$DEPLOY_DIR/scripts/ec.sql"
  elif [[ -f "$DEPLOY_DIR/ec.sql" ]]; then
    SQL_FILE="$DEPLOY_DIR/ec.sql"
  else
    err "Could not find ec.sql. Expected one of:
  - $DEPLOY_DIR/scripts/ec.sql
  - $DEPLOY_DIR/ec.sql
You can also set SQL_FILE explicitly."
  fi
fi

# -------------------------------------------------------------------
# Bootstrap/admin connection inputs
# -------------------------------------------------------------------
POSTGRES_HOST=localhost
POSTGRES_PORT="${POSTGRES_PORT:-${DATABASE_PORT:-5432}}"


# -------------------------------------------------------------------
# App connection inputs
# -------------------------------------------------------------------
APP_POSTGRES_DB="${APP_POSTGRES_DB:-ec}"
APP_POSTGRES_USER="${APP_POSTGRES_USER:-ec}"
APP_POSTGRES_PASSWORD="${APP_POSTGRES_PASSWORD:-}"

APP_DATABASE_URL="${APP_DATABASE_URL:-}"

if [[ -z "$APP_DATABASE_URL" ]]; then
  : "${POSTGRES_HOST:?POSTGRES_HOST is required}"
  : "${POSTGRES_PORT:?POSTGRES_PORT is required}"
  : "${APP_POSTGRES_DB:?APP_POSTGRES_DB is required}"
  : "${APP_POSTGRES_USER:?APP_POSTGRES_USER is required}"
  : "${APP_POSTGRES_PASSWORD:?APP_POSTGRES_PASSWORD is required}"

  APP_DATABASE_URL="postgresql://${APP_POSTGRES_USER}:${APP_POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${APP_POSTGRES_DB}?sslmode=disable"
fi



log "Using APP_DATABASE_URL=$APP_DATABASE_URL"
log "Using SQL_FILE=$SQL_FILE"




psql "$APP_DATABASE_URL" -f /scripts/ec.sql


log "Done."