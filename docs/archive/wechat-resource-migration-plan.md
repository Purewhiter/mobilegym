# 微信资源迁移方案

> 本文档记录微信 App 从硬编码值迁移到可替换资源（`res/`）的完整方案。
>
> **状态**：图标尺寸 ✅ | 颜色 ✅ | 字体/布局（任意值）✅ | 运行时 CSS 注入已修复 ✅

---

## 一、教训总结（之前的错误）

> ⚠️ 这些错误已经发生过，**必须避免重犯**。

### 错误 1：脚本范围失控
- **问题**：`fix_icon_sizes.mjs` 对所有 App 执行，而不是只针对微信
- **原因**：脚本没有命令行参数指定目标 App
- **解决**：所有迁移脚本必须：
  1. 支持 `--app <AppName>` 参数限定范围
  2. 默认不执行，必须显式指定目标

### 错误 2：重复 import 注入
- **问题**：迁移脚本多次添加 `import { dimens }`，导致 TypeScript 编译错误
- **原因**：脚本检查现有 import 的逻辑不完善
- **解决**：
  1. 迁移完成后必须运行 `fix_duplicate_imports` 清理
  2. 脚本应先检查是否已有 import，避免重复添加

### 错误 3：没有 dry-run 预览
- **问题**：直接执行脚本，出错后难以回滚
- **原因**：没有预览机制
- **解决**：
  - 所有脚本默认 dry-run 模式
  - 必须添加 `--execute` 参数才真正执行
  - 执行前必须先预览确认

### 错误 4：语义映射过于简单
- **问题**：`fix_icon_sizes.mjs` 只按数值映射，忽略语义
- **原因**：`size={20}` 在不同上下文可能是不同语义（菜单图标、勾选图标等）
- **解决**：必须按 **图标名称 + 尺寸值** 组合判断语义

### 错误 5：移除 import 逻辑有漏洞
- **问题**：`revert_icon_sizes.mjs` 错误移除了 `dimensToCssVars(dimens)` 需要的 import
- **原因**：只检查了 `dimens.` 模式，没考虑作为函数参数的情况
- **解决**：检查 `dimens` 是否被使用时，必须搜索整个标识符而不是前缀

### 错误 6：CSS 变量名格式不匹配
- **问题**：颜色迁移后页面出现多余分割线，border 颜色失效
- **原因**：
  - 脚本生成变量名用下划线：`tw_border_gray_100`
  - `toKebabCase()` 转换为连字符：`--app-c-tw-border-gray-100`
  - 但代码中使用下划线：`--app-c-tw_border_gray_100` ❌ 不匹配
- **解决**：
  1. 脚本生成的变量名必须使用连字符（`tw-border-gray-100`）
  2. 与 `toKebabCase()` 转换结果一致
  3. **规则**：CSS 变量名只用连字符，不用下划线

### 错误 7：透明度修饰符与 CSS 变量不兼容
- **问题**：`border-(--app-c-xxx)/50` 透明度不生效，分割线颜色异常
- **原因**：
  - Tailwind 的 `/50` 透明度修饰符在构建时计算
  - CSS 变量在运行时解析，无法参与构建时计算
  - `border-(--var)/50` 被忽略，显示默认 border 颜色
- **解决**：
  1. **不迁移带透明度的颜色类**（如 `border-gray-100/50`）
  2. 保留 Tailwind 原生语法，确保透明度正确渲染
  3. 脚本检测 `/[0-9]+` 后缀时跳过迁移

### 错误 8：字体大小变量未注入（TabBar 字体变大、标题变高）
- **问题**：dimens 迁移后，下方 TabBar 文字突然变大，上方标题栏视觉变高
- **原因**：`os/utils/themeToCssVars.ts` 中只为变量名 **以 `_size` 或 `size` 结尾** 的注入 `font-size` 规则；迁移脚本生成的变量如 `hintTextSize_10`、`titleTextSize_18` 以数字结尾，未命中条件，导致 `text-(--app-hint-text-size-10)` 等类没有对应 CSS
- **解决**：在 `themeToCssVars.ts` 的尺寸分支中，增加对变量名包含 `text_size` 或 `textsize` 的判定，统一注入 `injectFontSizeRule`

### 错误 9：w/h 布局类未注入（朋友圈/个人资料头像巨大）
- **问题**：朋友圈、个人资料页头像变得巨大
- **原因**：Tailwind v4 未为 `w-(--var)`、`h-(--var)` 这类任意 CSS 变量生成 width/height 规则，导致尺寸类不生效，容器无宽高约束，头像撑满父容器
- **解决**：在 `themeToCssVars.ts` 中为**所有非颜色尺寸变量**调用 `injectLayoutRules(cssVar)`，注入 `width`/`height`/`min-width`/`max-width`/`min-height`/`max-height` 六类规则，确保 `w-(--app-xxx)`、`h-(--app-xxx)` 等类正确生效

---

## 二、迁移检查清单

每次迁移前必须确认：

- [ ] **目标范围**：明确只迁移哪个 App（`--app Wechat`）
- [ ] **dry-run 预览**：先用 `--dry-run` 查看将要修改的内容
- [ ] **备份/提交**：迁移前确保 git 状态干净，可随时回滚
- [ ] **TypeScript 检查**：迁移后运行 `npx tsc --noEmit` 检查编译错误
- [ ] **重复 import 清理**：运行 `fix_duplicate_imports` 脚本
- [ ] **运行时验证**：启动 dev server 确认页面正常渲染

---

## 三、迁移进度

### 3.1 图标尺寸（已完成 ✅）

| 指标 | 状态 |
|-----|------|
| 硬编码 `size={N}` | 0 处 |
| 已迁移 `size={dimens.xxx}` | 198 处 |

**新增的 dimens 常量：**
```typescript
// 图标尺寸 - 按语义命名（camelCase 前缀 icSize）
icSizeTab: 24,          // Tab bar 图标
icSizeNav: 28,          // 导航返回图标
icSizeToolbar: 22,      // 工具栏/列表项图标
icSizeChevron: 18,      // 列表箭头
icSizeChevronSm: 16,    // 小型箭头
icSizeChevronLg: 20,    // 大型箭头
icSizePlusMenu: 20,     // 加号菜单图标
icSizeCheck: 20,        // 勾选图标
icSizePlaceholder: 48,  // 大型占位图标
icSizeHeartLg: 26,      // 大心形
icSizeHeartSm: 20,      // 小心形
icSizeTiny: 14,         // 小型状态图标
icSizeXs: 12,           // 超小图标
icSizeAddLarge: 36,     // 大型添加按钮
icSizeServiceGrid: 32,  // 服务网格图标
icSizeClose: 26,        // 关闭按钮
icSizeCloseLg: 28,      // 大关闭按钮
icSizeListIcon: 24,     // 列表项图标
icSizeWxidAdd: 13,      // 微信号旁加号
```

**迁移脚本：**
- `scripts/migrate/migrate_wechat_icon_sizes.mjs` — 按图标名称+尺寸智能映射
- `scripts/migrate/fix_duplicate_dimens_import.mjs` — 修复重复 import

**迁移方法论：**

1. **不要用通用脚本** — 按数值映射会丢失语义
2. **按"图标名+尺寸"组合判断** — 例如 `IcChevronRight size={18}` → `icSizeChevron`
3. **定义映射规则表**，示例：
   ```javascript
   const MAPPING_RULES = [
     { pattern: /IcNav\w+/, size: 28, dimens: 'icSizeNav' },
     { pattern: /IcTab\w+/, size: 24, dimens: 'icSizeTab' },
     { pattern: /IcChevron\w+/, size: 18, dimens: 'icSizeChevron' },
     // ...
   ];
   ```
4. **迭代式迁移** — 每次运行后检查剩余硬编码，补充新规则

---

### 3.2 颜色迁移（已完成 ✅）

| 指标 | 状态 |
|-----|------|
| 保值迁移（Tailwind 灰阶 + 任意 hex） | ✅ 已完成 |
| 透明度修饰符 | 不迁移，保留原生语法 |
| 运行时注入 | `themeToCssVars` 已支持 color/bg/border/placeholder/hover |

**脚本：** `scripts/migrate/migrate_colors_to_semantic.mjs`

```bash
# 预览（默认模式，安全！）
node scripts/migrate/migrate_colors_to_semantic.mjs --app=Wechat

# 执行迁移（需要显式 --execute）
node scripts/migrate/migrate_colors_to_semantic.mjs --app=Wechat --execute

# 详细模式（显示每处位置）
node scripts/migrate/migrate_colors_to_semantic.mjs --app=Wechat --verbose
```

**两层颜色架构：**

| 层级 | 定义位置 | 用途 | Tailwind 类名 |
|-----|---------|------|--------------|
| Tier-1 | `manifest.ts` | 语义主色 | `bg-app-surface`, `text-app-text` |
| Tier-2 | `res/colors.ts` | 组件级颜色 | `bg-(--app-c-xxx)` |

**安全映射（已自动执行 ✅）：**

| 原始 | 替换为 | 语义 | 状态 |
|-----|-------|------|------|
| `text-gray-900` | `text-app-text` | 主文字 → Tier-1 | ✅ |
| `text-gray-800` | `text-app-text` | 主文字 → Tier-1 | ✅ |
| `bg-white` | `bg-app-surface` | 卡片背景 → Tier-1 | ✅ |
| `border-gray-200` | `border-app-border` | 边框 → Tier-1 | ✅ |

**需要人工审核（脚本不自动迁移）：**

| 模式 | 数量 | 原因 | 建议处理 |
|-----|------|------|---------|
| `text-gray-500` | ~30 | 组标题/次要文字 | → `text-(--app-c-settings-group-title-text)` |
| `text-gray-400` | ~60 | 提示/禁用/占位 | → `text-(--app-c-common-text-hint)` 或保持 |
| `text-gray-300` | ~15 | 禁用/装饰 | 通常保持不变 |
| `text-gray-200` | ~5 | 极浅状态 | 保持不变 |
| `bg-gray-50` | ~50 | active 或浅背景 | → `active:bg-app-pressed-light` |
| `bg-gray-100` | ~25 | active 或分隔 | → `active:bg-app-pressed` |
| `bg-gray-200` | ~15 | Switch 关闭 | → `bg-(--app-c-switch-off)` |
| `border-gray-100` | ~60 | 细分割线 | → `border-app-border/50` |
| `border-gray-300` | ~10 | 较深边框 | → `border-app-border` |

**两种迁移策略：**

#### 策略 A：语义迁移（当前使用）

```bash
node scripts/migrate/migrate_colors_to_semantic.mjs --app=Wechat --execute
```

- ✅ 只迁移 100% 确定的（text-gray-900 → text-app-text）
- ⚠️ 可能存在视觉差异（App 颜色值可能与 Tailwind 不同）
- 📋 339 处需要人工审核

#### 策略 B：保值迁移（推荐，视觉零差异）

```bash
node scripts/migrate/migrate_colors_preserve_value.mjs --app=Wechat --execute
```

- ✅ **视觉零差异**（使用 Tailwind 原始 hex 值）
- ✅ **变量数量少**（16 个变量 vs 按页面拆分的上百个）
- 📋 后续审核时改为语义命名

**推荐流程：**
1. 先用策略 B 完成迁移（视觉不变）
2. 后续慢慢改为语义命名（tw_text_gray_400 → text_hint）
3. 最后统一合并相同语义的颜色

---

### 3.3 字体大小

已通过 **3.4 任意值迁移** 一并处理（`text-[Npx]` → `text-(--app-xxx)`）。语义命名常量见 `dimens.ts`（如 `settings_item_text_size`、`chat_list_item_time_size` 等）；迁移脚本生成的启发式变量见「任意值迁移」区块，后续可审核改为语义命名。

---

### 3.4 布局与字体尺寸（任意值迁移 ✅）

**目标：** 将 `h-[56px]`、`w-[48px]`、`text-[10px]` 等任意值替换为 CSS 变量引用。

**脚本：** `scripts/migrate/migrate_dimens_arbitrary.mjs`（启发式命名，数值入变量名保证唯一）

**运行时要求：** `os/utils/themeToCssVars.ts` 必须：
- 为包含 `textsize`/`text_size` 的尺寸变量注入 **font-size** 规则（避免 TabBar/标题字体异常）
- 为**所有**非颜色尺寸变量注入 **width/height/min-w/max-w/min-h/max-h** 规则（避免头像等布局尺寸失效）

详见上文「错误 8」「错误 9」。

---

## 四、脚本清单

### 4.1 通用脚本（所有 App 可用）

| 脚本 | 用途 | 用法 |
|-----|------|------|
| `migrate_colors_to_semantic.mjs` | 安全迁移确定的颜色 | `--app=Wechat --execute` |
| `migrate_colors_preserve_value.mjs` | 保值迁移灰阶（视觉零差异） | `--app=Wechat --execute` |
| `migrate_arbitrary_hex_colors.mjs` | 迁移任意 hex 颜色（如 `border-[#xxx]`） | `--app=Wechat --execute` |
| `migrate_dimens_arbitrary.mjs` | 迁移任意尺寸（h/w/text/min/max/gap/p 等） | `--app=Wechat --execute`，建议先 `--dry-run` |
| `verify_color_values.mjs` | 颜色值与 Tailwind/语义映射检查 | `--app=Wechat` |
| `verify_migration_consistency.mjs` | **迁移一致性（与 git 比，通用）**：变量展开为字面量后与旧代码 className/style 一一对比；适用于任意 App（需遵循项目 Tier-1 约定） | `--app=<AppName> [--before=HEAD~1] [--diff]` |

### 4.2 微信专用脚本

| 脚本 | 用途 | 说明 |
|-----|------|------|
| `migrate_wechat_icon_sizes.mjs` | 图标尺寸迁移 | 映射规则是微信特定的 |
| `fix_duplicate_dimens_import.mjs` | 修复重复 import | 微信专用清理 |

### 4.3 脚本规范

所有迁移脚本必须遵循：

```javascript
// 1. 必须支持 --app 参数
const targetApp = process.argv.find(a => a.startsWith('--app='))?.split('=')[1];
if (!targetApp) {
  console.error('必须指定 --app=<AppName>');
  process.exit(1);
}

// 2. 默认 dry-run，需要 --execute 才真正执行
const dryRun = !process.argv.includes('--execute');

// 3. 输出统计信息
console.log(`目标 App: ${targetApp}`);
console.log(`模式: ${dryRun ? '预览' : '执行'}`);
```

---

## 五、回滚方案

如果迁移出错：

```bash
# 方案 1：git 回滚单个 App
git checkout -- apps/Wechat/

# 方案 2：git stash 暂存当前改动
git stash

# 方案 3：写反向脚本（如 revert_icon_sizes.mjs）
node scripts/migrate/revert_icon_sizes.mjs --app=Wechat
```

---

## 六、验证命令

### 6.1 迁移一致性验证（与 git 旧代码一一对比）

**思路**：把当前代码里的变量全部替换成 res 中的**原始值**，把旧代码里的灰阶等规范成同一形式，再对比「展开/规范后的 className、style」是否一致（一一对应）。

```bash
node scripts/migrate/verify_migration_consistency.mjs --app=Wechat [--before=HEAD~1] [--diff]
```

**参数：**

| 参数 | 说明 |
|------|------|
| `--before=REF` | 对比的旧代码 git 引用，默认 `HEAD~1` |
| `--diff` | 输出首个不一致文件的详细差异（仅当前有 / 仅旧有） |

**验证方式：**

1. **当前**：从各文件提取所有 `className` / `style` 取值；将 `(--app-xxx)` 按 `res/colors.ts`、`res/dimens.ts` 展开为字面量（如 `h-(--app-item-height-88)` → `h-[88px]`，`text-(--app-c-tw-text-gray-400)` → `text-[#9ca3af]`）；未迁移的 `gray-X`、`bg-white` 等规范为与旧代码可比形式（如 `text-app-text`、`bg-app-surface`）。
2. **旧代码**：同一批 className/style 提取后，先做 Tier-1 与灰阶规范化（`text-gray-900` → `text-app-text`，`gray-X` → `[#hex]`），再对其中已有的 `(--app-xxx)` 做同样展开。
3. 每个文件内，将上述片段排序后逐条对比；一致则通过。

通过则输出「迁移一致性验证通过」；否则列出不一致文件，可加 `--diff` 查看具体差异。

**通用性**：脚本按 `--app=<AppName>` 扫描 `apps/<AppName>/` 及该 App 的 `res/colors.ts`、`res/dimens.ts`，与具体 App 名称无关。Tier-1 规范化（如 `bg-white`→`bg-app-surface`）依赖本仓库的 manifest 主题约定；其他 App 若采用相同约定，可直接使用同一命令（仅改 `--app=`）。

### 6.2 其他验证

```bash
# TypeScript 编译检查
npx tsc --noEmit --skipLibCheck 2>&1 | grep "apps/Wechat.*error"

# === 图标尺寸 ===
# 硬编码统计（目标：0）
grep -r "size={[0-9]" apps/Wechat --include="*.tsx" | grep -v "dimens\." | wc -l
# 已迁移统计
grep -r "size={dimens\." apps/Wechat --include="*.tsx" | wc -l

# === 颜色 ===
# 灰色系统计（需要人工审核的）
grep -r "text-gray-" apps/Wechat --include="*.tsx" | wc -l
grep -r "bg-gray-" apps/Wechat --include="*.tsx" | wc -l
grep -r "border-gray-" apps/Wechat --include="*.tsx" | wc -l
# Tier-1 语义颜色
grep -r "bg-app-surface" apps/Wechat --include="*.tsx" | wc -l
grep -r "text-app-text" apps/Wechat --include="*.tsx" | wc -l

# === 布局尺寸 ===
grep -r "h-\[.*px\]" apps/Wechat --include="*.tsx" | wc -l
grep -r "w-\[.*px\]" apps/Wechat --include="*.tsx" | wc -l

# === 字体 ===
grep -r "text-\[.*px\]" apps/Wechat --include="*.tsx" | wc -l
```

---

## 七、总结

### 已完成

| 类型 | 完成状态 | 说明 |
|-----|---------|------|
| 图标尺寸 | ✅ | 198 处迁移，0 处硬编码 |
| 颜色 | ✅ | 保值灰阶 + 任意 hex，透明度类不迁移 |
| 布局/字体任意值 | ✅ | `migrate_dimens_arbitrary.mjs` 启发式迁移 |
| 运行时 CSS 注入 | ✅ | font-size + w/h/min/max 规则（见错误 8、9） |

### 后续可选

| 类型 | 说明 |
|-----|------|
| 语义命名 | 启发式变量可逐步改为语义名（如 `avatarWidth_44` → 语义常量） |
| 颜色语义化 | `tw-*` 等可合并为语义 token |

### 关键原则

1. **先预览，再执行** — 所有脚本默认 dry-run
2. **限定范围** — 必须指定 `--app=Wechat`
3. **语义优先** — 不能纯按数值映射
4. **保守迁移** — 不确定的不改
5. **验证闭环** — 迁移后必须 TypeScript 检查 + 运行时验证
