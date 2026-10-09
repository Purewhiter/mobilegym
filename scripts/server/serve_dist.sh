#!/bin/bash
# ============================================================
# mobile-gym production serve (build-if-stale + vite preview)
#
# Serves the production bundle in dist/ instead of the dev
# server: no React StrictMode double-rendering, minified
# assets — roughly 2x the evaluation throughput of `npm run dev`.
#
# What it does:
#   1. Rebuilds dist/ when dist/index.html is missing or older
#      than the latest git commit (HEAD).
#   2. Starts `vite preview` on the requested port
#      (--strictPort: fails instead of silently picking
#      another port).
#
# Usage:
#   ./scripts/server/serve_dist.sh          # default port 3000
#   ./scripts/server/serve_dist.sh 4173     # custom port
#
# Note: freshness is checked against the last *commit* time, so
# uncommitted working-tree edits do not trigger a rebuild — run
# `npx vite build` manually to include them.
# ============================================================

set -e

PORT=${1:-3000}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

DIST_INDEX="$ROOT_DIR/dist/index.html"

# mtime in epoch seconds: BSD stat (macOS) first, then GNU stat (Linux)
file_mtime() {
    stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null
}

needs_build=0
if [ ! -f "$DIST_INDEX" ]; then
    echo "[build] dist/index.html not found — building..."
    needs_build=1
else
    head_ts="$(git log -1 --format=%ct 2>/dev/null || echo 0)"
    dist_ts="$(file_mtime "$DIST_INDEX" || echo 0)"
    if [ "$dist_ts" -lt "$head_ts" ]; then
        echo "[build] dist/ is older than the latest commit — rebuilding..."
        needs_build=1
    else
        echo "[skip] dist/ is up to date (newer than HEAD commit). Run 'npx vite build' to force a rebuild."
    fi
fi

if [ "$needs_build" -eq 1 ]; then
    npx vite build
fi

echo "[serve] vite preview on port ${PORT} (production bundle from dist/)"
exec npx vite preview --port "$PORT" --strictPort
