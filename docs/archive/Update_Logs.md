# Update Logs

## 2026-02-26

### 修复 Railway12306 车票查询失败（返回 HTML 而非 JSON）

#### 问题现象

12306 车票查询始终失败，控制台报 `trainService.ts:96 [trainService] API 查询失败，fallback 到 mock: 12306 请求频率受限`。Network 面板可见请求走 `/api/gw/proxy?url=https://kyfw.12306.cn/...`，响应为 HTML 错误页而非 JSON。

#### 根本原因

commit `59bf0a0f`（"优化X和网络服务"）修改了 `os/NetworkService.ts`，将所有 GET 请求从 `gatewayFetch`（POST `/api/gw/fetch`）改为 `gatewayProxy`（GET `/api/gw/proxy`）。

两条路径的关键区别：

| | `gatewayFetch`（旧） | `gatewayProxy`（新） |
|---|---|---|
| 浏览器请求 | POST JSON，headers 打包在 body 中 | GET，headers 作为 HTTP 请求头 |
| 上游收到的 headers | **仅** app 显式指定的（如 `User-Agent`、`Accept`） | app headers **+** 浏览器自动附加的（`sec-ch-ua`、`sec-ch-ua-mobile`、`sec-ch-ua-platform`、`priority` 等） |

12306 的反爬机制检测到浏览器指纹 headers（如 `sec-ch-ua` 版本与 `User-Agent` 中的 Chrome/120 不匹配），判定为异常请求，返回 HTML 错误页。

#### 为什么之前没发现

该改动与 X app 媒体加载优化在同一个 commit 中，但实际上 X 的图片/视频通过 `<img src="/api/gw/proxy?url=...">` 直接构造 proxy URL，**不经过 `netFetch`**。整个项目中只有 Railway12306 和 Weather 使用 `netFetch` 做外部 GET 请求，所以这个路由变更实际上没有任何调用方需要。

#### 修复

还原 `os/NetworkService.ts` 中 GET 请求的路由逻辑，移除 GET/HEAD → `gatewayProxy` 的分支，所有请求默认走 `gatewayFetch`：

```ts
// 移除了这段：
// const method = (init.method || 'GET').toUpperCase();
// if ((method === 'GET' || method === 'HEAD') && (bodyAny == null)) {
//   return gatewayProxy(url, init);
// }
```

#### 验证

- 12306 车票查询恢复正常，返回 JSON
- X app 媒体加载不受影响（不走 `netFetch`）
- Browser app 不受影响（用 `<iframe>`，不走 `netFetch`）

---

## 2026-02-22

### 优化 tailwindCliPlugin：Windows 兼容、故障恢复、watch 修复

#### 改动

**1. 修复 Windows 兼容性**

- `execSync` → `execFileSync`，避免手动 `JSON.stringify` 拼接路径在 Windows 反斜杠下出现转义问题
- `spawn()` 和 `execFileSync()` 均添加 `shell: isWin`，使 Windows 上能正确执行 `.cmd` 批处理文件（`node_modules/.bin/tailwindcss.cmd`）

**2. 修复 `--watch` 反复退出问题**

- **根本原因**：Tailwind CLI v4 的 `--watch` 默认在 stdin 关闭后会完成一次编译就退出（exit code 0）。而 `spawn()` 的 `stdio: ['ignore', ...]` 会立即关闭 stdin
- **修复**：`--watch` → `--watch=always`，使其在 stdin 关闭后仍持续监听文件变化
- 这也是之前"改了代码颜色不生效"的另一个成因——watch 可能已经退出了但无人知晓

**3. watch 进程故障检测与自动恢复**

- 添加 `child.on('exit', ...)` 和 `child.on('error', ...)` 监听
- 异常退出时自动重启，使用指数退避（1s → 2s → 4s → ... → 10s 上限）
- 连续快速崩溃超过 5 次后放弃重启，打印红色错误提示

**4. CSS HMR 尝试与回退**

- 曾尝试将 `index.css` 从 HTML `<link>` 改为 JS `import`，让 Vite 做 CSS HMR
- 但 `index.css` 同时是 Tailwind CLI 的输出文件和 Vite 的监听输入，两个 watcher 互相踩踏导致循环触发
- 已回退为 `<link>` 标签引入，保持稳定性

#### 文件变更

| 文件 | 改动 |
|------|------|
| `vite.config.ts` | 重写 `tailwindCliPlugin()`：`execFileSync` + `shell:isWin` + `--watch=always` + 故障恢复 |
| `apps/Railway12306/tailwind.config.ts` | 删除（Tailwind v4 不使用此文件） |

---

### Tailwind 自定义颜色类名不生效的排查与解决

#### 问题现象

在 Railway12306 应用中使用 Tailwind 任意值类名（如 `bg-[#418CF6]`、`from-[#418CF6]`）时，页面上的颜色和渐变背景未正确渲染。

#### 根本原因

本项目使用 **Tailwind CSS v4 + Tailwind CLI（Rust 原生版本）**，CSS 编译流程如下：

1. `vite.config.ts` 中的 `tailwindCliPlugin()` 在 dev server 启动时执行 `tailwindcss -i app.css -o index.css`
2. 然后在后台以 `--watch` 模式持续监听文件变化，增量编译
3. `index.css`（318KB+）是**编译产出物**，不是手写文件

问题的直接原因是**多个 `npm run dev` 进程同时运行**，导致：
- 3000 端口被占用，后续启动的 dev server 端口异常
- `tailwindcss --watch` 子进程卡死或异常退出
- 新增的 Tailwind 类名无法被编译写入 `index.css`，页面看不到效果

#### 排查过程中的误区

| 尝试 | 结果 |
|------|------|
| 创建 `apps/Railway12306/tailwind.config.ts` | **无效** — Tailwind v4 不使用 `tailwind.config.ts`，配置通过 `app.css` 中的 `@theme`/`@source` 指令完成 |
| 改用内联 `style={{ backgroundColor: '#418CF6' }}` | **有效但非必要** — 绕过了 Tailwind，但失去了工具链一致性 |

#### 正确解决方式

1. **杀掉所有卡死的 Node 进程**，确保只有一个 dev server 运行
2. **重启 `npm run dev`**，`tailwindcss --watch` 恢复正常后新类名自动编译
3. **已删除**无用的 `apps/Railway12306/tailwind.config.ts`

#### 注意事项（Tailwind v4 任意值语法）

- `bg-[#418CF6]` 等任意值语法在 Tailwind v4 中**完全支持**，前提是类名以**完整字面量**出现在被 `@source` 覆盖的文件中
- 以下写法**不会被检测到**：
  ```tsx
  const color = '#418CF6';
  className={`bg-[${color}]`}  // ✗ 动态拼接，编译器看不到完整类名
  ```
- `app.css` 中的 `@source not` 规则会排除部分目录（`res/`、`hooks/`、`data/`、`*.declaration.ts`），如果类名出现在这些文件中也不会被编译

---

## 2026-02-21

### 修复 GPU 合成层黑边 + `no-scrollbar` 背景色覆盖问题

#### 问题背景

`backdrop-blur` 在多个 App 中被大量使用（全项目 95 处），Chrome 会因此将祖先滚动容器提升为 GPU 合成层。GPU 合成层默认背景透明，透过去是 SystemShell 的 `bg-black`，在容器右边缘产生 1-2px 黑色细线（黑边）。

之前的修复尝试是在 `index.css` 中给 `.no-scrollbar` 加了 `background-color: inherit`，但 `.no-scrollbar` 是 unlayered CSS，优先级高于 Tailwind 的 `@layer utilities`，导致所有显式设置了 `bg-[#xxx]`、`bg-gray-50` 等颜色的滚动容器背景被覆盖为白色（继承自 Layout 父元素），造成页面显示异常。

#### 根本修复

**`os/SystemShell.tsx`**：给 app container 加 `bg-white`。

```tsx
// 修改前
className="absolute inset-0 select-text"

// 修改后
className="absolute inset-0 select-text bg-white"
```

原理：GPU 合成层透明时，透过去看到的是 app container 的白色，而非 SystemShell 的黑色。白边对白色/浅色内容完全不可见，对深色内容（如小红书我页）已有 inline style 覆盖。

**`index.css`**：删除 `.no-scrollbar` 中的 `background-color: inherit`，保留 `width: 0; height: 0`（防止部分 Chrome 版本保留 scrollbar gutter）。

#### 同步修复：硬编码颜色 → CSS 变量

以下页面的滚动容器存在硬编码 hex 颜色，已迁移为 CSS 变量（inline style 形式，优先级最高，不受 unlayered 规则影响）：

| 文件 | 原来 | 现在 |
|------|------|------|
| `apps/RedBook/pages/MePage.tsx` | `bg-[#1a1a1a]` | `style={{ backgroundColor: 'var(--app-c-me-page-bg)' }}` |
| `apps/Sms/components/SettingsPlaceholderPage.tsx` | `bg-[#F5F5F5]` | `style={{ backgroundColor: 'var(--app-c-page-background)' }}` |
| `apps/Wechat/pages/chat/ChatSearch.tsx` | `bg-[#f0f0f0]` | `style={{ backgroundColor: 'var(--app-c-search-bar-bg)' }}` |

#### 规则（今后遵守）

- `overflow-y-auto no-scrollbar` 的容器，直接写正确的背景色 class（`bg-white`、`bg-gray-50`、`bg-slate-100` 等），无需任何特殊处理。
- 自定义 hex 颜色必须先在 `res/colors.ts` 定义，通过 CSS 变量引用，不允许直接写 `bg-[#xxx]`。
- 深色主题页面（`#1a1a1a` 等）使用 `style={{ backgroundColor: 'var(--app-c-xxx)' }}` inline style，语义更清晰且不受 CSS 层叠干扰。
