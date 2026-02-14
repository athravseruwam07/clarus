#!/usr/bin/env bash
set -euo pipefail

# note: this launches a dedicated chrome instance with remote debugging enabled so
# the connector can open d2l login as a tab in the same window (cdp attach mode).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CHROME_BIN="${CLARUS_CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
CDP_PORT="${CLARUS_CDP_PORT:-9222}"
PROFILE_DIR="${CLARUS_CHROME_PROFILE_DIR:-/tmp/clarus-chrome}"
START_URL="${CLARUS_START_URL:-http://localhost:3000/login}"

if [[ ! -x "$CHROME_BIN" ]]; then
  echo "could not find chrome at: $CHROME_BIN"
  echo "set CLARUS_CHROME_BIN to your chrome binary path and retry."
  exit 1
fi

mkdir -p "$PROFILE_DIR"

echo "[clarus] launching chrome with remote debugging on port $CDP_PORT"
echo "[clarus] profile dir: $PROFILE_DIR"
echo "[clarus] start url: $START_URL"

"$CHROME_BIN" \
  --remote-debugging-port="$CDP_PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  "$START_URL" >/dev/null 2>&1 &

echo "[clarus] chrome pid: $!"
echo "[clarus] now set PLAYWRIGHT_CONNECT_OVER_CDP=true in BE/connector/.env and restart the connector"

