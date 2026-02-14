#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! docker info >/dev/null 2>&1; then
  echo "docker is not running. start docker desktop and retry."
  exit 1
fi

echo "[clarus] starting postgres"
cd "$ROOT_DIR/BE"
docker compose up -d

echo "[clarus] installing connector deps + chromium"
cd "$ROOT_DIR/BE/connector"
npm install
npx playwright install chromium

echo "[clarus] installing api deps + prisma"
cd "$ROOT_DIR/BE/api"
npm install
npx prisma generate
npx prisma db push

echo "[clarus] installing frontend deps"
cd "$ROOT_DIR/FE"
npm install

echo "[clarus] setup complete"
