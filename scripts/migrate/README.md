# migrate

这个目录只保留仍有复用价值的资源迁移辅助脚本。

- `extract_app_hex_colors.mjs <AppName|path>`：统计 App 内 Tailwind 任意 hex 类和 SVG `fill/stroke` hex 的频次。
- `migrate_app_theme_classes.mjs <AppName|path> [--execute]`：把与 `manifest.ts` 中 `theme.colors` 精确匹配的 `bg-[#...]`、`text-[#...]`、`border-[#...]` 等类替换为语义化 `app-*` 类。默认 dry-run。
- `verify_migration_consistency.mjs --app=<AppName|path> [--before=REF] [--diff]`：把当前代码中的资源变量展开后，与 git 旧版本的 `className` / `style` 片段做规范化对比。
- `tailwind-palette.json`：供一致性验证脚本使用。

已删除的旧脚本大多是一次性迁移说明、过时的 `colors.ts` / `dimens.ts` 清理器，或与当前资源规范冲突的检查。
