#!/bin/bash
# ============================================================
# mobile-gym 生产环境一键启动 (Nginx + API backend)
#
# 架构:
#   Nginx (:PORT) ──┬── 静态文件 (dist/)  ← sendfile 零拷贝
#                   └── /api/gw/* → Python (:PORT+1)
#
# 使用:
#   ./scripts/server/start_nginx_gateway.sh          # 默认 4180
#   ./scripts/server/start_nginx_gateway.sh 4185     # 自定义端口
#   ./scripts/server/start_nginx_gateway.sh stop     # 停止
# ============================================================

PORT=${1:-4180}
API_PORT=$((PORT + 1))
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR" || exit 1

find_bin() {
    local names=("$@")
    # 1. Try command -v for each candidate name
    for name in "${names[@]}"; do
        local found
        found="$(command -v "$name" 2>/dev/null)"
        if [ -n "$found" ]; then echo "$found"; return; fi
    done
    # 2. conda / well-known fallback
    for name in "${names[@]}"; do
        local dir
        for dir in \
            "${CONDA_PREFIX:-}" \
            "${CONDA_EXE%/bin/conda}" \
            "$HOME/miniconda3" \
            "$HOME/anaconda3" \
            "$HOME/miniforge3"; do
            [ -n "$dir" ] && [ -x "$dir/bin/$name" ] && { echo "$dir/bin/$name"; return; }
        done
    done
    echo "[error] Cannot find '${names[*]}'. Install it or set ${names[0]^^}_BIN." >&2
    exit 1
}

NGINX_BIN="${NGINX_BIN:-$(find_bin nginx)}"
NGINX_DIR="$ROOT_DIR/.nginx"
PIDFILE_API="$ROOT_DIR/.api_gateway.pid"
NGINX_SOURCE_CONFIG="$ROOT_DIR/.nginx/nginx.source.conf"

escape_sed_replacement() {
    printf '%s' "$1" | sed -e 's/[\/&]/\\&/g'
}

render_nginx_config() {
    local output="$NGINX_DIR/nginx.run.conf"
    if [ ! -f "$NGINX_SOURCE_CONFIG" ]; then
        echo "[error] Missing nginx source config: $NGINX_SOURCE_CONFIG" >&2
        exit 1
    fi

    local esc_nginx_dir esc_mime_types esc_root
    esc_nginx_dir="$(escape_sed_replacement "$NGINX_DIR")"
    esc_mime_types="$(escape_sed_replacement "$MIME_TYPES")"
    esc_root="$(escape_sed_replacement "$ROOT_DIR")"

    sed \
        -e "s/__NGINX_DIR__/$esc_nginx_dir/g" \
        -e "s/__MIME_TYPES__/$esc_mime_types/g" \
        -e "s/__ROOT__/$esc_root/g" \
        -e "s/__PORT__/$PORT/g" \
        -e "s/__API_PORT__/$API_PORT/g" \
        "$NGINX_SOURCE_CONFIG" > "$output"
}

stop_servers() {
    echo "[stop] Stopping servers..."
    # Stop Nginx
    if [ -f "$NGINX_DIR/nginx.pid" ]; then
        "$NGINX_BIN" -s stop -c "$NGINX_DIR/nginx.run.conf" 2>/dev/null
        echo "  nginx stopped"
    fi
    # Stop API backend (kill process group for clean shutdown)
    if [ -f "$PIDFILE_API" ]; then
        local pid
        pid="$(cat "$PIDFILE_API")"
        kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null
        echo "  api stopped"
        rm -f "$PIDFILE_API"
    fi
}

if [ "$1" = "stop" ]; then
    stop_servers
    exit 0
fi

# Stop any previous instances
stop_servers

# Create dirs
mkdir -p "$NGINX_DIR"/{logs,temp,ssl}

# Auto-generate self-signed TLS certificate for HTTP/2 (one-time)
if [ ! -f "$NGINX_DIR/ssl/localhost.crt" ]; then
    echo "[setup] Generating self-signed TLS certificate for HTTP/2..."
    if ! openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout "$NGINX_DIR/ssl/localhost.key" \
        -out "$NGINX_DIR/ssl/localhost.crt" \
        -subj '/CN=localhost'; then
        echo "[error] Failed to generate TLS certificate. Is openssl installed?" >&2
        exit 1
    fi
    echo "  cert: $NGINX_DIR/ssl/localhost.crt"
fi

# Generate Nginx config
MIME_TYPES="$NGINX_DIR/mime.types"
if [ ! -f "$MIME_TYPES" ]; then
    for p in \
        "$(dirname "$NGINX_BIN")/../etc/nginx/mime.types" \
        "/etc/nginx/mime.types"; do
        if [ -f "$p" ]; then cp "$p" "$MIME_TYPES"; break; fi
    done
fi
render_nginx_config

# 1. Start API backend (uvicorn multi-worker via conda rllm)
PYTHON_BIN="${PYTHON_BIN:-$(find_bin python python3)}"
API_WORKERS=${API_WORKERS:-8}
echo "[start] API gateway on :${API_PORT} (workers=${API_WORKERS})"
# setsid 在 Linux 上给 API gateway 起独立进程组，便于 stop 时 kill -- "-$pid" 一次清理 uvicorn 全家。
# macOS 默认没有 setsid，退回 nohup（同样能脱离终端 SIGHUP）；stop_servers 里的 `|| kill "$pid"` 会兜底。
if command -v setsid >/dev/null 2>&1; then
    setsid "$PYTHON_BIN" "$SCRIPT_DIR/api_gateway.py" --port "$API_PORT" --workers "$API_WORKERS" \
        >> "$NGINX_DIR/logs/api_gateway.log" 2>&1 &
else
    nohup "$PYTHON_BIN" "$SCRIPT_DIR/api_gateway.py" --port "$API_PORT" --workers "$API_WORKERS" \
        >> "$NGINX_DIR/logs/api_gateway.log" 2>&1 &
fi
echo $! > "$PIDFILE_API"

# 2. Start Nginx
echo "[start] Nginx on :${PORT} (workers=8)"
"$NGINX_BIN" -c "$NGINX_DIR/nginx.run.conf"

sleep 0.5
echo ""
echo "✅ mobile-gym serving at https://0.0.0.0:${PORT}  (HTTP/2 + TLS)"
echo "   Static:  Nginx (sendfile + HTTP/2 + 8 workers)"
echo "   API:     uvicorn + starlette (:${API_PORT}, ${API_WORKERS} workers)"
echo ""
echo "   Stop:    $0 stop"
echo "   Logs:    $NGINX_DIR/logs/{error,access,api_gateway}.log"
