# 资源清理脚本使用指南

本文档记录 `colors.ts` 和 `dimens.ts` 资源文件的分析与清理脚本。

## 脚本列表

| 脚本 | 用途 |
|------|------|
| `analyze_colors_usage.mjs` | 分析各应用 colors.ts 使用情况 |
| `cleanup_unused_colors.mjs` | 清理未使用的颜色定义 |
| `analyze_dimens_usage.mjs` | 分析各应用 dimens.ts 使用情况 |
| `cleanup_unused_dimens.mjs` | 清理未使用的尺寸定义 |

## 使用方法

### 分析颜色使用情况

```bash
node scripts/migrate/analyze_colors_usage.mjs
```

输出示例：
```
### Alipay
定义: 33, 使用: 0 (0%)
  ❌ 未使用: 33 个

### Wechat [跳过 - 已迁移]
```

### 清理未使用颜色

```bash
# 预览模式（不修改文件）
node scripts/migrate/cleanup_unused_colors.mjs

# 执行清理
node scripts/migrate/cleanup_unused_colors.mjs --execute
```

### 分析尺寸使用情况

```bash
# 分析所有应用
node scripts/migrate/analyze_dimens_usage.mjs

# 分析单个应用
node scripts/migrate/analyze_dimens_usage.mjs --app=Alipay

# 显示未使用项详情
node scripts/migrate/analyze_dimens_usage.mjs --unused
```

### 清理未使用尺寸

```bash
# 预览模式
node scripts/migrate/cleanup_unused_dimens.mjs --app=Alipay

# 执行清理
node scripts/migrate/cleanup_unused_dimens.mjs --app=Alipay --execute

# 批量清理所有应用
for app in Alipay Bilibili Browser ...; do
  node scripts/migrate/cleanup_unused_dimens.mjs --app=$app --execute
done
```

## 检测逻辑

### Colors 检测方式

脚本检测以下两种使用方式：

1. **CSS 变量引用**: `--app-c-{kebab-name}`
   ```tsx
   className="text-(--app-c-tw-text-slate-800)"
   ```

2. **直接引用**: `colors.{name}` 或 `colors['{name}']`
   ```tsx
   color={colors.tab_selected}
   color={colors['tw-text-slate-800']}
   ```

### Dimens 检测方式

1. **直接引用**: `dimens.{name}`
2. **CSS 变量引用**: `--app-{kebab-name}`

## 跳过规则

以下应用已完成资源迁移，脚本会自动跳过：

- `Wechat`
- `WechatReading`

如需添加更多跳过应用，修改各脚本中的 `SKIP_APPS` 数组。

## 清理规则

1. **不删除文件**: 即使清理后 colors/dimens 为空，也保留文件结构（避免 import 报错）
2. **保留 icSize***: dimens 清理会保留所有 `icSize*` 前缀的图标尺寸定义
3. **保留 rgba 颜色**: colors 清理只处理 `#hex` 格式的颜色，`rgba()` 格式保留

## 2026-02-22 清理记录

### 修复的 Bug

1. **正则匹配问题**: 原脚本只能匹配 `key: '#xxx'` 格式，无法匹配带引号的 key `'tw-text-slate-800': '#xxx'`
   - 修复后支持：无引号 key、单引号 key、双引号 key

2. **res 目录排除问题**: 原脚本排除了 `res/` 目录扫描，导致 `res/icons.tsx` 中的引用被漏检
   - 影响：XiaomiNotes 的 `tab_selected` 被误删

### 清理结果

- **Colors**: 移除 754 个未使用颜色定义
- **Dimens**: 清理未使用的布局尺寸，保留 icSize* 和实际使用项
- **跳过**: Wechat, WechatReading（已完成迁移）

### 验证

清理后执行 `npx tsc --noEmit` 编译通过，无类型错误。
