#!/usr/bin/env bash
log() { echo -e "\033[1;32m[bootstrap] $*\033[0m"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

POSTGRES_HOST=entity-core-postgres
POSTGRES_PORT=5432
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_DATABASE_URL:-}"

POSTGRES_DATABASE_URL="${POSTGRES_DATABASE_URL:-}"

if [[ -z "POSTGRES_DATABASE_URL" ]]; then

  POSTGRES_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable"
fi

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


log "Using POSTGRES_DATABASE_URL=$POSTGRES_DATABASE_URL"



psql "$POSTGRES_DATABASE_URL" \
  -v app_user="$APP_POSTGRES_USER" \
  -v app_password="$APP_POSTGRES_PASSWORD" \
  -v app_db="$APP_POSTGRES_DB" \
  -f "$DEPLOY_DIR/scripts/bootstrap_admin.sql"





log "Done."