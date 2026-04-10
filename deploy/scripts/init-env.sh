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

is_placeholder() {
  local v="${1:-}"
  [[ -z "$v" || "$v" == CHANGE_ME* ]]
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

  local pg_file="${ENV_DIR}/postgres.env"
  local api_file="${ENV_DIR}/entity-core-api.env"

  local host port
  local admin_db admin_user admin_pass
  local app_db app_user app_pass

  host="$(get_key "$pg_file" "POSTGRES_HOST")"
  port="$(get_key "$pg_file" "POSTGRES_PORT")"
  admin_db="$(get_key "$pg_file" "POSTGRES_DB")"
  admin_user="$(get_key "$pg_file" "POSTGRES_USER")"
  admin_pass="$(get_key "$pg_file" "POSTGRES_PASSWORD")"

  app_db="$(get_key "$api_file" "POSTGRES_DB")"
  app_user="$(get_key "$api_file" "POSTGRES_USER")"
  app_pass="$(get_key "$api_file" "POSTGRES_PASSWORD")"

  host="${host:-postgres}"
  port="${port:-5432}"
  admin_db="${admin_db:-postgres}"
  admin_user="${admin_user:-postgres}"
  app_db="${app_db:-ec}"
  app_user="${app_user:-ec}"

  if is_placeholder "$admin_pass"; then
    admin_pass="$(gen_secret)"
    log "Generated bootstrap/admin POSTGRES_PASSWORD"
  else
    log "Using existing bootstrap/admin POSTGRES_PASSWORD from postgres.env.example"
  fi

  if is_placeholder "$app_pass"; then
    err "entity-core-api.env.example must define a stable POSTGRES_PASSWORD for the ec app user (not CHANGE_ME...)."
  fi

  replace_key "$pg_file" "POSTGRES_HOST" "$host"
  replace_key "$pg_file" "POSTGRES_PORT" "$port"
  replace_key "$pg_file" "POSTGRES_DB" "$admin_db"
  replace_key "$pg_file" "POSTGRES_USER" "$admin_user"
  replace_key "$pg_file" "POSTGRES_PASSWORD" "$admin_pass"

  replace_key "$pg_file" "APP_POSTGRES_DB" "$app_db"
  replace_key "$pg_file" "APP_POSTGRES_USER" "$app_user"
  replace_key "$pg_file" "APP_POSTGRES_PASSWORD" "$app_pass"

  replace_key "$api_file" "POSTGRES_HOST" "$host"
  replace_key "$api_file" "POSTGRES_PORT" "$port"
  replace_key "$api_file" "POSTGRES_DB" "$app_db"
  replace_key "$api_file" "POSTGRES_USER" "$app_user"
  replace_key "$api_file" "POSTGRES_PASSWORD" "$app_pass"

  local postgres_dsn
  local app_dsn

  postgres_dsn="postgresql://${admin_user}:${admin_pass}@${host}:${port}/${admin_db}?sslmode=disable"
  app_dsn="postgresql://${app_user}:${app_pass}@${host}:${port}/${app_db}?sslmode=disable"

  replace_key "$pg_file" "POSTGRES_DATABASE_URL" "$postgres_dsn"
  replace_key "$pg_file" "APP_DATABASE_URL" "$app_dsn"

  # Keep API env explicit and app-only.
  replace_key "$api_file" "APP_DATABASE_URL" "$app_dsn"
  replace_key "$api_file" "DATABASE_URL" "$app_dsn"

  log "Wrote POSTGRES_DATABASE_URL and APP_DATABASE_URL deterministically"
  log "Synced stable ec password from entity-core-api.env.example into postgres.env"
  log "Environment initialization complete ✔"
}

main "$@"