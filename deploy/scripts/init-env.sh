#!/usr/bin/env bash
set -euo pipefail

# deploy/scripts/init-env.sh
# Always regenerates deploy/env/*.env from *.env.example (clean slate every run).
# Bootstrap/admin password may be generated.
# App/ec password remains stable and is sourced from entity-core-api.env.example.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
ENV_DIR="/opt/stacks/entity-core/deploy/env"

log()  { echo -e "\033[1;32m[+] $*\033[0m"; }
err()  { echo -e "\033[1;31m[✗] $*\033[0m" >&2; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || err "Missing required command: $1"; }

need cp
need sed
need awk

gen_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 \
      | tr -d '\n' \
      | tr '+/' '-_' \
      | tr -d '='
  else
    err "openssl is required to generate secrets"
  fi
}

escape_sed_repl() {
  printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

copy_example() {
  local example="$1"
  local target="$2"
  cp -f "$example" "$target"
  log "Wrote fresh: $(basename "$target")"
}

replace_key() {
  local file="$1"
  local key="$2"
  local value="$3"
  local escaped
  escaped="$(escape_sed_repl "$value")"

  if grep -q -E "^${key}=" "$file"; then
    sed -i -E "s|^(${key}=).*$|\1${escaped}|g" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$file"
  fi
}

get_key() {
  local file="$1"
  local key="$2"
  awk -F= -v k="$key" '$1 == k {print substr($0, index($0, "=")+1)}' "$file" | tail -n 1 | tr -d '\r'
}

main() {
  local files=(
    "postgres.env"
    "entity-core-api.env"
    "entity-core.env"
  )

  log "Copying examples (fresh)..."
  for f in "${files[@]}"; do
    local example="${ENV_DIR}/${f}.example"
    local target="${ENV_DIR}/${f}"
    [[ -f "$example" ]] || err "Missing example file: $example"
    copy_example "$example" "$target"
  done
  
  SHARED_PORTFOLIO_ENV_DIR="/opt/stacks/portfolio/deploy/shared/env"
  local example="${SHARED_PORTFOLIO_ENV_DIR}/shared.env"
  local target="${ENV_DIR}/shared.env"
  copy_example "$example" "$target"

  local pg_file="${ENV_DIR}/postgres.env"
  local entity_core_api_file="${ENV_DIR}/entity-core-api.env"

  local pg_pass
  pg_pass="$(get_key "$pg_file" "POSTGRES_PASSWORD")"
  if [[ -z "$pg_pass" || "$pg_pass" == "CHANGE_ME" || "$pg_pass" == "CHANGE_ME_STRONG_PASSWORD" ]]; then
    pg_pass="$(gen_secret)"
    replace_key "$pg_file" "POSTGRES_PASSWORD" "$pg_pass"
    log "Generated POSTGRES_PASSWORD in $(basename "$pg_file")"
  else
    log "POSTGRES_PASSWORD already set in $(basename "$pg_file")"
  fi

  local app_pg_pass
  app_pg_pass="$(get_key "$pg_file" "APP_POSTGRES_PASSWORD")"
  if [[ -z "$app_pg_pass" || "$app_pg_pass" == "CHANGE_ME" || "$app_pg_pass" == "CHANGE_ME_STRONG_PASSWORD" ]]; then
    app_pg_pass="$pg_pass"
    replace_key "$pg_file" "APP_POSTGRES_PASSWORD" "$app_pg_pass"
    log "Set APP_POSTGRES_PASSWORD in $(basename "$pg_file")"
  fi

  local host port admin_db admin_user app_db app_user
  host="$(get_key "$pg_file" "POSTGRES_HOST")"
  port="$(get_key "$pg_file" "POSTGRES_PORT")"
  admin_db="$(get_key "$pg_file" "POSTGRES_DB")"
  admin_user="$(get_key "$pg_file" "POSTGRES_USER")"
  app_db="$(get_key "$pg_file" "APP_POSTGRES_DB")"
  app_user="$(get_key "$pg_file" "APP_POSTGRES_USER")"

  host="${host:-postgres}"
  port="${port:-5432}"
  admin_db="${admin_db:-postgres}"
  admin_user="${admin_user:-postgres}"
  app_db="${app_db:-ec}"
  app_user="${app_user:-ec}"

  local admin_dsn
  local app_dsn

  admin_dsn="postgresql://${admin_user}:${pg_pass}@${host}:${port}/${admin_db}?sslmode=disable"
  app_dsn="postgresql://${app_user}:${app_pg_pass}@${host}:${port}/${app_db}?sslmode=disable"

  replace_key "$pg_file" "POSTGRES_DATABASE_URL" "$admin_dsn"
  replace_key "$pg_file" "APP_DATABASE_URL" "$app_dsn"

#  # Make the API env point at the app DB/user, not the bootstrap admin DB/user.
#  replace_key "$entity_core_api_file" "POSTGRES_HOST" "$host"
#  replace_key "$entity_core_api_file" "POSTGRES_PORT" "$port"
#  replace_key "$entity_core_api_file" "POSTGRES_DB" "$app_db"
#  replace_key "$entity_core_api_file" "POSTGRES_USER" "$app_user"
#  replace_key "$entity_core_api_file" "POSTGRES_PASSWORD" "$app_pg_pass"
#  replace_key "$entity_core_api_file" "DATABASE_URL" "$app_dsn"

  log "Wrote admin/app DATABASE_URL values deterministically"
  log "Environment initialization complete ✔"
}

main "$@"
