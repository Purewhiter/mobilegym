# P1 — 工程质量：CI/CD、Lint、Docker、版本管理

> 优先级：**P1（发布质量）**
> 预计工作量：2 人 × 2 周
> 涉及文件：项目根目录配置文件、`.github/`、`Dockerfile`

---

## 1. ESLint + Prettier 配置

### 1.1 现状

项目无任何 lint/format 配置。26 个 App + OS 层共 200+ 个 TS/TSX 文件，代码风格全靠人工约定。

### 1.2 目标配置

#### 安装依赖

```bash
npm install -D \
  eslint \
  @eslint/js \
  typescript-eslint \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  eslint-plugin-react-refresh \
  prettier \
  eslint-config-prettier \
  lint-staged \
  husky
```

#### `eslint.config.mjs`（flat config）

```javascript
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // 全局忽略
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'runs/**',
      'bench_env/**',
      'scripts/**',
      'decompiled/**',
      'ui_dumps/**',
      '*.config.*',
    ],
  },

  // 基础规则
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // React
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/react-in-jsx-scope': 'off',
    },
  },

  // 项目自定义规则
  {
    rules: {
      // 允许 _ 前缀的未使用变量（常见于 React 回调参数）
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 禁止 any（警告级，Phase 2 再升级为 error）
      '@typescript-eslint/no-explicit-any': 'warn',
      // 禁止 as any
      '@typescript-eslint/no-unsafe-assignment': 'off',
      // 禁止空函数（但允许空回调）
      '@typescript-eslint/no-empty-function': [
        'warn',
        { allow: ['arrowFunctions'] },
      ],
      // console.error/warn 允许，console.log 警告
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Prettier 兼容（放最后）
  prettierConfig,
);
```

#### `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

#### `.prettierignore`

```
dist/
node_modules/
runs/
bench_env/
decompiled/
ui_dumps/
index.css
package-lock.json
*.json
```

### 1.3 自定义 ESLint 规则（禁止 App 层直接用 `useNavigate()`）

```javascript
// eslint-plugin-mobile-gym/no-direct-navigate.js
module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow direct useNavigate() in app pages' },
  },
  create(context) {
    const filename = context.getFilename();
    if (!filename.includes('/apps/') || !filename.includes('/pages/')) return {};

    return {
      ImportSpecifier(node) {
        if (
          node.imported.name === 'useNavigate' &&
          node.parent.source.value === 'react-router-dom'
        ) {
          context.report({
            node,
            message:
              'App pages must use useAppNavigate() (go/back) instead of useNavigate() directly. See CLAUDE.md.',
          });
        }
      },
    };
  },
};
```

### 1.4 Git Hooks

```bash
npx husky init
echo 'npx lint-staged' > .husky/pre-commit
```

`package.json` 追加：

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

### 1.5 渐进式采纳策略

大量存量代码不可能一次性修复。建议分三步：

1. **Week 1**：所有规则设为 `warn`，运行 `eslint . > lint-report.txt` 统计问题量
2. **Week 2**：自动修复（`eslint --fix` + `prettier --write`），提交一个大 PR
3. **Week 3+**：将关键规则升级为 `error`，CI 中阻断

---

## 2. CI/CD 流水线

### 2.1 GitHub Actions

#### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  typecheck-and-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: ESLint
        run: npx eslint . --max-warnings=0

      - name: Prettier check
        run: npx prettier --check .

  test:
    runs-on: ubuntu-latest
    needs: typecheck-and-lint
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm test -- --coverage
      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  nav-consistency:
    runs-on: ubuntu-latest
    needs: typecheck-and-lint
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Check navigation declarations
        run: |
          for dir in apps/*/; do
            app=$(basename "$dir")
            if [ -f "$dir/navigation.declaration.ts" ]; then
              echo "=== Checking $app ==="
              node scripts/check_navigation_declaration_consistency.mjs "$app" --actions || exit 1
            fi
          done

  bench-env-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - run: pip install ruff
      - run: ruff check bench_env/
      - run: ruff format --check bench_env/
```

#### `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run build

      - name: Build Docker image
        run: docker build -t mobile-gym:${{ github.ref_name }} .

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: dist/**
          generate_release_notes: true
```

### 2.2 `package.json` scripts 补全

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:ci": "vitest --run --coverage",
    "nav:check": "node scripts/check_navigation_declaration_consistency.mjs",
    "nav:build": "node scripts/build_nav_artifacts.mjs",
    "prepare": "husky"
  }
}
```

---

## 3. Docker 支持

### 3.1 `Dockerfile`

```dockerfile
# ---- Stage 1: Build ----
FROM node:20-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: Serve ----
FROM nginx:alpine AS serve

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3.2 `docker/nginx.conf`

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        # 如果需要 API 代理，在此配置
        return 404;
    }

    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3.3 `docker-compose.yml`（开发 + benchmark 环境）

```yaml
version: "3.9"

services:
  simulator:
    build:
      context: .
      target: build
    command: npm run dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - VITE_GOOGLE_MAPS_API_KEY=${VITE_GOOGLE_MAPS_API_KEY:-}
      - VITE_CAIYUN_TOKEN=${VITE_CAIYUN_TOKEN:-}
      - VITE_QWEATHER_HOST=${VITE_QWEATHER_HOST:-}
      - VITE_QWEATHER_API_KEY=${VITE_QWEATHER_API_KEY:-}
      - VITE_AMAP_API_KEY=${VITE_AMAP_API_KEY:-}

  benchmark:
    build:
      context: .
      dockerfile: docker/Dockerfile.bench
    depends_on:
      - simulator
    environment:
      - ENV_URL=http://simulator:3000
    volumes:
      - ./runs:/app/runs
      - ./bench_env:/app/bench_env
```

### 3.4 `docker/Dockerfile.bench`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    wget \
    && rm -rf /var/lib/apt/lists/*

COPY bench_env/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install --with-deps chromium

COPY bench_env/ ./bench_env/
COPY scripts/ ./scripts/

ENTRYPOINT ["python", "-m", "bench_env.run"]
```

### 3.5 `.dockerignore`

```
node_modules/
dist/
runs/
.git/
.env
*.apk
apks/
decompiled/
ui_dumps/
all_dicts/
extracted_assets/
paper/
```

---

## 4. 版本管理与发布流程

### 4.1 Semantic Versioning

```
MAJOR.MINOR.PATCH

- MAJOR: __SIM__ / __OS__ API 不兼容变更
- MINOR: 新 App、新功能、新 Agent 类型
- PATCH: Bug 修复、文档更新
```

起始版本建议：`0.1.0`（表示 API 尚未稳定）

### 4.2 Conventional Commits

安装验证工具：

```bash
npm install -D @commitlint/cli @commitlint/config-conventional
```

`commitlint.config.mjs`:

```javascript
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['os', 'app', 'bench', 'scripts', 'docs', 'ci', 'deps'],
    ],
  },
};
```

`.husky/commit-msg`:

```bash
npx --no -- commitlint --edit ${1}
```

### 4.3 Changelog 自动生成

```bash
npm install -D standard-version
```

`package.json`:

```json
{
  "scripts": {
    "release": "standard-version",
    "release:minor": "standard-version --release-as minor",
    "release:major": "standard-version --release-as major"
  }
}
```

### 4.4 发布清单

每次发布前：

- [ ] `npm run typecheck` 通过
- [ ] `npm run lint` 零错误
- [ ] `npm test` 全部通过
- [ ] 导航一致性检查通过
- [ ] `CHANGELOG.md` 已更新
- [ ] 版本号已 bump
- [ ] Git tag 已打

---

## 5. Python 代码质量（bench_env）

### 5.1 引入 Ruff

```bash
pip install ruff
```

`pyproject.toml`：

```toml
[tool.ruff]
target-version = "py311"
line-length = 100

[tool.ruff.lint]
select = ["E", "W", "F", "I", "N", "UP", "B", "A", "C4", "SIM"]
ignore = ["E501"]

[tool.ruff.format]
quote-style = "double"
```

### 5.2 类型检查

```bash
pip install pyright
```

`pyrightconfig.json`:

```json
{
  "include": ["bench_env"],
  "pythonVersion": "3.11",
  "typeCheckingMode": "basic"
}
```

---

## 6. 清理遗留项

### 6.1 移除未使用的 Puppeteer

`package.json` 的 `devDependencies` 中有 `puppeteer`（^24.34.0），但前端无任何使用。bench_env 使用的是 Python Playwright。

```bash
npm uninstall puppeteer
```

如果某个脚本仍需要（验证后确认），保留但添加注释说明。

### 6.2 端口统一

全局搜索 `5173`，统一改为 `3000`（与 `vite.config.ts` 一致）。涉及：
- `README.md`
- `bench_env/README.md`
- `apps/*/tools/` 中的脚本
- `docs/` 中的文档

---

## 检查清单

- [ ] ESLint flat config 创建并验证
- [ ] Prettier 配置创建
- [ ] Husky + lint-staged 配置
- [ ] Commitlint 配置
- [ ] `package.json` scripts 补全
- [ ] `.github/workflows/ci.yml` 创建
- [ ] `.github/workflows/release.yml` 创建
- [ ] `Dockerfile` + `docker-compose.yml` 创建
- [ ] `.dockerignore` 创建
- [ ] `pyproject.toml` ruff/pyright 配置
- [ ] 移除未使用的 puppeteer
- [ ] 端口号统一为 3000
- [ ] `standard-version` 配置
- [ ] 初始版本号 bump 到 0.1.0
