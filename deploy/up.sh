#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_PROJECT_NAME="$(basename "$(dirname "$DEPLOY_DIR")")"

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

docker compose -p "$COMPOSE_PROJECT_NAME" -f "$DEPLOY_DIR"/compose.yml down -v --remove-orphans

echo "[up] Generating env + secrets"
bash "$DEPLOY_DIR/scripts/init-env.sh"

echo "[up] Loading env into shell"
set -a
source "$DEPLOY_DIR/env/postgres.env"
source "$DEPLOY_DIR/env/entity-core-api.env"
set +a

#docker compose -p "$COMPOSE_PROJECT_NAME" -f "$DEPLOY_DIR"/compose.yml build --no-cache

echo "[up] Starting stack"
docker compose -p "$COMPOSE_PROJECT_NAME" -f "$DEPLOY_DIR"/compose.yml up -d --build

docker compose logs -f



echo "[up] Done"