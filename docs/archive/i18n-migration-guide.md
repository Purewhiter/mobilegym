# 国际化 (i18n) 迁移指南

本文档描述了将硬编码中文字符串迁移到国际化资源文件的完整流程。

## 目录

1. [架构概述](#架构概述)
2. [文件结构](#文件结构)
3. [迁移流程](#迁移流程)
4. [辅助脚本](#辅助脚本)
5. [最佳实践](#最佳实践)
6. [常见问题](#常见问题)

---

## 架构概述

### 设计原则

- **资源分离**：字符串资源与组件代码分离，便于维护和翻译
- **类型安全**：TypeScript 类型检查确保翻译 key 的正确性
- **按需加载**：通过 React Hook 在组件内获取翻译文本
- **兼容 Android**：命名和结构参考 Android `res/values/strings.xml` 规范

### 核心组件

```
os/useAppStrings.ts          # 通用语言切换 Hook
apps/<App>/res/strings.ts    # 中文资源（默认语言）
apps/<App>/res/strings.en.ts # 英文翻译
apps/<App>/hooks/use<App>Strings.ts  # App 专用 Hook（简化导入）
```

---

## 文件结构

### 1. 中文资源文件 `res/strings.ts`

```typescript
/**
 * Wechat 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  // ============================================================================
  // [common] - 通用高频字符串
  // ============================================================================
  common_cancel: '取消',
  common_confirm: '确定',
  common_done: '完成',

  // ============================================================================
  // [tabs] - 底部导航标签
  // ============================================================================
  tab_wechat: '微信',
  tab_contacts: '通讯录',
  tab_discover: '发现',
  tab_me: '我',

  // ============================================================================
  // [settings] - 设置相关
  // ============================================================================
  settings_title: '设置',
  settings_dark_mode: '深色模式',
  // ...
} as const;

export type StringKey = keyof typeof strings;
```

**命名规范**：
- 使用 `模块_功能` 格式，如 `settings_dark_mode`
- 分组使用注释块标记
- 末尾添加 `as const` 确保类型推导

### 2. 英文翻译文件 `res/strings.en.ts`

```typescript
import type { StringKey } from './strings';

/**
 * 英文翻译 — 对应 AOSP res/values-en/strings.xml
 * 使用 Partial 允许部分翻译，未翻译的 key 会 fallback 到中文
 */
export const stringsEn: Partial<Record<StringKey, string>> = {
  common_cancel: 'Cancel',
  common_confirm: 'OK',
  common_done: 'Done',

  tab_wechat: 'Chats',
  tab_contacts: 'Contacts',
  tab_discover: 'Discover',
  tab_me: 'Me',

  settings_title: 'Settings',
  settings_dark_mode: 'Dark Mode',
  // ...
};
```

### 3. App 专用 Hook `hooks/use<App>Strings.ts`

```typescript
import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

/**
 * 简化版 Hook，直接返回当前语言的字符串对象
 */
export function useWechatStrings() {
  return useAppStrings(strings, stringsEn);
}
```

### 4. 通用 Hook `os/useAppStrings.ts`

```typescript
import { useOS } from './OSContext';

export function useAppStrings<T extends Record<string, string>>(
  defaultStrings: T,
  enStrings: Partial<T>
): T {
  const { language } = useOS();
  
  if (language === 'en') {
    return { ...defaultStrings, ...enStrings } as T;
  }
  return defaultStrings;
}
```

---

## 迁移流程

### 步骤 1：检测未翻译的字符串

```bash
node scripts/detect_untranslated.mjs <AppName>
node scripts/detect_untranslated.mjs <AppName> --verbose  # 显示每个文件最多 100 条
```

脚本会输出：
1. 已定义翻译数量
2. 按文件分组的未翻译字符串（附行号）
3. 高频字符串（出现 2+ 次，优先处理）
4. 建议添加到 strings.ts 的模板代码

### 步骤 2：添加字符串到资源文件

1. 打开 `apps/<App>/res/strings.ts`
2. 按模块分组添加新字符串
3. 在 `apps/<App>/res/strings.en.ts` 添加对应英文翻译

```typescript
// strings.ts
export const strings = {
  // ...existing...
  
  // ============================================================================
  // [general] - 通用设置
  // ============================================================================
  general_on: '已开启',
  general_off: '已关闭',
  general_interface_display: '界面与显示',
} as const;

// strings.en.ts
export const stringsEn = {
  // ...existing...
  general_on: 'On',
  general_off: 'Off',
  general_interface_display: 'Interface & Display',
};
```

### 步骤 3：在组件中使用翻译

```tsx
// 支付宝示例
import { useAlipayStrings } from '../hooks/useAlipayStrings';

export const MyComponent: React.FC = () => {
  const t = useAlipayStrings();
  
  return (
    <div>
      <h1>{t.settings_title}</h1>
      <span>{t.general_on}</span>
    </div>
  );
};

// 其他应用同理：
// import { useWechatStrings } from '../hooks/useWechatStrings';
// import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
// import { useRedBookStrings } from '../hooks/useRedBookStrings';
```

### 步骤 4：处理特殊情况

#### 模块级常量（无法直接使用 Hook）

```tsx
// ❌ 错误：模块级常量无法使用 t
const TABS = [
  { key: 'all', label: '全部' },  // 硬编码
];

// ✅ 正确：改为 key 映射，在组件内构建
const TAB_KEYS = [
  { key: 'all', labelKey: 'search_all' },
] as const;

export const MyComponent = () => {
  const t = useWechatStrings();
  const TABS = useMemo(() => 
    TAB_KEYS.map(item => ({ key: item.key, label: t[item.labelKey] })),
    [t]
  );
  // ...
};
```

#### 带参数的字符串

```tsx
// strings.ts
friend_groups_count: '个',

// 组件中拼接
<span>{`${count}${t.friend_groups_count}`}</span>
// 或使用模板函数
```

### 步骤 5：验证

```bash
# TypeScript 类型检查
npx tsc --noEmit 2>&1 | grep "<AppName>"

# 重新检测未翻译字符串
node scripts/detect_untranslated.mjs <AppName>
```

---

## 辅助脚本

### 1. `check_translation_coverage.mjs` - 翻译覆盖率检测

检测所有应用的翻译覆盖率和质量问题。

```bash
# 检查所有应用
node scripts/check_translation_coverage.mjs --all

# 检查单个应用（显示详细问题）
node scripts/check_translation_coverage.mjs Alipay
node scripts/check_translation_coverage.mjs TencentMeeting
```

**输出示例**：
```
📊 翻译覆盖率检测

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
App                           总数    已翻译      覆盖率     问题
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Alipay                       475    475   100.0%      1
TencentMeeting               366    366   100.0%      5
RedBook                      452    452   100.0%      2
Wechat                       266    266   100.0%      2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总计                          6680   6660    99.7%     57
```

**检测的问题类型**：
- ❌ 缺少翻译（key 存在但英文值为空）
- ⚠️ 英文与中文相同（可能忘记翻译）
- ⚠️ 翻译不完整（英文中包含中文字符）
- ⚠️ 占位符不匹配（%s、{name} 等）

### 2. `create_app_strings_hook.mjs` - 创建专用 Hook

为应用自动创建专用的 strings Hook 并迁移所有组件。

```bash
# 预览（不实际修改）
node scripts/create_app_strings_hook.mjs <AppName> --dry-run

# 实际执行
node scripts/create_app_strings_hook.mjs <AppName>
```

**自动完成**：
1. 创建 `hooks/use<AppName>Strings.ts`
2. 迁移所有使用 `useAppStrings` 的组件
3. 删除旧的 3 行 import，添加新的 1 行 import
4. 替换调用 `useAppStrings(strings, stringsEn)` → `use<AppName>Strings()`

**已创建的 Hook**：
| 应用 | Hook | 文件数 |
|------|------|--------|
| 微信 | `useWechatStrings()` | 45 |
| 支付宝 | `useAlipayStrings()` | 38 |
| 腾讯会议 | `useTencentMeetingStrings()` | 19 |
| 小红书 | `useRedBookStrings()` | 45 |

### 3. `detect_untranslated.mjs` - 检测未翻译字符串

检测代码中的硬编码中文字符串（排除已在 `strings.ts` 中定义的）。

```bash
node scripts/detect_untranslated.mjs <AppName>
node scripts/detect_untranslated.mjs <AppName> --verbose  # 显示所有位置
node scripts/detect_untranslated.mjs <AppName> --all      # 包括已翻译的
```

**输出示例**：
```
🔍 检测未翻译的中文: Wechat

📚 已定义翻译: 253 个字符串

❌ 未翻译: 205 个不同的字符串 (共 242 处)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 按文件分组:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 apps/Wechat/pages/settings/GeneralFlow.tsx (32 处)
   L 31: "已开启"
   L 31: "已关闭"
   L 37: "界面与显示"
   ...
```

**检测覆盖范围**：
- ✅ 双引号字符串：`"中文"`
- ✅ 单引号字符串：`'中文'`
- ✅ 模板字符串：`` `中文` ``（不含 `${}`）
- ✅ JSX 文本内容：`>中文<`

**自动过滤**：
- 单个汉字
- 纯注释行
- import/export 语句
- 过长字符串（>100 字符）
- data-*/aria-* 属性
- CSS 类名

**已知限制**：
- ❌ 跨行字符串
- ❌ 复杂模板字符串（含 `${}`）
- ⚠️ 会检测到 mock data（地址等），需手动判断

### 5. 其他相关脚本

```bash
# 解析反编译 APK 的 strings.xml
node scripts/parse_apk_strings.mjs <DecompiledApp>
node scripts/parse_apk_strings.mjs Weread_decompiled --match setting
node scripts/parse_apk_strings.mjs Weread_decompiled --compare WechatReading
```

---

## 最佳实践

### 1. 字符串命名

```typescript
// ✅ 好的命名
settings_dark_mode      // 模块_功能
chat_send_message       // 模块_动作_对象
profile_avatar          // 模块_字段

// ❌ 避免的命名
darkMode               // 缺少模块前缀
settings_1             // 无意义编号
btn_ok                 // 过于简短
```

### 2. 分组管理

```typescript
export const strings = {
  // ============================================================================
  // [common] - 通用高频字符串
  // ============================================================================
  common_cancel: '取消',
  
  // ============================================================================
  // [settings] - 设置相关
  // ============================================================================
  settings_title: '设置',
} as const;
```

### 3. 不需要翻译的内容

以下内容通常**不需要**国际化：
- 地址、位置数据（mock data）
- 国家/地区名称列表
- 用户生成内容（姓名、签名等）
- 专有名词（品牌名、产品名）

### 4. 静态分析兼容

翻译修改**不会影响**静态分析工具，因为：
- `bindTap()` 的 ID 参数仍是字符串字面量
- `navigation.declaration.ts` 保持不变
- 只修改运行时显示的 label 文本

---

## 常见问题

### Q: 模块级常量如何处理？

A: 将字符串改为 key 映射，在组件内用 `useMemo` 构建翻译后的数组。

### Q: 脚本检测到地址数据怎么办？

A: 地址、位置等 mock data 不需要翻译，可以忽略这些检测结果。

### Q: TypeScript 报错 `Cannot find name 't'`？

A: 确保在函数组件顶部添加了 `const t = useWechatStrings();`。

### Q: 如何处理带变量的字符串？

A: 使用字符串拼接：
```tsx
// strings.ts
friend_groups_count: '个',

// 组件
<span>{`${count}${t.friend_groups_count}`}</span>
```

或考虑使用模板函数（未来可扩展）。

### Q: 英文翻译可以部分完成吗？

A: 可以。`stringsEn` 使用 `Partial<Record<StringKey, string>>`，未翻译的 key 会自动 fallback 到中文。

---

## 使用反编译资源辅助翻译

项目包含反编译的官方 APK 资源（`decompiled/<App>_decompiled/`），可用于：

1. **参考官方 key 命名**
2. **验证字符串覆盖率**
3. **获取翻译建议**（key 名本身是英文语义）

### 解析脚本 `parse_apk_strings.mjs`

```bash
# 查看分组统计
node scripts/parse_apk_strings.mjs Weread_decompiled

# 查看特定前缀的字符串
node scripts/parse_apk_strings.mjs Weread_decompiled --match setting

# 与项目 strings.ts 对比
node scripts/parse_apk_strings.mjs Weread_decompiled --compare WechatReading
```

**对比模式输出**：

```
📚 共解析 1726 个中文字符串
📊 对比 WechatReading strings.ts (357 个)
✅ 值匹配: 193 个字符串

可参考官方 key 命名:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  "加入书架"
    项目 key: reader_add_to_shelf
    官方 key: add_to_shelf

  "已加入书架"
    项目 key: book_detail_added_to_shelf
    官方 key: added_shelf
```

**匹配模式输出**：

```bash
node scripts/parse_apk_strings.mjs Weread_decompiled --match setting

setting_about_app:
  中文: 关于微信读书
  建议: Setting About App

setting_about_business_cooperation:
  中文: 商务合作
  建议: Setting About Business Cooperation
```

### 利用方式

| 场景 | 操作 |
|------|------|
| 翻译一个新页面 | `--match <prefix>` 查看官方字符串 |
| 验证翻译覆盖率 | `--compare <AppName>` 对比差异 |
| 参考 key 命名 | 看官方 key，统一命名风格 |
| 快速翻译 | key 名即英文语义，直接参考 |

---

## 迁移进度跟踪

使用检测脚本跟踪进度：

```bash
# 查看当前状态
node scripts/detect_untranslated.mjs Wechat

# 输出示例
📚 已定义翻译: 253 个字符串
❌ 未翻译: 205 个不同的字符串
```

建议优先翻译：
1. 高频使用的字符串（出现 2+ 次）
2. 核心功能页面（设置、导航标题）
3. 用户直接可见的 UI 文本
