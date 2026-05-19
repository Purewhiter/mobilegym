# bench_env 性能问题记录

## 背景

`python -m bench_env.run` 通过 Playwright 控制 Chromium 打开模拟器（`http://localhost:3000`），与直接在浏览器手动打开相比，加载明显更慢。本文档记录已确认的问题、已做的改动，以及尚未解决的现象。

---

## 已确认的问题与改动

### 1. `waitForData` 无论什么任务都加载全部 App 数据

**问题**
`os/OSContext.tsx` 中的 `waitForData()` 在每次 `reset()` 时无条件加载 RedBook（约 16 MB JSON）和 Bilibili（约 65 MB JSON）两份数据，即使当前任务只涉及其中一个 App。

**实测数据（`bench_env/diagnose_perf.py` 输出）**

| 场景 | waitForData 耗时 |
|------|----------------|
| 优化前（全量加载） | 1.13 s |
| 优化后（仅加载 redbook） | 0.32 s |

优化后 Bilibili 相关的大文件请求完全消失。

**改动文件**

- `os/OSContext.tsx`：`waitForData` 增加可选参数 `appIds?: string[]`，只加载指定 App 的数据；不传则保持原来的全量行为。

- `bench_env/env/mobile_gym.py`：`_wait_ready()` 和 `reset()` 增加 `app_ids: list[str] | None` 参数，传给 JS 侧的 `waitForData`。

- `bench_env/task/base.py`：`setup()` 从任务的 `app` 字段提取 App ID，调用 `env.reset(app_ids=[app_id])`，跳过无关 App 的预加载。

---

### 2. 路由拦截范围过宽

**问题**
原来的路由拦截用 `**/*` 匹配所有请求，包括：
- Vite dev server 的每一个 JS/CSS/资源文件（Vite 开发模式下有几百个独立请求）
- 所有外部 CDN 请求（xhscdn.com 图片、hdslb.com 资源等）

每个被拦截的请求都需要经过 Python 侧的 `route.fetch()` + `route.fulfill()` 往返，增加额外的 CDP 通信开销。

**拦截的实际用途**
移除响应头中的 `X-Frame-Options` 和 `Content-Security-Policy: frame-ancestors`，目的有两个：
1. 让整个模拟器可被嵌入外部 iframe（如 bench_env 的父页面）
2. 让模拟器内 Browser App 的 `<iframe>` 能正常加载外部网站（Google、Baidu、GitHub 等）

外部 CDN（xhscdn.com、hdslb.com 等）不需要移除这些头，不拦截不影响功能。

**改动文件**

- `bench_env/env/mobile_gym.py`：`setup_context_routes()` 改为只拦截两类请求：
  1. `{env_url}/**`（即 `http://localhost:3000/**`）
  2. `BROWSER_IFRAME_PATTERNS`：Browser App 常用外部网站的域名列表（与 `BrowserApp.tsx` 的书签保持同步）

  其余第三方请求（CDN 图片、地图瓦片等）直接放行，不经过 Python 处理。

---

### 3. 新增性能诊断脚本

**文件**：`bench_env/diagnose_perf.py`

逐阶段测量加载耗时：

1. Playwright context 创建
2. `domcontentloaded`
3. `window.__SIM__` 就绪
4. `waitForData` 完成
5. 指定 App 打开
6. 首张图片加载完成

同时输出 Performance API 统计（各类型资源请求数量、平均耗时、最慢的 10 个请求）。

**用法**：
```bash
python -m bench_env.diagnose_perf --env-url http://localhost:3000 --app redbook
```

**注意**：Playwright Python 的 `page.evaluate()` 不支持 `timeout` 关键字参数（`wait_for_function()` 才支持）。

---

## 已观察到但尚未找到根因的现象

### 从 App 返回桌面时图标出现卡顿

**现象**：在 Playwright 中从 App 按 Home 键返回桌面时，桌面图标会有短暂抖动/卡顿，在真实浏览器中打开同样的页面没有此现象。

**已知事实**：
- 两个环境运行的是完全相同的代码
- 此现象只在 Playwright 中复现，真实浏览器中不复现
- 尚未用 profiler 或 trace 工具测量具体卡在哪一步

**尚未诊断**，需要实测数据再做结论。

---

## 尚未处理的已知开销

### `_reset_sim` 中等待 `networkidle`

`bench_env/env/mobile_gym.py` 的 `_reset_sim()` 在调用 `__SIM__.reset()` 后会依次等待 `domcontentloaded` 和 `networkidle`。

`networkidle` 的语义是"所有网络连接静止超过 500 ms"，包括仍在下载的外部 CDN 图片。这一等待实际耗时未经测量，尚不清楚是否是当前的主要瓶颈。
