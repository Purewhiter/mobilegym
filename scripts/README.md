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

Benchmark 运行、任务审计、judge 验证、离线复判和性能实验工具。

- `bench_real_device.sh`：真机 / ADB sim2real 评测入口，读取 `bench_env/splits/sim2real_instructions.json`
- `examples.sh`：常用 `bench_env.run` 命令示例，默认不执行
- `rejudge_vlm_run.py`：基于已保存 trajectory 的离线 VLM 复判
- `audit/`：任务审计工具，包括 judge 验证、任务数量统计、任务索引更新
- `generate/`：action task spec / generated task 生成工具
- `perf/`：LLM 吞吐和浏览器内存等性能实验工具

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

## server

Nginx + API gateway 生产服务入口。`start_nginx_gateway.sh` 启动静态资源服务和 `/api/gw/*` 后端网关，`api_gateway.py` 提供 Starlette 转发服务。

## reverse

APK、真机 UI、反编译资源抽取与相关分析脚本。开源清理时优先审查这一组。
