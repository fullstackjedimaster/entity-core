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
POSTGRES_PORT=5432


# -------------------------------------------------------------------
# App connection inputs
# -------------------------------------------------------------------
APP_POSTGRES_DB=ec
APP_POSTGRES_USER=ec
APP_POSTGRES_PASSWORD=5R8BirEpENNOISGJl8qEG-fgMAGyX6J3vhJ9bh_rkZ-75_wsyr1fEaY7xLuPfTNL

APP_DATABASE_URL=postgresql://ec:5R8BirEpENNOISGJl8qEG-fgMAGyX6J3vhJ9bh_rkZ-75_wsyr1fEaY7xLuPfTNL@host.docker.internal:5432/ec?sslmode=disable


psql "$APP_DATABASE_URL" -f /scripts/ec.sql


log "Done."