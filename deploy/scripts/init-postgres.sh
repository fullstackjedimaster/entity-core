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

POSTGRES_HOST=entity-core-postgres
POSTGRES_PORT=5432
POSTGRES_DB="${POSTGRES_DB:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"

POSTGRES_DATABASE_URL="${POSTGRES_DATABASE_URL:-}"

if [[ -z "$POSTGRES_DATABASE_URL" ]]; then

  POSTGRES_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?sslmode=disable"
fi


log "Using APP_DATABASE_URL=$APP_DATABASE_URL"
log "Using SQL_FILE=$SQL_FILE"




psql "$POSTGRES_DATABASE_URL" -f /scripts/ec.sql


log "Done."