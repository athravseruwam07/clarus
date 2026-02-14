#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! docker info >/dev/null 2>&1; then
  echo "docker is not running. start docker desktop and retry."
  exit 1
fi

require_port_free() {
  local port="$1"
  local service="$2"
  local pid
  pid="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n 1 || true)"
  if [[ -n "$pid" ]]; then
    echo "port ${port} is already in use (pid ${pid}). stop that process before starting ${service}."
    exit 1
  fi
}

require_port_free 4002 "connector"
require_port_free 4001 "api"
require_port_free 3000 "frontend"

cd "$ROOT_DIR/BE"
docker compose up -d

pids=()
cleaned_up=0

start_service() {
  local name="$1"
  local dir="$2"
  echo "[clarus] starting ${name}"
  bash -lc "cd \"$dir\" && npm run dev" &
  pids+=("$!")
}

cleanup() {
  if [[ "$cleaned_up" -eq 1 ]]; then
    return
  fi
  cleaned_up=1
  echo "[clarus] stopping services"
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait || true
}

trap cleanup INT TERM EXIT

start_service "connector" "$ROOT_DIR/BE/connector"
start_service "api" "$ROOT_DIR/BE/api"
start_service "frontend" "$ROOT_DIR/FE"

wait
