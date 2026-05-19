# 模拟器「拖入安装 App」实现分析

## 1. 目标

在 Web 模拟器内实现「安装 App」的完整流程：

- 用户将「App 安装包」拖入模拟器（或通过文件选择）
- 模拟器解析安装包并在内部完成安装
- 安装后的 App 出现在桌面，可像内置 App 一样启动、多任务、关闭
- 「安装包」来源于当前项目 `apps/` 下的 App 目录（如 Wechat、Clock）经过**打包**后的产物

---

## 2. 约束与结论

### 2.1 为什么不能直接拖「源码目录」

- 当前每个 App 是 **React 组件**，写在 `apps/<AppName>/` 下（TS/TSX、config、多文件）。
- 浏览器**无法**在运行时编译 TypeScript/TSX，也没有内置 Vite/Webpack。若用户拖入的是 `Wechat/` 源码目录，模拟器无法直接执行。
- 因此：**必须采用「预构建」的安装包**，即先把 App 打成可在浏览器里直接加载的 JS 产物（单 bundle），再在运行时加载并注册。

### 2.2 可行方案结论

| 环节         | 做法 |
|--------------|------|
| 安装包形态   | 预构建的 **.mgapp**（实质为 zip），内含 `manifest.json` + `app.js`（UMD/IIFE 单 bundle） |
| 打包来源     | 对 `apps/` 下某个 App 目录执行构建脚本，产出该 zip |
| 运行时安装   | 用户拖入 .mgapp → 解压 → 加载 app.js（script 或 blob URL）→ 从全局拿到组件并注册 → 写入「已安装列表」并持久化 |
| 桌面与启动   | 已安装列表与内置 `APP_REGISTRY` 合并展示；启动/多任务/关闭与现有逻辑统一，仅扩展为支持「动态 appId」 |

---

## 3. 安装包格式设计

### 3.1 目录结构（zip 内）

```
wechat.mgapp (zip)
├── manifest.json    # 元数据，见下
├── app.js           # 单文件 UMD/IIFE bundle，挂载组件到约定全局
└── (可选) icon.png   # 自定义图标
```

### 3.2 manifest.json 示例

```json
{
  "id": "wechat_custom",
  "packageName": "com.tencent.mm.custom",
  "displayName": "微信",
  "version": "1.0.0",
  "versionCode": 1,
  "type": "plugin",
  "iconBackground": "#07c160",
  "iconForeground": "#ffffff",
  "theme": {
    "colors": {
      "primary": "#07c160",
      "background": "#ededed",
      "textPrimary": "#111111",
      "textSecondary": "#666666",
      "statusBarForeground": "dark"
    }
  }
}
```

- `id`：唯一 appId，建议带后缀避免与内置冲突（如 `wechat_custom`），或约定安装包一律用独立 id。
- `displayName`、`type`、`iconBackground`、`iconForeground`、`theme`：与内置 `AppManifest`（`os/types/manifest.ts`）对齐。
- 图标：提供包内 `icon.png`，运行时解析为 data URL 或 blob URL。

### 3.3 app.js 约定

- 构建时把该 App 的根组件打成 **UMD 或 IIFE**，在 bundle 末尾执行：

  ```js
  window.__MOBILE_GYM_INSTALLED_APP__ = { default: WechatAppComponent };
  ```

- 模拟器在 script 加载完成后读取 `window.__MOBILE_GYM_INSTALLED_APP__.default`，即得到 React 根组件，用于注册到「已安装 App 注册表」并参与 `renderAppContent(appId)`。

---

## 4. 构建流水线（从 apps/ 到 .mgapp）

### 4.1 思路

- 使用 **Vite** 的 library 模式，以目标 App 的入口组件为 entry（如 `apps/Wechat/WechatApp.tsx`），打出单文件 `app.js`（format: UMD 或 IIFE，global 名可固定或按 appId）。
- 构建脚本（如 `scripts/package_app.mjs`）：
  1. 接收参数：App 名或路径（如 `Wechat`）。
  2. 读取该 App 的元数据（可从现有 `APP_REGISTRY` 或该 App 下的 `data/*Config.ts` / 单独 `manifest.json` 推导），生成安装包用的 `manifest.json`。
  3. 调用 Vite 构建该 App 的 bundle，输出到临时目录（如 `dist-apps/wechat/app.js`）。
  4. 将 `manifest.json` + `app.js`（+ 可选 `icon.png`）打成 zip，输出为 `wechat.mgapp`（或 `Wechat.mgapp`）。

### 4.2 技术要点

- **依赖与外部化**：App 组件会依赖 React、OS 的 context、`__OS__`、`__SIM__` 等。构建时需把 React、ReactDOM 以及部分 OS 能力设为 external，在运行时使用宿主页面已加载的 React 和全局 API，否则 bundle 会巨大且可能重复挂载 React。
- **样式**：若 App 使用 CSS/PostCSS/Tailwind，需决定是内联进 JS 还是单独 chunk；若单独 chunk，安装包需多一个 `app.css`，运行时用 `<link>` 或 `<style>` 注入。
- **多 App 共享类型**：`AppManifest`、`AppId` 等类型在构建时由 monorepo 共享即可；运行时 manifest 仅为 JSON，无需类型。

### 4.3 产物与使用方式

- 开发者在本机执行：`node scripts/package_app.mjs Wechat` → 得到 `Wechat.mgapp`。
- 将 `Wechat.mgapp` 拖入模拟器或通过「安装 App」入口选择文件，即可完成安装。

---

## 5. 运行时安装流程

### 5.1 入口

- **拖拽**：在桌面或设置页提供 drop zone，接受 `.mgapp` 或 `.zip`。
- **文件选择**：提供「安装 App」按钮，调起 `<input type="file" accept=".mgapp,.zip">`。

### 5.2 步骤（概要）

1. **校验**：检查为 zip 格式，且存在 `manifest.json`、`app.js`。
2. **解压**：用 JSZip（或类似）在内存中解压，得到 `manifest.json` 文本与 `app.js` 二进制。
3. **解析 manifest**：`JSON.parse(manifest.json)`，校验 `id`、`name`、`type` 等；若 `id` 与内置或已安装冲突，可拒绝或自动改 id（如加后缀）。
4. **加载 bundle**：
   - 将 `app.js` 转为 Blob → `URL.createObjectURL(blob)` 得到 blob URL；
   - 动态插入 `<script src={blobUrl}>`，等待 onload；
   - 在 onload 中读取 `window.__MOBILE_GYM_INSTALLED_APP__?.default`，即 React 组件。
5. **注册**：将 `(manifest, component)` 写入「已安装 App 注册表」（内存结构 + 持久化，见下）。
6. **持久化**：
   - 方案 A：把安装包 zip 的 ArrayBuffer 存 IndexedDB（key = appId），下次页面加载时从 IndexedDB 取出 zip，再执行 2–5，恢复已安装列表。
   - 方案 B：只把 manifest + app.js 的 blob 存 IndexedDB，不存整个 zip。
   - 任一方案都需一份「已安装 appId 列表」（可放在 manifest 列表里），便于启动时按序恢复。
7. **更新 UI**：触发桌面/启动器重新取「合并后的 App 列表」，新 App 立即显示在桌面。

### 5.3 安全与健壮性

- 仅接受项目自己构建的 .mgapp（格式受控）；不执行任意 JS，仅执行约定格式的 bundle。
- script 加载失败或未暴露 `__MOBILE_GYM_INSTALLED_APP__` 时，提示安装失败并清理 blob URL。
- 可对 manifest 的 `id` 做白名单格式（如只允许 `[a-z0-9_]+`），避免注入。

---

## 6. 需要改动的模块与类型

### 6.1 新增模块

| 模块 | 职责 |
|------|------|
| **InstalledAppRegistry** | 内存中维护 `Map<appId, { manifest, component }>`；提供 `register(manifest, component)`、`unregister(appId)`、`getList()`、`getComponent(appId)`；与持久化层（IndexedDB）对接，在页面 load 时从 IndexedDB 恢复已安装列表并重新加载对应 script/blob。 |
| **InstallDropZone**（或集成到设置页） | 拖拽/文件选择 UI；调用 InstalledAppRegistry + 安装流程（解压 → 加载 → 注册 → 持久化）。 |

### 6.2 修改现有模块

| 模块 | 改动要点 |
|------|----------|
| **os/data/appRegistry.tsx** | 提供「合并列表」：`getMergedAppList() = APP_REGISTRY + InstalledAppRegistry.getList()`；`getAppManifest(appId)`、`hasAppComponent(appId)`、`renderAppContent(appId)` 在未命中内置时，改为查 InstalledAppRegistry；`isValidAppId(id)` 需同时认可已安装的 appId。 |
| **os/types.ts** | `AppId` 当前为字面量联合类型；需支持「已安装」的动态 id：可新增 `LaunchableAppId = AppId \| string`，在 `launchApp`、`state.runningApps`、`renderAppContent` 等处使用；或保持 `AppId` 为内置集合，另用 `string` 表示已安装 id，在需要处做联合。 |
| **os/OSContext.tsx** | `launchApp`、`closeApp` 等已用 `AppId`；改为接受 `LaunchableAppId`（或 string），并依赖 appRegistry 的 `isValidAppId` 扩展实现。`__SIM__.getState()` 中的 `installedApps` 应改为基于 `getMergedAppList()`，以便评测/自动化看到已安装 App。 |
| **os/SystemShell.tsx** | Launcher 的 App 列表改为使用 `getMergedAppList()` 再按 `type` 过滤；Recents 的 `getAppManifest(appId)` 已通过 appRegistry，只要 appRegistry 支持动态 manifest 即可。 |

### 6.3 类型与兼容性

- 内置 App 的 `AppId` 保持字面量，利于静态检查和补全。
- 已安装 App 的 id 为 string，且不与内置 id 冲突（通过打包时命名或安装时校验保证）。
- `AppManifest` 的 `id` 在类型上若仍为 `AppId`，则已安装 manifest 需用类型断言或扩展为 `AppId | string`；实现上以「合并列表」统一返回 `{ id: string, name: string, ... }` 即可。

---

## 7. 可选扩展

- **卸载**：在设置页或长按桌面图标提供「卸载」；从 InstalledAppRegistry 与 IndexedDB 中删除该 appId，并关闭正在运行的该 App（若在 `runningApps` 中）。
- **更新**：再次安装同 id 的 .mgapp 时，先卸载再安装，或覆盖 IndexedDB 中该 id 的包并重新加载 script。
- **图标**：manifest 提供 `icon.png`（包内），桌面渲染时解析为 data URL 或 blob URL。
- **权限/沙箱**：若未来需要，可在 manifest 中声明 `permissions`，在 App 内或 OS 层做简单鉴权（当前项目已有部分 permissions 字段可复用）。

---

## 8. 总结

| 问题 | 结论 |
|------|------|
| 能否拖「apps 下的目录」直接安装？ | 不能；必须拖**预构建的 .mgapp**（zip：manifest + app.js）。 |
| 如何得到 .mgapp？ | 通过构建脚本（如 `scripts/package_app.mjs`）对 `apps/<Name>` 用 Vite 打单 bundle，再与 manifest 一起打成 zip。 |
| 运行时在做什么？ | 解压 zip → 加载 app.js（script 或 blob URL）→ 读取全局挂载的 React 组件 → 注册到 InstalledAppRegistry → 持久化到 IndexedDB → 合并进桌面列表。 |
| 主要改动点 | InstalledAppRegistry（含持久化）、安装入口 UI、appRegistry 的合并与解析逻辑、AppId/LaunchableAppId 类型扩展、Launcher/OSContext 使用合并列表与扩展 id。 |

按上述分析即可在「不写源码」的前提下评估工作量与风险；实现时建议先做「构建一条 App → .mgapp」和「运行时加载并注册一个已安装 App」，再补持久化与桌面合并。
