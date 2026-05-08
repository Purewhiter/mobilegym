# 数据架构与资源问题

## 1. constants vs defaults 边界违规

### 1.1 静态服务目录放在 defaults.json [高]

**规范**: 服务/功能的静态属性（icon, color, label）是固定的，属于 `constants.ts`。

**违规 - Alipay**:

**位置**: `Alipay/data/defaults.json:506-767`

```json
"mainServices": [{ "id": "antInsure", "name": "蚂蚁保", "icon": "IcSecureCheck", "color": "#1677FF" }, ...],
"financeServices": [{ "id": "余额宝", "name": "余额宝", "icon": "IcPiggyBank", "color": "#00B96B" }, ...],
"commonServices": [...],
"myServicesGrid": [...],
"myCivicServices": [...],
"quickActions": [...]
```

这些是静态服务目录，不是用户可配置数据。

**正确做法**: 参考 Railway12306 将服务目录放在 `constants.ts`。

---

### 1.2 dataVersion 放在 defaults.json [中]

**规范**: `dataVersion`（bench_env 替换格式版本号）属于结构配置，应在 `constants.ts`。

**违规**:
- `Ebay/data/defaults.json:2` - `"dataVersion": 1`

**正确做法**: 参考 Alipay，`dataVersion` 在 `constants.ts`。

---

### 1.3 品牌主题色放在 defaults.json [中]

**位置**: `TencentMeeting/data/defaults.json:12-14`
```json
"theme": {
  "primary": "#006EFF",
  "bg": "#F5F6F7"
}
```

这是 app 级品牌色，不是用户设置，应在 `res/colors.ts` 或 `constants.ts`。

---

### 1.4 静态分类颜色放在 defaults.json [中]

**位置**: `Spotify/data/defaults.json:508-548`
```json
"searchDiscover": [{ "bg": "bg-[#1E3264]" }, { "bg": "bg-[#8F3C3C]" }, ...],
"searchCategories": [{ "bg": "bg-[#DC148C]" }, { "bg": "bg-[#006450]" }, ...]
```

这些是与固定内容绑定的静态视觉属性，应在 `constants.ts`。

---

### 1.5 用户内容放在 constants.ts（反向违规）[中]

**规范**: 用户数据（账号、内容）应在 `defaults.json`。

**违规**:

**位置**: `Bilibili/constants.ts:12-21`
```typescript
recommendedUp: [
  { id: '3546870846589023', name: '_闲来美式_' },
  { id: '946974', name: '影视飓风' },
],
```

这是具体用户账号数据，应在 `defaults.json`。

---

## 2. 图标命名违规（未用 Ic* 前缀）

### 2.1 Map defaults.json [高]

**位置**: `Map/data/defaults.json:27-30`
```json
{ "id": "home",        "icon": "home" },
{ "id": "restaurants", "icon": "utensils" },
{ "id": "takeout",     "icon": "coffee" },
{ "id": "gas",         "icon": "fuel" }
```

**应改为**: `"IcHome"`, `"IcUtensils"`, `"IcCoffee"`, `"IcFuel"`

---

### 2.2 TencentMeeting defaults.json [高]

**位置**: `TencentMeeting/data/defaults.json:205-210`
```json
{ "icon": "Home" },
{ "icon": "Video" },
{ "icon": "FileText" },
{ "icon": "Bot" },
{ "icon": "Monitor" }
```

**应改为**: `"IcHome"`, `"IcVideo"`, `"IcFileText"`, `"IcBot"`, `"IcMonitor"`

---

### 2.3 Ebay constants.ts [中]

**位置**: `Ebay/constants.ts:7-22`
```typescript
{ icon: 'camera' },
{ icon: 'tag' },
{ icon: 'shipping' }
```

**应改为**: `"IcCamera"`, `"IcTag"`, 等

---

### 2.4 Sms constants.ts [中]

**位置**: `Sms/constants.ts:4-15`
```typescript
{ id: 'emoji',   icon: 'ic_attach_smiley' },
{ id: 'card',    icon: 'ic_attach_contact' },
{ id: 'image',   icon: 'ic_attach_photo' },
```

使用自定义 `ic_attach_*` 系统，不符合 `Ic*` 规范。

---

### 2.5 Wechat defaults.json 图片路径作为 icon [低]

**位置**: `Wechat/data/defaults.json:696`
```json
{ "id": "pdd", "name": "拼多多", "icon": "avatars/avatar_10.jpg" }
```

`icon` 字段应为 `Ic*` 名称，图片应用 `image` 或 `logo` 字段。

---

## 3. 数据重复

### 3.1 Alipay 服务数据重复 [中]

**位置**: `Alipay/data/defaults.json`

`antInsure` 服务完全相同出现在两处：
- 第 508 行 `mainServices`
- 第 731 行 `myServicesGrid`

其他服务同样重复。

---

### 3.2 Spotify 曲目数据重复 [中]

**位置**: `Spotify/data/defaults.json`

`startListening`（第 6 行）和 `recommendedTracks`（第 29 行）包含相同曲目（t1/t2/t3: "搁浅", "修炼爱情", "有何不可"），相同 ID。

---

## 4. 类型安全问题

### 4.1 data/index.ts 大量 as any [高]

**X app** - 最严重:

**位置**: `X/data/index.ts:7-13`
```typescript
export const xUsers = (defaults as any).xUsers as Record<string, any>;
export const xPosts = (defaults as any).xPosts as any[];
export const quotedPosts = (defaults as any).quotedPosts as Record<string, any>;
export const initialTrends = (defaults as any).initialTrends as any[];
export const initialNotifications = (defaults as any).initialNotifications as any[];
export const initialConversations = (defaults as any).initialConversations as any[];
export const initialSearchHistory = (defaults as any).initialSearchHistory as any[];
```

类型接口存在于 `types.ts` 但未在 data 层使用。

**Weather app**:

**位置**: `Weather/data/index.ts:13-15`
```typescript
const defaultSavedCities = (defaults as any).defaultSavedCities as WeatherCityDefinition[];
const majorCities = (defaults as any).majorCities as WeatherCityDefinition[];
```

**TencentMeeting**:

**位置**: `TencentMeeting/data/index.ts:34`
```typescript
const raw = defaults as any;
```

---

### 4.2 ICON_REGISTRY 类型为 Record<string, any> [低]

**位置**: 所有 26 个 app 的 `res/icons.tsx`
```typescript
export const ICON_REGISTRY: Record<string, any> = { ... }
```

**应改为**: `Record<string, React.ComponentType<{ size?: number; ... }>>`

---

### 4.3 types.ts 中 any 字段 [低]

**Bilibili**:
- `types.ts:16` - `raw?: any;` (BilibiliVideo)
- `types.ts:39` - `raw?: any;` (RankingVideo)
- `types.ts:114` - `live_room: any;` (UserInfo)

**X**:
- `types.ts:72` - `meta?: any;` (XTrend)

---

### 4.4 state.ts 运行时 any cast [中]

**X state**:
- `state.ts:57,414,426,430,478` - `(p as any).replies` 等

**Wechat state**:
- `state.ts:258` - `auth: (WECHAT_CONFIG as any).auth ?? EMPTY_AUTH_STATE`

**Spotify state**:
- `state.ts:198-215` - `(pl as any).title`, `(pl as any).trackIds`

---

## 5. res/ 文件问题

### 5.1 空的 colors.ts 占位 [低]

**位置**: `Alipay/res/colors.ts`

所有 section 是注释，无实际颜色值。Alipay 有大量硬编码颜色在 `defaults.json` 中。

---

### 5.2 dimens.ts 正确使用示例

以下 app 正确使用 `dimens.ts`：
- Alipay - icon size
- Spotify - JS 像素计算布局
- Bilibili - app 特定像素尺寸

**注意**: JS 像素计算必须用 CSS var 或任意值像素，禁用 rem 类。

---

## 6. 缺失 data/ 目录的 App

以下 app 无 `data/` 目录（多为工具/系统 app，可接受）：
- Browser
- Calculator
- FileManager
- Gallery
- Settings
- ThemeStore

Calculator2 有 data/ 目录。
