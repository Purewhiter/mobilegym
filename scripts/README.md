# scripts

脚本按用途分组，根目录只保留项目常用入口。

## 根目录

- `build_nav_artifacts.mjs`
- `check_navigation_declaration_consistency.mjs`
- `navigation_declaration_analyzer.mjs`
- `generate_action_tasks_from_nav_graph.mjs`
- `nav_path_finder.py`
- `lint_store_getters.mjs`

这些是导航图、动作任务、状态 store 检查等正式开发入口。

## bench

Benchmark 运行结果统计、任务数量统计、judge 验证、run patch/rejudge 等实验辅助工具。

## migrate

保留少量仍有复用价值的资源迁移工具：

- `extract_app_hex_colors.mjs`：统计某个 App 中硬编码 hex 颜色的出现频次
- `migrate_app_theme_classes.mjs`：将与 manifest theme 精确相等的任意 hex Tailwind 类迁移到 `app-*` token
- `verify_migration_consistency.mjs`：资源迁移后，将变量展开并与 git 旧版本对比 className/style 一致性
- `tailwind-palette.json`：一致性验证使用的 Tailwind 色板

这组脚本默认用于人工迁移和审计，不属于日常开发/CI 入口。

## ime

输入法词库生成脚本。

## dev

开发辅助脚本，例如 dist 清理、App state schema 导出、主题资源准备、浏览器存储实验。

## reverse

APK、真机 UI、反编译资源抽取与相关分析脚本。开源清理时优先审查这一组。
