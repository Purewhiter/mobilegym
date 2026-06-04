#!/usr/bin/env bash
#
# Build the public demo site for the `demo` branch GitHub Pages deploy.
#
#   mobilegym.dev/        -> paper landing (web/) ── SEO 主页, 同源嵌 /sim/ 交互 demo
#   mobilegym.dev/sim/    -> simulator SPA (dist/, base=/sim/)
#
# 本地预览与 CI 用同一份逻辑，确保 `本地测试通过` == `线上行为`。
# 用法:
#   scripts/build-demo-site.sh            # 默认 base=/sim/
#   SIM_BASE=/foo/ scripts/build-demo-site.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

SIM_BASE="${SIM_BASE:-/sim/}"           # 须以 / 开头和结尾
SITE_DIR="${SITE_DIR:-_site}"
ASSET_VERSION="${ASSET_VERSION:-$(git rev-parse --short HEAD 2>/dev/null || date +%s)}"

echo "==> Building simulator with base=${SIM_BASE}"
VITE_BASE="${SIM_BASE}" \
VITE_CDN_BASE="${VITE_CDN_BASE:-https://cdn.mobilegym.dev}" \
VITE_AI_BASE_URL="${VITE_AI_BASE_URL:-https://api.mobilegym.dev/ai/v1}" \
VITE_AI_MODEL="${VITE_AI_MODEL:-qwen-flash}" \
VITE_GOOGLE_MAPS_API_KEY="${VITE_GOOGLE_MAPS_API_KEY:-}" \
  npm run build

echo "==> Assembling ${SITE_DIR}/ (landing at /, simulator at ${SIM_BASE})"
rm -rf "${SITE_DIR}"
mkdir -p "${SITE_DIR}"
# landing 进根
cp -r web/* "${SITE_DIR}/"
rm -f "${SITE_DIR}/README.md"
# simulator 进 /sim/（去掉首尾 / 作为目录名）
SIM_DIR="${SIM_BASE#/}"; SIM_DIR="${SIM_DIR%/}"
mkdir -p "${SITE_DIR}/${SIM_DIR}"
cp -r dist/* "${SITE_DIR}/${SIM_DIR}/"

echo "==> Rewriting landing for root deploy"
# iframe 默认指向 /sim/（源码默认 '/'，本地 dev 不受影响）
perl -0pi -e "s#</head>#<script>window.__MG_SIM_SRC__='${SIM_BASE}';</script></head>#" "${SITE_DIR}/index.html"
# avatar 选择器的静态 <img src="/@app-assets/..."> 指向 sim base 下的实际资源
perl -0pi -e "s#/\@app-assets/#${SIM_BASE}\@app-assets/#g" "${SITE_DIR}/index.html"
# GitHub Pages / Cloudflare cache CSS and JS longer than HTML. Version the
# root landing assets so a new HTML deploy cannot pair with stale styles/scripts.
perl -0pi -e "s#(href=\"(?:tailwind|styles)\\.css)(\")#\$1?v=${ASSET_VERSION}\$2#g; s#(src=\"scripts/[^\"]+\\.js)(\")#\$1?v=${ASSET_VERSION}\$2#g" "${SITE_DIR}/index.html"

echo "==> Backwards-compat redirect /paper/ -> / (old shared links)"
mkdir -p "${SITE_DIR}/paper"
cat > "${SITE_DIR}/paper/index.html" <<'HTML'
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>Redirecting to mobilegym.dev</title>
<link rel="canonical" href="https://mobilegym.dev/">
<meta http-equiv="refresh" content="0; url=/">
<meta name="robots" content="noindex">
</head><body>
<p>This page has moved to <a href="/">mobilegym.dev</a>.</p>
<script>location.replace('/' + location.search + location.hash);</script>
</body></html>
HTML

echo "==> Custom domain + Jekyll opt-out"
echo "mobilegym.dev" > "${SITE_DIR}/CNAME"
touch "${SITE_DIR}/.nojekyll"

echo "==> Done. Top entries:"
du -sh "${SITE_DIR}"/* 2>/dev/null | sort -hr | head -10
