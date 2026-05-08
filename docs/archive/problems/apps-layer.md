# Apps 层问题

## 1. 缺失导航基础设施

### 1.1 完全缺失导航系统的应用 [高]

以下 8 个 app 无法纳入 benchmark 任务生成：

| App | navigation.declaration.ts | navigation.ts | state.ts | pages/ | hooks/ |
|-----|---------------------------|---------------|----------|--------|--------|
| Browser | ❌ | ❌ | ✅ | ❌ | ❌ |
| Calculator | ❌ | ❌ | ❌ | ❌ | ❌ |
| Calendar | ❌ | ❌ | ✅ | ✅ | ❌ |
| Clock | ❌ | ❌ | ✅ | ❌ | ❌ |
| Gallery | ❌ | ❌ | ✅ | ❌ | ❌ |
| Notes | ❌ | ❌ | ✅ | ✅ | ❌ |
| Sms | ❌ | ❌ | ✅ | ❌* | ❌ |
| ThemeStore | ❌ | ❌ | ❌ | ❌ | ❌ |

*Sms 的 pages 放在 components/ 目录

**详细情况**:

- **Browser** (`apps/Browser/BrowserApp.tsx`): 365 行单文件
- **Calculator** (`apps/Calculator/CalculatorApp.tsx`): 仅 3 文件，172 行 App
- **Calendar**: 有 9 个 pages 但全用 `useNavigate()` 直接调用
- **Clock** (`apps/Clock/ClockApp.tsx`): 1716 行单文件，包含 12+ 组件
- **Gallery** (`apps/Gallery/GalleryApp.tsx`): 1372 行单文件
- **Notes**: 7 个 pages 全用 `useNavigate()` 直接调用
- **Sms**: pages 在 components/ 目录，命名违规
- **ThemeStore**: 最简陋，几乎无任何核心文件

---

### 1.2 零 Agent 可观测性 [高]

以下应用全代码无 `data-trigger`、`data-action`、`bindTap`、`bindBack`：

- Calendar
- Notes
- Sms
- Browser
- Clock
- Gallery
- ThemeStore
- Calculator

**影响**: Agent 无法观测或触发任何导航事件，这些 app 无法用于自动化测试。

---

## 2. 命名规范问题

### 2.1 App 入口文件命名不一致 [低]

| App | 目录 | 入口文件 | manifest.id |
|-----|------|----------|-------------|
| TencentMeeting | TencentMeeting | **MeetingApp.tsx** | tencent_meeting |

其他 app 均遵循 `<DirName>App.tsx` 规范。

---

### 2.2 manifest.id 命名风格不一致 [低]

- 单词小写: `wechat`, `calendar`, `clock`
- 下划线分隔: `file_manager`, `tencent_meeting`, `wechat_reading`, `theme_store`, `railway12306`

---

### 2.3 Sms pages 放在 components/ [中]

**位置**: `apps/Sms/components/`

包含 `ConversationListPage.tsx`, `NewMessagePage.tsx`, `SettingsPage.tsx` 等实际页面文件。

**规范**: pages 应在 `pages/` 目录。

---

## 3. 导航模式违规

### 3.1 业务页面直接用 useNavigate() [中]

规范要求业务页面只用 app 的 `go()`/`back()`。

**Calendar** - 全部 10 处违规:
- `pages/CalendarHomePage.tsx:30`
- `pages/CalendarSettingsPage.tsx:58`
- `pages/CalendarNewEventPage.tsx:16`
- `pages/CalendarEventDetailPage.tsx:25`
- `pages/CalendarSearchPage.tsx:24`
- `pages/CalendarDateJumpPage.tsx:16`
- `pages/CalendarDateCalculatePage.tsx:16`
- `pages/CalendarSubscriptionPage.tsx:20`
- `pages/CalendarDeskThemePage.tsx:10`
- `components/CalendarHeader.tsx:9`

**Notes** - 全部 8 处违规:
- `pages/NotesListPage.tsx:194`
- `pages/NoteEditorPage.tsx:51`
- `pages/TodoListPage.tsx:123`
- `pages/PrivateNotesPage.tsx:69`
- `pages/FoldersPage.tsx:74`
- `pages/TrashPage.tsx:63`
- `pages/SettingsPage.tsx:18`
- `components/BottomTabBar.tsx:12`

**Sms** - 全部 9 处违规:
- `components/ConversationListPage.tsx:34`
- `components/ConversationDetailPage.tsx:55`
- `components/NewMessagePage.tsx:14`
- `components/SettingsPage.tsx:14`
- `components/SettingsItem.tsx:37`
- `components/SettingsPlaceholderPage.tsx:9`
- `components/FiveGMessagePage.tsx:14`
- `components/FreeNetworkSmsPage.tsx:14`
- `components/AdvancedSettingsPage.tsx:14`

**Weather** - 全部 6 处违规:
- `pages/WeatherCityManagerPage.tsx:144`
- `pages/WeatherCitySearchPage.tsx:34`
- `pages/WeatherCityPreviewPage.tsx:95`
- `pages/WeatherSettingsPage.tsx:11`
- `pages/WeatherPermissionsPage.tsx:10`
- `pages/WeatherPrivacySettingsPage.tsx:10`

**Gallery** - 6 处违规:
- `GalleryApp.tsx:282,443,620,878,935,1066`

---

### 3.2 NavigationHandler 用 navigate(-1) 而非 back() [中]

**位置**:
- `Browser/BrowserApp.tsx:37,274`
- `Calculator/CalculatorApp.tsx:37`
- `ThemeStore/ThemeStoreApp.tsx:50`
- `Clock/ClockApp.tsx:1459`

---

### 3.3 业务页面访问 Router 内部 API [低]

- `Bilibili/pages/VideoDetailPage.tsx:178` - 直接读 `window.history.state`
- `Weather/pages/WeatherCityPreviewPage.tsx:99` - 访问 `UNSAFE_NavigationContext`

---

## 4. 代码重复问题

### 4.1 navigation.ts 逻辑重复 [高]

15 个 app 共 3170 行近乎相同代码，包含：
- `matchFrom`
- `buildSearchParams`
- `replaceParams`
- `matchRoute`
- `chooseCase`
- `evalCondition`
- `resolveValue`

**受影响 app**: Alipay, Bilibili, Calculator2, Compass, Contacts, Ebay, FileManager, Map, Railway12306, RedBook, Reddit, Spotify, TencentMeeting, Wechat, WechatReading

**额外问题**: Alipay 有 `extractParamsFromPathTemplate()` 修复未传播到其他 app。

**建议**: 提取为 `os/createAppNavigation.ts` 工厂。

---

### 4.2 useAppGestures hook 重复 [高]

15 个 app 结构相同，仅函数名不同：
- 导入 `useTriggerGestures`
- 导入 `useAppNavigate`
- wire `execute` 到 `go()`/`back()`
- 实现 `bindBack()` wrapper

**受影响文件**:
- `Railway12306/hooks/useRailwayGestures.ts`
- `Compass/hooks/useCompassGestures.ts`
- `Contacts/hooks/useContactsGestures.ts`
- `X/hooks/useXGestures.ts`
- `Reddit/hooks/useRedditGestures.ts`
- `WechatReading/hooks/useWechatReadingGestures.ts`
- `TencentMeeting/hooks/useMeetingGestures.ts`
- `Wechat/hooks/useWechatGestures.ts`
- `Spotify/hooks/useSpotifyGestures.ts`
- `RedBook/hooks/useRedBookGestures.ts`
- `FileManager/hooks/useFileManagerGestures.ts`
- `Map/hooks/useMapGestures.ts`
- `Bilibili/hooks/useBilibiliGestures.ts`
- `Alipay/hooks/useAlipayGestures.ts`
- `Calculator2/hooks/useCalculator2Gestures.ts`

**建议**: 提取为 `os/createAppGestureHook.ts` 工厂。

---

### 4.3 NavigationHandler historyIndexRef 模板重复 [低]

16 个 app 复制相同 ~20 行：
```typescript
const historyIndexRef = useRef(0);
useEffect(() => {
  const memoryNavigator = navigator as any;
  if (typeof memoryNavigator.index === 'number') {
    historyIndexRef.current = memoryNavigator.index;
  }
}, [location, navigator]);
```

---

### 4.4 Clock 内部重复 [低]

拖拽关闭 sheet 逻辑在同一文件复制 3 次：
- `ClockApp.tsx:435`
- `ClockApp.tsx:627`
- `ClockApp.tsx:970`

---

## 5. 超大单文件

| 文件 | 行数 | 建议 |
|------|------|------|
| `Map/pages/ExplorePage.tsx` | **4404** | 拆分为多个组件 |
| `Clock/ClockApp.tsx` | **1716** | 拆分 Alarm/Timer/Stopwatch/WorldClock |
| `Gallery/GalleryApp.tsx` | **1372** | 拆分为 pages/ 结构 |

---

## 6. App 内混入脚本/工具

### 6.1 Reddit data/ 目录 [低]

包含 17+ Python/Shell 脚本：
- `fetch_assets.py`
- `run_all.sh`
- `requirements.txt`
- 等等

**建议**: 移至项目根 `scripts/reddit/`。

---

### 6.2 X scripts/ 和 tools/ [低]

- `scripts/`: `check-duplicates.mjs`, `generate-replies.ts`, `import-data.mjs`
- `tools/`: `verify-*.mjs`, `verify_*.py`

---

### 6.3 Ebay scripts/ [低]

`scripts/generate_ebay_catalog.mjs`

---

## 7. 状态管理问题

### 7.1 Weather 页面绕过 action 层 [中]

直接调用 `.setState(updater(getState()), true)`:
- `WeatherCitySearchPage.tsx:38`
- `WeatherCityPreviewPage.tsx:134,148`
- `WeatherCityManagerPage.tsx:148`
- `WeatherApp.tsx:204`

---

### 7.2 Gallery 命令式 store 访问 [低]

在普通函数中调用 `useGalleryStore.getState()` 和 `setState({}, true)`:
- `GalleryApp.tsx:46-61`

---

## 8. 其他问题

### 8.1 Ebay navigation.ts 不完整 [高]

**位置**: `Ebay/navigation.ts:26-36`

注释: `// Simplified logic assuming simple transitions for now`

跳过 from 验证、参数替换，无法处理参数化路由。

---

### 8.2 appState 条件未实现 [中]

7 个 app 的 navigation.ts 注释 `// appState 未接入，默认返回 null`：
- Alipay
- Bilibili
- RedBook
- Spotify
- TencentMeeting
- Wechat
- WechatReading

任何 `ref.ref === 'appState'` 的 cases 静默返回 null。

---

### 8.3 Ebay 缺少 data-trigger-type [中]

`useEbayGestures.bindTap()` 产生 `data-trigger` 但无 `data-trigger-type`，与 benchmark 观测系统不兼容。

---

### 8.4 全局样式污染 [中]

Calendar、Browser、Gallery 注入 `<style>` 隐藏滚动条：

```css
::-webkit-scrollbar { display: none; }
* { -ms-overflow-style: none; scrollbar-width: none; }
```

**位置**:
- `Calendar/CalendarApp.tsx:59-62`
- `Browser/BrowserApp.tsx:331-337`
- `Gallery/GalleryApp.tsx:1353`

**影响**: 同时挂载的其他 app 受影响。
