# P0 — 安全与法律合规

> 优先级：**P0（发布前必须完成）**
> 预计工作量：1 人 × 2 天
> 涉及文件：`.gitignore`、`.env`、`package.json`、`LICENSE`、`README.md`

---

## 1. API 密钥安全

### 1.1 现状

`.env` 文件包含真实 API Key 但未被 `.gitignore` 忽略：

```
VITE_GOOGLE_MAPS_API_KEY=...
VITE_CAIYUN_TOKEN=...
VITE_QWEATHER_HOST=...
VITE_QWEATHER_API_KEY=...
VITE_AMAP_API_KEY=...
```

若仓库已有公开提交历史，密钥可能已泄露。

### 1.2 修复步骤

#### Step 1：修改 `.gitignore`

在 `.gitignore` 末尾追加：

```gitignore
# Environment files (API keys, secrets)
.env
.env.local
.env.*.local
```

#### Step 2：创建 `.env.example`

```env
# Google Maps JavaScript API Key (optional, enables Map app)
VITE_GOOGLE_MAPS_API_KEY=

# 彩云天气 API Token (optional, enables Weather app real data)
VITE_CAIYUN_TOKEN=

# 和风天气 API (optional)
VITE_QWEATHER_HOST=https://devapi.qweather.com
VITE_QWEATHER_API_KEY=

# 高德地图 API Key (optional)
VITE_AMAP_API_KEY=

# API Gateway 允许的代理目标主机（逗号分隔，为空则允许全部 — 仅开发环境使用）
VITE_GW_ALLOW_HOSTS=
```

#### Step 3：从 Git 历史中移除 `.env`

```bash
# 从追踪中移除（保留本地文件）
git rm --cached .env

# 如果历史中已包含密钥，用 git-filter-repo 清理：
pip install git-filter-repo
git filter-repo --path .env --invert-paths
```

#### Step 4：轮换已泄露密钥

- Google Maps API Key → Google Cloud Console → 重新生成
- 彩云天气 Token → 彩云控制台 → 重新生成
- 和风天气 API Key → QWeather 控制台 → 重新生成
- 高德地图 Key → 高德开放平台 → 重新生成

#### Step 5：为无 API Key 场景提供 fallback

修改相关 App 使其在缺少 API Key 时优雅降级：

```typescript
// apps/Map/MapApp.tsx
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  // 使用 Leaflet + OpenStreetMap 作为 fallback
  // 或显示 "请配置 VITE_GOOGLE_MAPS_API_KEY" 提示
}

// apps/Weather/data/weatherApi.ts
const TOKEN = import.meta.env.VITE_CAIYUN_TOKEN;
if (!TOKEN) {
  // 返回 mock 天气数据
}
```

API Gateway（`vite.config.ts` 中的 `apiGatewayPlugin`）在无 `VITE_GW_ALLOW_HOSTS` 时允许全部代理目标，需改为默认拒绝：

```typescript
// vite.config.ts apiGatewayPlugin
const allowHosts = (env.VITE_GW_ALLOW_HOSTS || '').split(',').filter(Boolean);
if (allowHosts.length === 0) {
  // 开发环境：默认允许已知列表
  // 生产环境：默认拒绝
}
```

---

## 2. 开源许可证

### 2.1 现状

项目根目录无 `LICENSE` 文件。没有许可证 = 默认保留所有权利，他人无法合法使用。

### 2.2 许可证选择

| 许可证 | 适用场景 | 推荐度 |
|--------|---------|--------|
| **Apache 2.0** | 允许商用但要求声明修改、附带原许可证；有专利授权条款 | ★★★★★ |
| MIT | 最宽松，几乎无限制 | ★★★★ |
| GPL 3.0 | 要求衍生作品也开源（传染性） | ★★ |

**推荐 Apache 2.0**：比 MIT 多了专利保护，适合有学术背景的项目。

### 2.3 操作

1. 在项目根目录创建 `LICENSE` 文件（Apache 2.0 全文）
2. 在 `package.json` 添加 `"license": "Apache-2.0"`
3. 在 `README.md` 底部添加许可证章节
4. 在 `bench_env/` 的 `setup.py` 或 `pyproject.toml` 中同步声明

---

## 3. 品牌与商标合规

### 3.1 现状

26 个模拟 App 中，多个使用了真实品牌名称和 UI 设计：

| 模拟 App | 对应真实品牌 | 风险等级 |
|----------|------------|---------|
| Wechat | 微信（腾讯） | 高 |
| Alipay | 支付宝（蚂蚁集团） | 高 |
| Bilibili | 哔哩哔哩 | 高 |
| RedBook | 小红书 | 高 |
| Railway12306 | 12306（铁道部） | 中 |
| TencentMeeting | 腾讯会议 | 高 |
| WechatReading | 微信读书 | 高 |
| Spotify | Spotify | 高 |
| Reddit | Reddit | 高 |
| Ebay | eBay | 高 |
| X | X/Twitter | 高 |

### 3.2 合规策略

#### 方案 A：学术免责声明（最小改动）

在 `README.md` 和应用启动界面添加免责声明：

```markdown
## Disclaimer

This project is an academic research tool for training and evaluating
mobile phone operation agents. All simulated applications are created
for research purposes only. Brand names, logos, and UI designs are
used solely for realistic simulation. This project is not affiliated
with, endorsed by, or associated with any of the companies whose
products are simulated.

All trademarks belong to their respective owners.
```

#### 方案 B：去品牌化模式（推荐用于正式发布）

为每个 App 提供双模式 manifest：

```typescript
// apps/Wechat/manifest.ts
export const manifest: AppManifest = {
  id: 'wechat',
  // 学术模式（默认）
  displayName: '微信',
  displayNameEn: 'WeChat',
  // 去品牌化模式
  genericDisplayName: '即时通讯',
  genericDisplayNameEn: 'Messenger',
  // ...
};
```

在 OS 层通过配置切换：

```typescript
// os/data/osConfig.ts
export const OS_CONFIG = {
  brandingMode: 'academic' | 'generic', // default: 'academic'
};
```

#### 方案 C：完全去品牌化（最安全）

重新设计所有 App 的名称和图标，使用虚构品牌。工作量最大但法律风险最低。

### 3.3 推荐路线

1. **Phase 0**：先实施方案 A（免责声明），允许快速发布
2. **Phase 2**：实施方案 B（双模式），作为可选配置
3. 咨询法律顾问确认最终策略

---

## 4. 包名与项目标识修正

### 4.1 现状

- `package.json` 的 `name` 字段为 `"wechat-replica"`
- `version` 为 `"0.0.0"`

### 4.2 修改

```jsonc
// package.json
{
  "name": "mobile-gym",           // 或 "@mobile-gym/simulator"
  "version": "0.1.0",             // 正式起步版本
  "description": "A simulated Android OS environment for training and evaluating mobile phone operation agents",
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/<org>/mobile-gym"
  },
  "keywords": [
    "mobile-agent",
    "android-simulator",
    "benchmark",
    "reinforcement-learning",
    "llm-agent"
  ],
  // ...
}
```

---

## 5. 敏感文件审计

### 5.1 检查清单

| 文件/目录 | 风险 | 处理方式 |
|-----------|------|---------|
| `.env` | 含 API Key | gitignore + filter-repo |
| `runs/` | benchmark 结果可能含内部数据 | 已在 gitignore ✓ |
| `paper/` | 论文草稿 | 已在 gitignore ✓ |
| `apps/RedBook/data/localcrawledData.ts` | 爬取数据 | 已在 gitignore ✓ |
| `public/imagedata/` | 图片数据 | 已在 gitignore ✓ |
| `*.apk` / `apks/` / `decompiled/` | APK 反编译文件 | 已在 gitignore ✓ |
| `all_dicts/` | 词典源数据 | 已在 gitignore ✓ |
| `apps/*/data/defaults.json` | 模拟用户数据 | 确保无真实个人信息 |
| `apps/*/assets/` | 应用资源 | 确保非直接提取自真实 APK |
| `public/sdcard/` | 模拟 SD 卡数据 | 检查是否含敏感文件 |

### 5.2 自动化检查脚本

```bash
#!/bin/bash
# scripts/audit-secrets.sh

echo "=== Checking for potential secrets ==="

# 检查所有 TS/TSX/JSON 文件中的硬编码 Key
rg -i '(api_key|apikey|secret|token|password|credential)' \
  --type ts --type json \
  --glob '!node_modules/**' \
  --glob '!package-lock.json' \
  -l

# 检查 .env 是否在 git 追踪中
git ls-files | grep -E '\.env$'

# 检查大文件（可能含数据集）
find . -name '*.json' -size +1M \
  ! -path './node_modules/*' \
  ! -path './dist/*' \
  ! -path './package-lock.json'
```

---

## 检查清单

- [ ] `.env` 加入 `.gitignore`
- [ ] 创建 `.env.example`
- [ ] 从 Git 历史清除 `.env`
- [ ] 轮换所有已泄露 API Key
- [ ] 为缺少 Key 的场景实现 fallback/mock
- [ ] 创建 `LICENSE` 文件（Apache 2.0）
- [ ] `package.json` 添加 license/name/description
- [ ] `README.md` 添加免责声明
- [ ] 审计 `apps/*/data/defaults.json` 无真实个人信息
- [ ] 审计 `apps/*/assets/` 无直接提取的 APK 资源
- [ ] 审计 `public/sdcard/` 无敏感文件
- [ ] API Gateway 默认拒绝未知主机
