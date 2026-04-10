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
POSTGRES_HOST="${POSTGRES_HOST:-${DATABASE_HOST:-postgres}}"
POSTGRES_PORT="${POSTGRES_PORT:-${DATABASE_PORT:-5432}}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

# -------------------------------------------------------------------
# App connection inputs
# -------------------------------------------------------------------
APP_POSTGRES_DB="${APP_POSTGRES_DB:-ec}"
APP_POSTGRES_USER="${APP_POSTGRES_USER:-ec}"
APP_POSTGRES_PASSWORD="${APP_POSTGRES_PASSWORD:-}"

# Explicit DSNs only. No shared/ambiguous DATABASE_URL.
POSTGRES_DATABASE_URL="${POSTGRES_DATABASE_URL:-}"
APP_DATABASE_URL="${APP_DATABASE_URL:-}"

if [[ -z "$POSTGRES_DATABASE_URL" ]]; then
  : "${POSTGRES_HOST:?POSTGRES_HOST is required}"
  : "${POSTGRES_PORT:?POSTGRES_PORT is required}"
  : "${POSTGRES_DB:?POSTGRES_DB is required}"
  : "${POSTGRES_USER:?POSTGRES_USER is required}"
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

  POSTGRES_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable"
fi

if [[ -z "$APP_DATABASE_URL" ]]; then
  : "${POSTGRES_HOST:?POSTGRES_HOST is required}"
  : "${POSTGRES_PORT:?POSTGRES_PORT is required}"
  : "${APP_POSTGRES_DB:?APP_POSTGRES_DB is required}"
  : "${APP_POSTGRES_USER:?APP_POSTGRES_USER is required}"
  : "${APP_POSTGRES_PASSWORD:?APP_POSTGRES_PASSWORD is required}"

  APP_DATABASE_URL="postgresql://${APP_POSTGRES_USER}:${APP_POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${APP_POSTGRES_DB}?sslmode=disable"
fi

WAIT_RETRIES="${WAIT_RETRIES:-60}"
WAIT_SECONDS="${WAIT_SECONDS:-2}"
RESET_EC_SCHEMA="${RESET_EC_SCHEMA:-0}"

log "Using POSTGRES_DATABASE_URL=$POSTGRES_DATABASE_URL"
log "Using APP_DATABASE_URL=$APP_DATABASE_URL"
log "Using SQL_FILE=$SQL_FILE"
log "Waiting for Postgres bootstrap/admin connection..."

ready=0
for ((i=1; i<=WAIT_RETRIES; i++)); do
  if PGPASSWORD="$POSTGRES_PASSWORD" psql "$POSTGRES_DATABASE_URL" -v ON_ERROR_STOP=1 -tAc "SELECT 1" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep "$WAIT_SECONDS"
done

if [[ "$ready" -ne 1 ]]; then
  err "Postgres never became ready for bootstrap/admin connection."
fi

log "Ensuring app role/database exist: role=${APP_POSTGRES_USER}, db=${APP_POSTGRES_DB}"

PGPASSWORD="$POSTGRES_PASSWORD" psql "$POSTGRES_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  --set=app_db="$APP_POSTGRES_DB" \
  --set=app_user="$APP_POSTGRES_USER" \
  --set=app_password="$APP_POSTGRES_PASSWORD" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L',
  :'app_user',
  :'app_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'app_user'
)\gexec

SELECT format(
  'ALTER ROLE %I WITH LOGIN PASSWORD %L',
  :'app_user',
  :'app_password'
)\gexec

SELECT format(
  'CREATE DATABASE %I OWNER %I',
  :'app_db',
  :'app_user'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'app_db'
)\gexec
SQL

log "Waiting for app database connection..."
app_ready=0
for ((i=1; i<=WAIT_RETRIES; i++)); do
  if PGPASSWORD="$APP_POSTGRES_PASSWORD" psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 -tAc "SELECT 1" >/dev/null 2>&1; then
    app_ready=1
    break
  fi
  sleep "$WAIT_SECONDS"
done

if [[ "$app_ready" -ne 1 ]]; then
  err "App database never became ready."
fi

log "Bootstrapping extensions and base schema in ${APP_POSTGRES_DB}..."
PGPASSWORD="$APP_POSTGRES_PASSWORD" psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS ec;
SQL

if [[ "$RESET_EC_SCHEMA" == "1" ]]; then
  log "RESET_EC_SCHEMA=1, dropping and recreating ec schema..."
  PGPASSWORD="$APP_POSTGRES_PASSWORD" psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS ec CASCADE;
CREATE SCHEMA ec;
SQL
fi

log "Applying $SQL_FILE ..."
PGPASSWORD="$APP_POSTGRES_PASSWORD" psql "$APP_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"

log "Done."