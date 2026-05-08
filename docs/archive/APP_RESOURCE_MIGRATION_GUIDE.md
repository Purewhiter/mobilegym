# App 资源迁移指南（简化版）

> 本指南基于 Wechat 迁移经验，提供一个**最小化、语义正确**的迁移方案。
> 
> **核心原则**：只迁移语义明确的，不为凑数而错误映射，尽量不新增变量。

---

## 一、迁移范围

| 类型 | 优先级 | 策略 |
|-----|-------|------|
| **图标尺寸** | P1 | 只迁移语义明确的（约 50-70%） |
| **颜色** | P2 | 保值迁移或暂不迁移 |
| **布局尺寸** | P3 | 暂不迁移（除非有 JS 计算） |
| **字符串** | 必须 | 多语言需求 |

---

## 二、图标尺寸迁移

### 2.1 通用 icSize 常量（各 App 应已有）

```ts
// 这些常量大部分 App 已定义，无需新增
icSizeTab: 24,       // TabBar 图标
icSizeNav: 24,       // Header 导航（返回、关闭、更多）
icSizeToolbar: 22,   // 工具栏图标
icSizeChevron: 16,   // 列表小箭头
icSizeChevronLg: 18, // 列表大箭头
icSizeService: 28,   // 服务网格图标
icSizeAction: 18,    // 内联操作图标
```

### 2.2 按场景可选新增（中等方案）

```ts
// 只在需要时新增，不强制
icSizeCheck: 20,     // 选中勾（设置页单选）
icSizeBtnIcon: 18,   // 按钮内图标（CTA 按钮里的小图标）
```

### 2.3 迁移规则表（按图标名称 + 位置）

| 图标名称 | 位置特征 | 映射到 |
|---------|---------|-------|
| `IcNavBack` | Header 左侧 | `icSizeNav` |
| `IcClose` | Header/Modal 右上 | `icSizeNav` |
| `IcMore`/`IcMoreHorizontal` | Header 右侧 | `icSizeNav` |
| `IcNavForward`/`IcChevronRight` | 列表行尾 | `icSizeChevron` 或 `icSizeChevronLg` |
| `IcCheck` | 设置页选中状态 | `icSizeCheck`（新增）或保持硬编码 |
| `IcSearch` | 搜索框内 | `icSizeAction` |
| 服务网格图标 | HomePage grid | `icSizeService` |
| TabBar 图标 | 底部 TabBar | `icSizeTab` |

### 2.4 不迁移的情况

以下情况保持硬编码：

1. **语义不明确**：功能入口图标（如 BalancePage 的 `IcTransfer size={24}`）
2. **特殊尺寸**：QR 码（192px）、大占位图（48px+）
3. **按钮内装饰**：CTA 按钮里的小图标（除非新增 `icSizeBtnIcon`）
4. **同一图标多处不同尺寸**：如果 `IcTransfer` 在不同位置用 18/24/28，只迁移语义明确的那个

---

## 三、颜色迁移

### 3.1 推荐策略：暂不迁移或保值迁移

**原因**：
- 透明度修饰符（`/50`）与 CSS 变量不兼容
- Tailwind 灰阶数量多、迁移工作量大
- 视觉一致性风险高

**如果必须迁移**，使用保值迁移（视觉零差异）：

```bash
node scripts/migrate/migrate_colors_preserve_value.mjs --app=<AppName> --execute
```

### 3.2 安全迁移（已在用的语义色）

这些 Tier-1 主题色大部分 App 已在使用，确认已覆盖即可：

| Tailwind 原生 | 语义替换 | 说明 |
|--------------|---------|------|
| `text-gray-900` | `text-app-text` | 主文字 |
| `bg-white` | `bg-app-surface` | 卡片背景 |
| `border-gray-200` | `border-app-border` | 边框 |
| `bg-blue-500` (主色) | `bg-app-primary` | 主色 |

### 3.3 不迁移的颜色

- 带透明度的：`border-gray-100/50`、`bg-black/30`
- 灰阶变体：`text-gray-400`、`text-gray-500`（语义不明确）
- active 状态：`active:bg-gray-100`

---

## 四、迁移脚本使用

### 4.1 图标尺寸迁移

```bash
# 1. 预览（默认 dry-run，不修改文件）
node scripts/migrate/migrate_icon_sizes.mjs --app=<AppName>

# 2. 查看详细匹配（看哪些被跳过及原因）
node scripts/migrate/migrate_icon_sizes.mjs --app=<AppName> --verbose

# 3. 执行迁移
node scripts/migrate/migrate_icon_sizes.mjs --app=<AppName> --execute

# 4. 批量预览所有 App
for app in Alipay Spotify Railway12306 Clock Gallery Settings; do
  echo "=== $app ===" && node scripts/migrate/migrate_icon_sizes.mjs --app=$app 2>&1 | grep -E "(总数|可迁移)"
done
```

**脚本特性**：
- 动态读取 App 的 `dimens.ts`，根据已有常量的**实际值**匹配
- 优先使用语义明确的规则（如 `IcNavBack` → `icSizeNav`）
- 不会映射语义不明确的图标（功能入口、装饰图标等）
- 自动添加 `import { dimens }` 语句

### 4.2 验证 dimens 定义覆盖率

```bash
# 检查 App 的 dimens 定义是否覆盖代码中实际使用的尺寸
node scripts/migrate/verify_dimens_coverage.mjs --app=<AppName>

# 检查所有 App 并输出汇总
node scripts/migrate/verify_dimens_coverage.mjs
```

### 4.3 迁移后验证

```bash
# TypeScript 检查
npx tsc --noEmit --skipLibCheck 2>&1 | grep "apps/<AppName>.*error"

# 统计硬编码剩余
grep -r "size={[0-9]" apps/<AppName> --include="*.tsx" | grep -v "dimens\." | wc -l

# 统计已迁移
grep -r "size={dimens\." apps/<AppName> --include="*.tsx" | wc -l

# 启动 dev server 验证
npm run dev
```

---

## 五、迁移检查清单

每个 App 迁移前确认：

- [ ] **git 状态干净**：可随时回滚
- [ ] **dry-run 预览**：先看将改什么
- [ ] **限定范围**：`--app=<AppName>` 不影响其他 App
- [ ] **TypeScript 检查**：迁移后无编译错误
- [ ] **运行时验证**：页面渲染正常

---

## 六、各 App 迁移进度模板

```markdown
## <AppName> 迁移状态

### 图标尺寸
- [ ] 总数：___ 处
- [ ] 可迁移（语义明确）：___ 处
- [ ] 已迁移：___ 处
- [ ] 保持硬编码：___ 处

### 颜色
- [ ] 策略：暂不迁移 / 保值迁移
- [ ] Tier-1 语义色已覆盖

### 新增常量
- [ ] 无 / icSizeCheck / icSizeBtnIcon / ...
```

---

## 七、经验教训（来自 Wechat）

### 必须避免的错误

1. **纯按数值映射**：`size={24}` 不一定是 `icSizeTab`，要看上下文
2. **重复 import**：迁移脚本可能多次注入 `import { dimens }`
3. **透明度颜色**：`border-gray-100/50` 不能迁移到 CSS 变量
4. **CSS 变量名格式**：必须用连字符（`--app-c-xxx`），不用下划线

### 正确做法

1. **按图标名 + 位置判断**：`IcNavBack` 在 Header → `icSizeNav`
2. **不确定就不改**：保持硬编码比错误映射好
3. **先预览再执行**：所有脚本默认 dry-run
4. **小步迭代**：每次运行后检查，补充映射规则

---

## 八、预期结果

### 图标迁移率统计（测试结果）

| App | 总数 | 可迁移 | 比例 |
|-----|------|--------|------|
| Railway12306 | 112 | 90 | **80.4%** |
| Sms | 15 | 12 | **80.0%** |
| Gallery | 47 | 35 | 74.5% |
| Alipay | 211 | 147 | 69.7% |
| Clock | 31 | 21 | 67.7% |
| Spotify | 146 | 93 | 63.7% |
| FileManager | 28 | 17 | 60.7% |
| Notes | 7 | 4 | 57.1% |
| XiaomiNotes | 46 | 24 | 52.2% |
| Browser | 6 | 3 | 50.0% |
| Bilibili | 5 | 2 | 40.0% |
| Settings | 25 | 9 | 36.0% |
| X | 76 | 26 | 34.2% |
| Calendar | 10 | 3 | 30.0% |
| Contacts | 5 | 5 | 100.0% |
| Ebay | 1 | 1 | 100.0% |

**说明**：
- 迁移率 > 60% 的 App 适合直接执行迁移
- 迁移率 < 40% 的 App（如 Settings、X）主要是因为有大量功能装饰图标（设置项图标、社交操作等），这些语义不明确，保持硬编码更合理
- Wechat/WechatReading/Weather/Map/Douban 等已完成迁移（总数为 0）

---

## 九、后续可选工作

以下工作不在本次范围，未来按需推进：

1. **颜色语义化**：`tw-text-gray-400` → `text-hint`
2. **布局尺寸迁移**：`h-[56px]` → `h-(--app-item-h)`
3. **动画资源化**：`duration-300` → `var(--app-duration-medium)`
4. **深色模式完善**：`colorsDark` 完整填充
