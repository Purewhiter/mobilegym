#!/bin/bash
# Explore several apps' navigation graphs in parallel against a build behind the nginx gateway.
#
#   scripts/explore_apps.sh OUT_DIR app1 app2 ...
#
# Builds the checkout (skip with NO_BUILD=1), starts scripts/server/start_nginx_gateway.sh,
# runs scripts/explore_nav_graph.py for every app at once (STAGGER seconds apart), writes
# OUT_DIR/<app>.json + .log and one status line per app to OUT_DIR/_status.txt, then stops
# the gateway (keep it with KEEP_GATEWAY=1).
#
# vite dev is not used: every tap starts from a full reload, and unbundled modules make
# a dev server the bottleneck once a few explorers run (late data, pages missing from graphs).
#
# Environment: PORT (4180), DEVICE_WORKERS (4), PYTHON_BIN, NGINX_BIN, NO_BUILD, KEEP_GATEWAY, STAGGER (3).
# Set DEBUG=pw:browser to copy Chromium's own stderr into each app's log.

set -u
out=${1:?usage: explore_apps.sh OUT_DIR app...}; shift
[ $# -gt 0 ] || { echo "usage: explore_apps.sh OUT_DIR app..." >&2; exit 2; }
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT=${PORT:-4180}
PYTHON_BIN=${PYTHON_BIN:-python}
mkdir -p "$out"; out="$(cd "$out" && pwd)"
: > "$out/_status.txt"
ulimit -n 65536 2>/dev/null || true  # every Chromium keeps many sockets open
cd "$ROOT_DIR" || exit 1

pids=()
cleanup() {
  for pid in ${pids[@]+"${pids[@]}"}; do pkill -P "$pid" 2>/dev/null; kill "$pid" 2>/dev/null; done
  [ -n "${KEEP_GATEWAY:-}" ] || bash scripts/server/start_nginx_gateway.sh stop >> "$out/_gateway.log" 2>&1
}
trap cleanup EXIT
trap 'exit 130' INT TERM

if [ -z "${NO_BUILD:-}" ]; then
  npm run build > "$out/_build.log" 2>&1 || { echo "build failed, see $out/_build.log" | tee -a "$out/_status.txt"; exit 1; }
fi
PYTHON_BIN="$PYTHON_BIN" DEVICE_WORKERS=${DEVICE_WORKERS:-4} bash scripts/server/start_nginx_gateway.sh "$PORT" > "$out/_gateway.log" 2>&1
curl -skf "https://127.0.0.1:$PORT/__device/health" > /dev/null \
  || { echo "gateway not up, see $out/_gateway.log" | tee -a "$out/_status.txt"; exit 1; }

for app in "$@"; do
  (
    start=$(date +%s)
    "$PYTHON_BIN" scripts/explore_nav_graph.py "https://127.0.0.1:$PORT/" "$app" "$out/$app.json" > "$out/$app.log" 2>&1
    rc=$?
    last=$(grep -v 'pw:browser' "$out/$app.log" | grep -v '^\s*$' | tail -n 1 | cut -c1-120)
    echo "$app rc=$rc $(( $(date +%s) - start ))s $last" >> "$out/_status.txt"
  ) &
  pids+=($!)
  sleep "${STAGGER:-3}"
done
wait "${pids[@]}"
pids=()

echo ALL_DONE >> "$out/_status.txt"
# Non-zero when any explorer failed (its graph may be missing).
! grep -q " rc=[1-9]" "$out/_status.txt"
