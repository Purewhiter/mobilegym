# App 结构对齐 Android 设计 — 标准化方案

## Context

### 问题

用户希望未来能参照 Android 源代码迁移大量开源 App。当前 App 内部结构不统一（types 位置、颜色定义、字符串管理各异），与 Android 资源系统差异大，增加迁移成本。

### 目标

1. 定义一个**标准 App 目录结构**，与 Android 的 `res/values/*` 资源系统对齐
2. 让"从 Android 源码迁移 App"有一个清晰的映射关系
3. 为 i18n、颜色深度、精确出栈等能力预留空间
4. 不破坏现有功能，渐进式迁移

### AOSP 实际结构（从参考代码确认）

```

apps/Calculator/

  AndroidManifest.xml                    # 身份 + 权限 + Activity 声明 + intent-filter

  res/

    values/

      strings.xml                        # 所有用户可见字符串（含 CHAR_LIMIT 注释）

      color.xml                          # 所有颜色（语义命名，如 calculator_accent_color）

      styles.xml                         # 主题 + 组件样式（引用 color/dimen name）

      config.xml                         # 布尔/配置标志

      attr.xml                           # 自定义属性声明

      dimens.xml                         # 尺寸（padding、字号、图标大小）

      donottranslate_strings.xml         # 不可翻译字符串（符号 +, ÷, π）

    values-zh-rCN/strings.xml            # 中文翻译

    drawable/                            # 矢量 drawable — XML 格式 (VectorDrawable)

      pad_button_background.xml          #   ripple effect 定义

      ic_fab_alarm.xml                   #   矢量图标（引用 @dimen、@color）

    drawable-xxhdpi/                     # 密度相关光栅图

      ic_add_white.png                   #   PNG 图标

      contact_popup_background.9.png     #   9-patch 图片

    mipmap-*/ic_launcher_*.png           # 启动图标（独立于 drawable，系统优化）

    layout/*.xml                         # XML 布局（Compose 时代已弃用）

    anim/*.xml                           # 插值器/动画定义

    raw/                                 # 原始文件

      alarm_expire.ogg                   #   音效

      timer_expire.ogg

    navigation/*.xml                     # 导航图（Settings 有）

    menu/*.xml                           # 菜单定义

    color/                               # 颜色状态列表（pressed/focused/disabled）

    transition/                          # 转场动画

  assets/                                # 不走 R 索引的原始文件（字体、数据库等）

  src/com/android/calculator2/*.java     # 源代码

```

**关键发现：**

-**colors.xml**: 连简单的 Calculator 都有 12 个命名颜色，Contacts 60+，Messaging 100+。每个颜色有语义名 + 注释说明用途

-**strings.xml**: 连 "=" 和 "π" 都有 string entry。每条有 `CHAR_LIMIT` 注释。中文在 `values-zh-rCN/strings.xml` 中覆盖

-**dimens.xml**: Messaging 有 200 条 dimen entry。所有 padding/margin/fontSize 全量外置

-**drawable/**: Calculator 2 个矢量 drawable。DeskClock 30+ 矢量图标。Messaging 100+ 密度相关光栅图。矢量 drawable 引用 `@color/*` 和 `@dimen/*`（不硬编码值）

-**mipmap/**: 启动图标，5 个密度目录（mdpi→xxxhdpi）

-**raw/**: DeskClock 有 alarm_expire.ogg、timer_expire.ogg 音效文件

-**navigation/**: 只有 Settings 有 nav_graph XML（旧 App 不用 Navigation Component）

-**AndroidManifest.xml**: 每个 Activity 声明 `intent-filter`（深链接）和 `parentActivityName`（返回目标）

-**assets/**: Calendar 有 `assets/dummy`，Settings 有 `assets/appfunctions.xml`。与 `res/` 不同：assets 不走 R 索引，通过 AssetManager 直接路径访问

---

## 设计方案

### 标准 App 目录结构

```

apps/<AppName>/

  ┌─ 身份层（对应 AndroidManifest.xml）

  │  manifest.ts                    # App 身份、图标、主题 Tier-1 颜色、intentFilters

  │

  ├─ 导航层（对应 res/navigation/*.xml）

  │  navigation.declaration.ts      # 导航图声明（routes, transitions, actions）

  │  navigation.ts                  # 导航 hooks（go/back）

  │  navigation.types.ts            # 路由类型定义

  │

  ├─ 资源层（对应 res/）★ 新增

  │  res/

  │    colors.ts                    # 对应 values/colors.xml — Tier-2 组件级颜色（含 dark 变体）

  │    colors.states.ts             # 对应 res/color/*.xml — 颜色状态列表（可选）

  │    strings.ts                   # 对应 values/strings.xml — 用户可见字符串（默认中文）

  │    strings.en.ts                # 对应 values-en/strings.xml — 英文覆盖（可选）

  │    dimens.ts                    # 对应 values/dimens.xml — App 级尺寸（标配）

  │    drawable/                    # 对应 res/drawable/ — SVG 图标组件

  │      icons.tsx                  #   矢量图标集合（VectorDrawable → React 组件）

  │

  ├─ 静态资产层（对应 res/drawable-*dpi/ + res/raw/ + assets/）

  │  assets/                        # 二进制资产（Vite import，自包含于 App 内）

  │    images/                      #   PNG/JPG/WebP（对应 drawable-xxhdpi/）

  │    icons/                       #   PNG 图标（对应 mipmap-*/ 中的非启动图标）

  │    lottie/                      #   Lottie 动画 JSON（对应 res/raw/lottie_*.json）

  │    fonts/                       #   自定义字体 TTF/OTF（对应 res/font/ + assets/fonts/）

  │    raw/                         #   音效/视频（对应 res/raw/）

  │

  ├─ 数据层（对应 SharedPreferences + ContentProvider）

  │  data/

  │    index.ts                     # 数据入口（合并 defaults.json + res 常量）

  │    defaults.json                # 默认数据（用户、内容、历史）

  │

  ├─ 逻辑层（对应 src/ 中的 ViewModel/Repository/Service）

  │  context/<AppName>Context.tsx   # 状态管理（对应 ViewModel）

  │  hooks/                         # App 级 hooks

  │  types.ts                       # App 级类型定义 ★ 位置标准化

  │

  ├─ UI 层（对应 src/ 中的 Activity/Fragment/Composable）

  │  <AppName>App.tsx               # 入口（对应 MainActivity）

  │  pages/                         # 页面（对应 Fragment/Screen）

  │  components/                    # 共享组件

  │  styles/                        # CSS 模块（可选，少数 App 用到）

  │

  └─ 迁移说明

     constants.ts（不废弃，只瘦身）→

       颜色部分 → res/colors.ts

       尺寸部分 → res/dimens.ts

       字符串部分 → res/strings.ts

       保留：服务宫格数组、tab 定义、配置参数等 App 结构性常量

     public/<appName>/ 散落资产 → 迁移到 apps/<AppName>/assets/

```

### Android → mobile-gym 映射表

| Android 源文件 | mobile-gym 对应 | 说明 |

|---|---|---|

|`AndroidManifest.xml`|`manifest.ts`| 已完成 |

|`res/values/colors.xml`|`res/colors.ts`|**新增**|

|`res/values/colors.xml` (night) |`res/colors.ts` dark 变体 |**新增**|

|`res/color/*.xml` (状态列表) |`res/colors.states.ts`|**新增**|

|`res/values/strings.xml`|`res/strings.ts`|**新增**|

|`res/values/arrays.xml` (string-array) |`res/strings.ts` 中的数组 |**新增**|

|`<plurals>`|`res/strings.ts` 中的函数 |**新增**|

|`res/values/dimens.xml`|`res/dimens.ts`|**新增**（标配） |

|`res/values/styles.xml`|`manifest.ts` theme + Tailwind | 已覆盖 |

|`res/values/config.xml`|`constants.ts` 或 `data/index.ts`| 现有 |

|`res/drawable/*.xml` (矢量) |`res/drawable/icons.tsx`|**新增** — SVG → React 组件 |

|`res/drawable/*.xml` (shape/selector/layer) | Tailwind CSS（天然覆盖） | — |

|`res/drawable-*dpi/` (光栅) |`assets/images/` (Vite import) | 现有（需统一到 assets/） |

|`res/mipmap-*/` (启动图标) |`manifest.ts` → `icon` 字段 | 已完成 |

|`res/font/` + `assets/fonts/`|`assets/fonts/` + `manifest.ts` theme.fontFamily |**新增**|

|`res/raw/` (音效) |`assets/raw/` (Vite import) |**新增路径规范**|

|`res/raw/` (Lottie JSON) |`assets/lottie/` (Vite import + lottie-react) |**新增**|

|`res/navigation/nav_graph.xml`|`navigation.declaration.ts`| 已完成（我们更强） |

|`res/anim/` + `res/transition/`|`navigation.declaration.ts` animation + CSS | 已覆盖 |

|`<intent-filter>`|`manifest.ts` → `intentFilters`|**新增字段**|

|`parentActivityName` (返回) |`go()` → `popTo` 参数 |**新增能力**|

| Activity |`pages/*.tsx`| 已有 |

| Fragment |`components/*.tsx`| 已有 |

| ViewModel |`context/*Context.tsx`| 已有 |

|`assets/` (原始资产) |`assets/` (Vite import) | 现有（需统一路径） |

**暂不映射：**

-`values-sw*dp/`、`values-land/` — 固定 360x800 视口

-`values-ldrtl/` — 中英文均 LTR

-`values-mcc*mnc*` — 不需要运营商配置

-`res/xml/` — 不涉及 UI

-`res/interpolator/` — CSS easing 覆盖

---

### 改动 1: `res/colors.ts` — Tier-2 组件级颜色

**对应 AOSP `res/values/colors.xml`**

AOSP Calculator 的 `color.xml` 有 12 个命名颜色（`calculator_accent_color`, `display_background_color`, `pad_numeric_background_color` 等）。Messaging 有 100+ 个。它们都是**按语义命名**的，组件引用名字不引用 hex 值。

我们的 manifest.ts 有 ~10 个 Tier-1 语义颜色（primary, background 等），但很多 App 还需要组件级颜色。这些颜色目前散落在 `constants.ts`（如 Calculator2 的 `CALC_COLORS`）或直接硬编码在 JSX 中。

**规范：**

```typescript

// apps/Calculator2/res/colors.ts

// Tier-2: 组件级颜色（Tier-1 在 manifest.ts theme.colors 中）

// 命名规则：<区域>_<用途>，与 AOSP colors.xml 一致


exportconstcolors={

// Display area

  display_background:'#FFFFFF',

  display_formula_text:'rgba(0,0,0,0.54)',

  display_result_text:'rgba(0,0,0,0.42)',


// Numeric pad

  pad_numeric_background:'#434343',

  pad_operator_background:'#636363',

  pad_advanced_background:'#1DE9B6',


// Button text

  pad_button_text:'#FFFFFF',

  pad_button_advanced_text:'rgba(0,0,0,0.57)',


// Feedback

  error:'#F40056',

  ripple:'rgba(255,255,255,0.2)',

  ripple_advanced:'rgba(0,0,0,0.1)',

}asconst;

```

```typescript

// apps/Messaging/res/colors.ts — 复杂 App 示例

exportconstcolors={

// Action bar

  action_bar_title_text:'#ffffff',

  action_bar_background:'#689F38',// = primary from manifest


// Conversation list

  conversation_list_item_read:'#636363',

  conversation_list_item_unread:'#323232',

  conversation_list_name:'rgba(0,0,0,0.87)',


// Message bubbles

  message_text_incoming:'#ffffff',

  message_text_outgoing:'#323232',

  message_bubble_outgoing:'#ffffff',

  timestamp_text_outgoing:'rgba(50,50,50,0.6)',

// ...

}asconst;

```

**与 `constants.ts` 的关系：**`constants.ts` 中的颜色部分（如 `CALC_COLORS`）迁移到 `res/colors.ts`。服务宫格数组、tab 定义、配置参数等保留在 `constants.ts`。尺寸部分迁移到 `res/dimens.ts`。

**深色模式（对应 `values-night/colors.xml`）：**`colors.ts` 导出 `colorsDark` 部分覆盖，运行时通过 `{ ...colors, ...colorsDark }` 合并。

### 改动 1b: `res/colors.states.ts` — 颜色状态列表（可选）

**对应 AOSP `res/color/*.xml`** — 按 View 状态（pressed/selected/disabled）变化的颜色。用于 Tab 图标着色、按钮文字、开关状态等。Tailwind 的 `hover:/active:` 覆盖大部分场景，但当颜色需要在 JS 中动态计算时（如根据 selected 状态切换 Tab 图标色），需要此文件。

### 改动 2: `res/strings.ts` — 字符串外置

**对应 AOSP `res/values/strings.xml` + `values-zh-rCN/strings.xml`**

AOSP 的做法：默认语言 strings.xml（英文），每个翻译语言一个 `values-<locale>/strings.xml`。我们的情况相反 — 默认中文，需要英文覆盖（bench_env 需要）。

**规范：**

```typescript

// apps/Calculator2/res/strings.ts

// 默认字符串（中文）— 对应 AOSP values/strings.xml

// 每个 key 对应一个用户可见文本

// 注释标注 CHAR_LIMIT（参照 AOSP 惯例，帮助 AI 控制文本长度）


exportconststrings={

// App name (在 manifest.ts displayName 中)

// app_name: '计算器',  // 不在这里，在 manifest 中


// Error messages [CHAR_LIMIT=14]

  error_nan:'不是数字',

  error_syntax:'错误',


// Function names [CHAR_LIMIT=3]

  fun_cos:'cos',

  fun_sin:'sin',

  fun_tan:'tan',

  fun_ln:'ln',

  fun_log:'log',


// Operations [CHAR_LIMIT=3]

  clr:'清除',

  del:'del',


// Content descriptions (无障碍/Agent 可见) [CHAR_LIMIT=NONE]

  desc_op_add:'加',

  desc_op_sub:'减',

  desc_op_mul:'乘',

  desc_op_div:'除',

  desc_eq:'等于',

  desc_clr:'清除',

  desc_del:'删除',

}asconst;


// 类型导出，供组件 import

exporttypeStringKey=keyoftypeof strings;

```

```typescript

// apps/Calculator2/res/strings.en.ts (可选，英文覆盖)

importtype{ StringKey }from'./strings';


exportconststringsEn:Partial<Record<StringKey,string>>={

  error_nan:'Not a number',

  error_syntax:'Error',

  clr:'clr',

  desc_op_add:'plus',

  desc_op_sub:'minus',

// ...

};

```

**使用方式：**

```tsx

// 组件中

import{ strings }from'../res/strings';

// 直接使用（当前阶段，最简单）

<span>{strings.error_nan}</span>


// 后续可以加一个 useStrings() hook 支持动态语言切换

```

**迁移策略：** 不需要一次性迁移所有 App。优先在新 App 和 Calculator2（已经有 AOSP 对照）上实施，其他 App 渐进迁移。`strings.ts` 中也可包含字符串数组（对应 `<string-array>`）和复数函数（对应 `<plurals>`）。

### 改动 3: `res/dimens.ts` — 尺寸外置（标配）

**对应 AOSP `res/values/dimens.xml`**

AOSP 的每个 App 都有 dimens.xml（Messaging 200 条、DeskClock 130 条），不是"只有特殊尺寸才外置"，而是**所有尺寸都外置**。原因：

1.**环境参数可调** — 换一套 `dimens-sw600dp.xml` 就能适配平板，改系统字号所有 `sp` 自动缩放

2.**bench_env 需要** — 通过替换 dimens 配置创造不同训练环境（字号大小、间距、图标尺寸）

3.**一致性** — 组件不硬编码 `text-sm`，而是引用 `dimens.body_text_size`

**规范：**

```typescript

// apps/Calculator2/res/dimens.ts

// 所有 App 级尺寸 — 对应 AOSP dimens.xml

// bench_env 可替换此文件来创造不同环境


exportconstdimens={

// Display area text

  formula_text_min:36,// px (对应 AOSP sp)

  formula_text_max:64,

  formula_text_step:8,

  result_text:36,


// Button text sizes

  numeric_button_text:32,

  operator_button_text:23,

  operator_text_button:15,// del / clr

  advanced_button_text:20,

  equals_button_text:23,


// Layout proportions

  pad_numeric_weight:264,

  pad_operator_weight:96,


// Display padding

  display_formula_padding_top:48,

  display_formula_padding_bottom:24,

  display_formula_padding_sides:16,

  display_result_padding_top:24,

  display_result_padding_bottom:48,

  display_result_padding_sides:16,


// Pad padding

  pad_numeric_padding_top:12,

  pad_numeric_padding_bottom:20,

  pad_numeric_padding_sides:12,

  pad_operator_padding_top:8,

  pad_operator_padding_bottom:24,

  pad_operator_padding_start:4,

  pad_operator_padding_end:28,

  pad_advanced_padding_top:12,

  pad_advanced_padding_bottom:20,

  pad_advanced_padding_sides:20,

}asconst;

```

```typescript

// apps/Wechat/res/dimens.ts — 典型社交 App

exportconstdimens={

// Chat list

  chat_item_height:72,

  chat_avatar_size:48,

  chat_title_text:16,

  chat_subtitle_text:13,

  chat_time_text:12,

  chat_item_padding_h:16,


// Chat detail

  message_text:16,

  message_bubble_padding_h:12,

  message_bubble_padding_v:10,

  message_bubble_max_width:260,

  message_avatar_size:40,

  message_gap:2,// same author

  message_gap_diff:18,// different author


// Tab bar

  tab_bar_height:56,

  tab_icon_size:24,

  tab_label_text:10,


// Action bar

  action_bar_height:48,

  action_bar_title_text:18,


// General

  page_padding_h:16,

  section_gap:8,

  divider_height:0.5,

}asconst;

```

**使用方式 — dimens 值注入为 CSS 变量，Tailwind 通过 var() 引用：**

```tsx

// 1. dimens.ts 的值由 themeToCssVars（或类似工具）注入为 CSS 变量

// <AppRoot> 上生成：

// --app-chat-item-h: 72px

// --app-chat-avatar: 48px

// --app-chat-title-text: 16px

// --app-chat-padding-h: 16px


// 2. 组件使用 Tailwind + var()（保留响应式/hover 等能力）

<divclassName="h-[var(--app-chat-item-h)] px-[var(--app-chat-padding-h)]">

<imgclassName="w-[var(--app-chat-avatar)] h-[var(--app-chat-avatar)]"/>

<spanclassName="text-[length:var(--app-chat-title-text)]">标题</span>

</div>


// 3. bench_env 运行时可通过 JS 修改 CSS 变量来调参

// document.querySelector('[data-app=wechat]').style.setProperty('--app-chat-item-h', '96px')

```

与 theme colors 的注入方式完全一致 — `themeToCssVars` 工具扩展为同时处理 colors + dimens。

**bench_env 环境变体示例：**

```

?dimens=large   → 所有 text size * 1.3, padding * 1.2

?dimens=compact → 所有 text size * 0.85, padding * 0.7

?dimens=tablet  → 自定义尺寸集

```

### 改动 4: `res/drawable/` — 矢量图标组件

**对应 AOSP `res/drawable/*.xml`**

AOSP 的 VectorDrawable（XML 格式矢量图）在我们的 React 环境中对应 SVG 组件。关键点：**AOSP 的矢量 drawable 引用 `@color/*` 和 `@dimen/*`，不硬编码值。** 我们也应该让图标引用 `res/colors.ts` 中的命名颜色。

```tsx

// apps/DeskClock/res/drawable/icons.tsx

// 对应 AOSP res/drawable/ 中的矢量 drawable

// 所有图标使用 currentColor 或引用 res/colors.ts，不硬编码色值


import{ colors }from'../colors';


exportconstIcFabAlarm=({size=24,className=''}:{ size?:number; className?:string})=> (

<svgwidth={size}height={size}viewBox="0 0 56 56"className={className}>

<pathfill="currentColor"d="M28,20c-5.2,0-9.3,4.2-9.3,9.3..."/>

</svg>

);


exportconstIcSnooze=({size=24,className=''})=> (

<svgwidth={size}height={size}viewBox="0 0 24 24"className={className}>

<pathfill="currentColor"d="..."/>

</svg>

);

```

**规则：**

- 能用 `currentColor` 的图标（单色）→ 使用 `currentColor`，外层控制颜色
- 需要固定色的图标（多色）→ 引用 `colors.ts` 中的命名颜色
- 已用 lucide-react 的图标不需要迁移（lucide 已经是 `currentColor`）
- 只有从 AOSP 迁移的、或有自定义 SVG 图标的 App 才需要此目录

### 改动 4b: 自定义字体（`assets/fonts/`）

**对应 AOSP `res/font/` + `assets/fonts/`。** 字体文件放在 `assets/fonts/`，通过 `manifest.ts` 的 `theme.fontFamily` 声明。使用 CSS `@font-face` 加载。大部分 App 不需要 — 仅在品牌字体或特殊 UI 元素（如时钟数字）时使用。

### 改动 4c: Lottie 动画（`assets/lottie/`）

**对应 AOSP `res/raw/lottie_*.json`。** Settings 有 70+ Lottie 文件。Lottie JSON 放在 `assets/lottie/`，使用 `lottie-react` 播放。在迁移有 Lottie 的 App 时再添加依赖。

### 改动 5: 静态资产自包含（App 内 `assets/`）

**对应 AOSP `res/drawable-*dpi/` + `res/raw/` + `assets/`**

**核心原则：** Android APK 中所有资源自包含于包内。我们的 App 也应如此 — 所有二进制资产（图片、音效、字体等）放在 `apps/<AppName>/assets/` 内，通过 Vite ES import 引用。这样：

1.**自包含** — 未来 `.mgapp` 打包时每个 App 是独立单元

2.**Vite 优化** — import 的资产经过 hash、压缩、tree-shaking

3.**类型安全** — import 路径有 TS 校验，路径写错编译报错（vs URL 字符串只在运行时 404）

**当前问题 — 三种散乱方式并存：**

| 方式 | 示例 | 问题 |

|------|------|------|

|`apps/*/assets/` + Vite import | Weather, Railway12306, Compass |**正确** ✓ |

|`public/<appName>/` + URL 字符串 | RedBook, Reddit, Wechat | 不打包、不 hash、App 不自包含 |

|`public/apps/<AppName>/` + URL 字符串 | Calendar, Sms | 同上，且路径风格不统一 |

**规范：**

```

apps/<AppName>/

  assets/                          # 所有二进制资产（对应 AOSP drawable-*dpi/ + raw/ + assets/）

    images/                        #   PNG/JPG/WebP 图片

      avatar_1.png

      banner.webp

    icons/                         #   PNG/SVG 图标（非 lucide，非矢量组件的）

      tab_home.webp

      tab_home_active.webp

    raw/                           #   音效/视频

      alarm_expire.ogg

```

**使用方式 — Vite ES import：**

```tsx

// 推荐：静态 import（Vite 编译时解析，tree-shakeable）

import avatarUrl from'../assets/images/avatar_1.png';

import alarmSound from'../assets/raw/alarm_expire.ogg';


<imgsrc={avatarUrl}/>

<audiosrc={alarmSound}/>


// 动态 import（运行时解析，用于条件加载）

constbgUrl=newURL(`../assets/images/bg_${condition}.webp`,import.meta.url).toString();

```

**`public/` 中保留的内容（仅系统级共享资源）：**

| 路径 | 用途 | 为何不迁入 App |

|------|------|---------------|

|`public/themes/`| 主题包（OS ThemeService） | 系统级资源，多 App 共享 |

|`public/sdcard/`| 虚拟 SD 卡（Gallery、FileManager） | 模拟用户文件系统，不属于任何 App |

|`public/icons/hyperos-symbols/`| HyperOS 系统图标集 | 系统级 UI 图标，多 App 共享 |

|`public/ime/`| 输入法词典 | 系统级服务资源 |

**迁移规则：**

-`public/RedBook/assets/` → `apps/RedBook/assets/`，改为 Vite import

-`public/reddit/` → `apps/Reddit/assets/`，改为 Vite import

-`public/wechat/` → `apps/Wechat/assets/`，改为 Vite import

-`public/apps/Calendar/assets/icons/` → 已有 `apps/Calendar/assets/icons/`（删除 public 副本，改 URL 字符串为 import）

-`public/apps/Sms/assets/icons/` → 已有 `apps/Sms/assets/icons/`（删除 public 副本，改 URL 字符串为 import）

- 已经在 `apps/*/assets/` + Vite import 的 App（Weather、Railway12306、Compass）→ 不需要改

### 改动 6: `types.ts` 位置标准化（已在之前讨论中确认）

当前乱象：

- X: `data/xTypes.ts`
- Bilibili: `data/bilibiliTypes.ts` + `data/commentTypes.ts`
- Wechat: `types/index.ts`（目录）
- Spotify/RedBook/Railway12306: `types.ts`（正确）

**标准化：** 统一为 App 根目录下的 `types.ts`。如果类型很多需要拆分，使用 `types.ts` 作为 barrel export：

```typescript

// apps/Bilibili/types.ts (barrel export)

exporttype{ BilibiliVideo, BilibiliUser, ... }from'./types/video';

exporttype{ Comment, CommentReply, ... }from'./types/comment';

```

### 改动 7: `manifest.ts` 新增 `intentFilters`

**对应 AOSP `<intent-filter>` — 声明 App 能响应的 intent（深链接、广播、跨 App 调用）**

```typescript

// os/types/manifest.ts — 新增字段

exportinterfaceAppManifest{

// ... 现有字段 ...


/** Intent 过滤器（对应 Android <intent-filter>） */

  intentFilters?:AppIntentFilter[];

}


exportinterfaceAppIntentFilter{

/** 路由路径（如 '/contacts?filter=star'） */

  route:string;

/** 路由参数说明 */

  params?:{ name:string; type:'string'|'number'; description?:string}[];

/** 描述 */

  description?:string;

}

```

```typescript

// apps/Calculator2/manifest.ts

exportconstmanifest:AppManifest={

// ...

  intentFilters: [

{ route:'/', description:'计算器主页'},

  ],

};


// apps/Wechat/manifest.ts

exportconstmanifest:AppManifest={

// ...

  intentFilters: [

{ route:'/', description:'聊天列表'},

{ route:'/contacts', description:'通讯录'},

{ route:'/discover', description:'发现页'},

{ route:'/me', description:'我的'},

{ route:'/chat/:id', params: [{ name:'id', type:'string', description:'会话ID'}], description:'聊天详情'},

  ],

};

```

### 改动 8: `AppThemeColors` 新增 `onPrimary`

**对应 Material Design 3 的 `on*` 系列**

```typescript

exportinterfaceAppThemeColors{

// ... 现有字段 ...


/** Primary 色背景上的文本/图标色（默认 #ffffff） */

  onPrimary?:string;

/** Surface 色背景上的文本/图标色 */

  onSurface?:string;

}

```

解决的问题：当前组件在 primary 色背景上硬编码 `text-white`，如果 primary 是浅色就不对了。有了 `onPrimary`，可以用 `text-app-on-primary`。

### 改动 9: `go()` 新增 `popTo` 参数

**对应 Android nav_graph 的 `popUpTo`**

```typescript

// navigation.ts — go() 签名扩展

functiongo(path:string,options?:{

  mode?:'push'|'replace';

  popTo?:string;// 弹出到指定路径（保留该路径）

  popToInclusive?:boolean;// 是否也弹出目标路径

}):void;

```

使用场景：转账成功后回首页

```typescript

go('/',{ popTo:'/', popToInclusive:false});

// 效果：清空 TransferAmount → TransferSuccess，回到首页

```

---

## 执行计划

### Phase 1: 基础设施

1. 修改 `os/types/manifest.ts`：添加 `intentFilters`, `onPrimary`, `onSurface` 字段
2. 创建 `os/types/res.ts`：定义 `ColorStateList` 类型
3. 更新 `os/utils/themeToCssVars.ts`：生成 `--app-on-primary`, `--app-on-surface` CSS 变量
4. 更新 `index.css`：`@theme inline` 添加 `--color-app-on-primary`, `--color-app-on-surface`

**关键文件：**

-[os/types/manifest.ts](os/types/manifest.ts)

-`os/types/res.ts`（新建）

-[os/utils/themeToCssVars.ts](os/utils/themeToCssVars.ts)

-[index.css](index.css)

### Phase 2: Calculator2 作为标杆 App

Calculator2 已经有 AOSP 参照数据（`constants.ts` 注释来源于 AOSP `res/values/`），是最佳试点：

1. 创建 `apps/Calculator2/res/colors.ts` — 从 `constants.ts` 的 `CALC_COLORS` 迁移
2. 创建 `apps/Calculator2/res/strings.ts` — 从 JSX 提取所有硬编码字符串（参照 `/aosp-ref/apps/Calculator/res/values/strings.xml`）
3. 创建 `apps/Calculator2/res/dimens.ts` — 从 `constants.ts` 的 `CALC_SIZES`, `PAD_WEIGHTS`, `DISPLAY_PADDING`, `PAD_PADDING` 迁移
4. 扩展 `themeToCssVars` — 支持 dimens → CSS 变量注入
5. 更新组件引用：

- 颜色：`CALC_COLORS.accent` → CSS 变量 `var(--app-calc-accent)` 或 `colors.accent`
- 尺寸：Tailwind 硬编码值 → `var(--app-xxx)`
- 字符串：硬编码中文 → `strings.xxx`

6. 清理 `constants.ts`：只保留 `ANIM_DURATION`, `EVAL_CONFIG` 等非资源类常量
7. 在 `manifest.ts` 添加 `intentFilters`

### Phase 3: types.ts 位置标准化 + 静态资产自包含

1.`apps/X/data/xTypes.ts` → `apps/X/types.ts`

2.`apps/Bilibili/data/bilibiliTypes.ts` + `data/commentTypes.ts` → `apps/Bilibili/types.ts`（barrel export）

3.`apps/Wechat/types/index.ts`（目录） → `apps/Wechat/types.ts`（单文件或 barrel）

4. 更新所有 import 路径
5. 迁移 `public/` 中的 App 资产到 `apps/<AppName>/assets/`：

-`public/RedBook/assets/` → `apps/RedBook/assets/`（已有部分，合并）

-`public/reddit/` → `apps/Reddit/assets/`

-`public/wechat/` → `apps/Wechat/assets/`

-`public/apps/Calendar/assets/icons/` → 删除（已有 `apps/Calendar/assets/icons/`）

-`public/apps/Sms/assets/icons/` → 删除（已有 `apps/Sms/assets/icons/`）

6. 将所有 URL 字符串引用改为 Vite import：

- RedBook: `'/RedBook/assets/...'` → `import xxx from './assets/...'`
- Reddit: `'/reddit/...'` → `import xxx from './assets/...'`
- Wechat: `'/wechat/...'` → `import xxx from './assets/...'`
- Calendar: `CAL_ICON(name)` → import 各 SVG
- Sms: URL 字符串 → import

7. 删除 `public/weather-xiaomi/icons/`（未被任何代码引用）

### Phase 4: 其他 App 渐进迁移

按优先级逐步迁移其他 App 的 `res/` 目录。每次迁移一个 App 时完整创建 `res/colors.ts` + `res/strings.ts` + `res/dimens.ts`。

优先级：

1. 即将迁移的 AOSP 对照 App（DeskClock, Messaging, Contacts 等）
2. bench_env 任务多的 App（Wechat, Alipay, Bilibili 等）
3. 其余 App

### Phase 5: go() popTo 能力

1. 修改各 App 的 `navigation.ts` — `go()` 增加 `popTo` 参数
2. 实现基于 MemoryRouter history 的 popTo 逻辑
3. 在转账/登录等流程中使用

### Phase 6: 文档更新

更新 CLAUDE.md, README.md, PROJECT_SPEC_V2.md 中的 App 结构说明，添加 `res/` 目录规范和 Android 映射表。

---

## 验证方式

1.**Phase 1 后**：`npm run dev` 正常，新 CSS 变量（colors + dimens）可用

2.**Phase 2 后**：Calculator2 功能完全正常，所有字符串/颜色/尺寸来自 `res/`；通过修改 CSS 变量确认尺寸可运行时调整

3.**Phase 3 后**：`npx tsc --noEmit` 检查所有 import 路径正确；`public/` 下不再有 App 专属资产目录（仅保留系统级资源）；RedBook/Reddit/Wechat/Calendar/Sms 图片正常显示

4.**Phase 4 每个 App 后**：视觉对比无差异

5.**Phase 5 后**：转账流程测试 — 成功后 back 键直接回首页而非上一步
