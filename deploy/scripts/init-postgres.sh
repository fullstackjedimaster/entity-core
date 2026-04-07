#!/usr/bin/env bash
set -euo pipefail

log() { echo -e "\033[1;32m[init-postgres] $*\033[0m"; }
err() { echo -e "\033[1;31m[init-postgres] $*\033[0m" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Prefer deploy/sql/ec.sql, but also allow deploy/ec.sql for flexibility.
SQL_FILE="${SQL_FILE:-}"
if [[ -z "${SQL_FILE}" ]]; then
  if [[ -f "$DEPLOY_DIR/sql/ec.sql" ]]; then
    SQL_FILE="$DEPLOY_DIR/sql/ec.sql"
  elif [[ -f "$DEPLOY_DIR/ec.sql" ]]; then
    SQL_FILE="$DEPLOY_DIR/ec.sql"
  else
    err "Could not find ec.sql. Expected one of:
  - $DEPLOY_DIR/sql/ec.sql
  - $DEPLOY_DIR/ec.sql
You can also set SQL_FILE explicitly."
  fi
fi

DATABASE_URL="${DATABASE_URL:-}"
POSTGRES_HOST="${POSTGRES_HOST:-${DATABASE_HOST:-}}"
POSTGRES_PORT="${POSTGRES_PORT:-${DATABASE_PORT:-5432}}"
POSTGRES_DB="${POSTGRES_DB:-}"
POSTGRES_USER="${POSTGRES_USER:-}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

if [[ -z "$DATABASE_URL" ]]; then
  : "${POSTGRES_HOST:?POSTGRES_HOST is required}"
  : "${POSTGRES_PORT:?POSTGRES_PORT is required}"
  : "${POSTGRES_DB:?POSTGRES_DB is required}"
  : "${POSTGRES_USER:?POSTGRES_USER is required}"
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

  export PGPASSWORD="$POSTGRES_PASSWORD"
  DATABASE_URL="postgresql://${POSTGRES_USER}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
fi

WAIT_RETRIES="${WAIT_RETRIES:-60}"
WAIT_SECONDS="${WAIT_SECONDS:-2}"
RESET_EC_SCHEMA="${RESET_EC_SCHEMA:-0}"

log "Using DATABASE_URL=$DATABASE_URL"
log "Using SQL_FILE=$SQL_FILE"
log "Waiting for Postgres..."

ready=0
for ((i=1; i<=WAIT_RETRIES; i++)); do
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAc "SELECT 1" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep "$WAIT_SECONDS"
done

if [[ "$ready" -ne 1 ]]; then
  err "Postgres never became ready."
fi

log "Bootstrapping extensions and base schema..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS ec;
SQL

if [[ "$RESET_EC_SCHEMA" == "1" ]]; then
  log "RESET_EC_SCHEMA=1, dropping and recreating ec schema..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS ec CASCADE;
CREATE SCHEMA ec;
SQL
fi

log "Applying $SQL_FILE ..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"

log "Done."