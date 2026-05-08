# 其他问题

## 1. localStorage 使用不规范

### 1.1 ~~跨 App 共享 key~~ [已修复]

~~**Wechat + Alipay 共享 key `shared_subscriptions_v1`**~~

已修复：删除 `subscriptionStore.ts`，将微信订阅合并到主 store（`useWechatStore`）；删除支付宝中对共享 key 的读写。

---

### 1.2 Weather 三重持久化 [高]

**位置**:
- `Weather/state.ts` - `createAppStore('weather', ...)`
- `Weather/utils/weatherStore.ts:166-193` - 直接读写 `'weather'` key
- `Weather/utils/cityManagerStore.ts:35-62` - 读写 `'weather_city_manager_state_v1'`

三个路径同时存在，存在数据一致性风险。

---

### 1.3 废弃代码 cityManagerStore.ts [中]

**位置**: `Weather/utils/cityManagerStore.ts`

无任何文件导入此模块（已用 grep 确认），但其 `saveCityManagerState` 仍写 localStorage。

**建议**: 删除此文件。

---

### 1.4 其他直接 localStorage 访问 [低]

- `Railway12306/services/stationService.ts:42-57` - key `'railway12306:stations'`
- `Gallery/state.ts:8` - 迁移读取 `'gallery_favorites'`
- `Contacts/state.ts:56` - 迁移读取 `'phone_settings'`

迁移读取可接受，但 Railway12306 应统一到 state.ts。

---

## 2. 网络请求绕过 NetworkService

### 2.1 Spotify 直接 fetch [中]

**规范**: 使用 `NetworkService` (`netFetch`/`netJson`) 避免 CORS 并确保网络模拟。

**违规**:
- `Spotify/pages/PlaylistPage.tsx:64` - `fetch('https://itunes.apple.com/lookup?...')`
- `Spotify/pages/LibraryPage.tsx:33,80` - fetch iTunes search API
- `Spotify/pages/ArtistPage.tsx:40`
- `Spotify/pages/ChooseArtistsPage.tsx:33`

---

## 3. XSS 风险

### 3.1 dangerouslySetInnerHTML 使用 [中]

**Bilibili**:
- `SearchPage.tsx:142,221,358,397` - 注入 `highlightedTitle`/`highlightedName` HTML

**Map**:
- `ExplorePage.tsx:2255,2842` - 注入 Google Maps 路线步骤指令 HTML

**建议**: 对外部数据进行 sanitize 或使用安全的高亮方案。

---

## 4. 不确定性问题（影响 Benchmark）

### 4.1 Math.random() 生成座位号 [中]

**位置**: `Railway12306/pages/PaymentPlatformPage.tsx:9-15`

购票时座位号通过 `Math.random()` 生成，benchmark 状态判定无法预测最终状态。

**建议**: 使用确定性算法或可配置种子。

---

### 4.2 Date.now() 而非 TimeService [低]

**Clock**:
- `ClockApp.tsx:1104,1111,1117,1216,1230,1236,1243,1398,1479`

秒表/计时器用 `Date.now()` 测量经过时间（可接受），但闹钟 ID 生成 `id: \`a-${Date.now()}\`` 应用 `TimeService.now()`。

**Bilibili**:
- `VideoDetailPage.tsx:277,283` - 视频播放位置追踪

**Wechat/Alipay Subscriptions**:
- ~~作为 fallback 使用 `Date.now()`~~ 已随 subscriptionStore 删除修复

---

## 5. 全局样式污染

### 5.1 注入 <style> 隐藏滚动条 [中]

**位置**:
- `Calendar/CalendarApp.tsx:59-62`
- `Browser/BrowserApp.tsx:331-337`
- `Gallery/GalleryApp.tsx:1353`

```css
::-webkit-scrollbar { display: none; }
* { -ms-overflow-style: none; scrollbar-width: none; }
```

这是全局覆盖，影响同时挂载（`display:none`）的其他 app。

**建议**: 使用 scoped 样式或 CSS module。

---

## 6. API Key 占位符

### 6.1 Google Maps API Key [低]

**位置**: `Map/MapApp.tsx:113`
```typescript
const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY_HERE';
```

若环境变量未设置，传入字符串 `'YOUR_API_KEY_HERE'` 导致静默失败。

**建议**: 若无 key 时显示明确错误。

---

## 7. 占位实现

### 7.1 Spotify console.log 按钮 [低]

**位置**:
- `LoginLandingPage.tsx:46` - `onClick={() => console.log('Login clicked')}`
- `SignupPage.tsx:57` - `console.log('Google signup')`
- `CreateNamePage.tsx:123` - `console.log('Create Account', ...)`
- `CreateGenderPage.tsx:56` - `console.log('Gender selected:', ...)`

这些是可交互但无效果的按钮，agent 可能会点击。

**建议**: 移除 `data-trigger` 或实现功能。

---

## 8. 导入路径风格不一致

### 8.1 深层相对路径 vs @/ 别名 [低]

**Wechat**:
- `pages/chat/ChatDetail.tsx:11-12` - `'../../../../os/keyboard'`
- `pages/me/general/Address.tsx:8` - `'../../../../../os/TimeService'`

同一 app 其他文件使用 `@/os/useAppStrings`。

**建议**: 统一使用 `@/` 别名。

---

## 9. 直接访问 window.__OS__

### 9.1 App 页面直接访问 OS API [低]

**位置**:
- `Railway12306/pages/PaymentPlatformPage.tsx:36`
- `Alipay/pages/CashierPage.tsx:21`
- `Settings/components/PreferenceScreen.tsx:335`
- `Settings/components/SettingsMainPage.tsx:141`
- `Settings/components/StorageDashboardPage.tsx:32`

**建议**: 通过 ActivityContext 或 OS service 层访问。

---

## 10. 缺失 types.ts

以下 app 无 `types.ts` 文件：
- Browser
- Calculator
- ThemeStore

Reddit 类型定义在 `data/index.ts` 而非独立 `types.ts`。
