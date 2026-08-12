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

## lib

导航工具链共享库（无状态纯函数模块，被上面的 CLI 入口 import）：

- `declaration_loader.mjs`：TS 转译 + vm 求值加载 `navigation.declaration.ts` / 数据配置；analyzer 与一致性检查器共用，保证两个读者对声明内容永远一致
- `nav_graph_schema.mjs`：图 JSON 的 schemaVersion 常量与结构校验（`nav_path_finder.py` 在 Python 侧镜像同一套校验）
- `nav_ref_resolver.mjs`：dataSource ref 路径 DSL——token 解析、四种取数模式、filterFn 动态求值
- `nav_condition_eval.mjs`：12-op 条件求值，返回 satisfied/evaluable 三态
- `nav_graph_core.mjs`：图元语义——search 归一化/序列化、节点 ID 构造与解析、from 约束匹配与通配展开、entryPoint 归一化、边类型
- `nav_schema_graph.mjs`：声明 → schema 图（buildGraph 含重复边告警与去重）+ 路由级简化图
- `nav_data_expand.mjs`：数据模式 two-pass 边/节点展开（dataSource + 参数继承）
- `nav_graph_prune.mjs`：条件裁剪 + 可达性裁剪

## bench

Benchmark 运行、任务审计、judge 验证工具。

- `bench_real_device.sh`：真机 / ADB sim2real 评测入口，读取 `bench_env/splits/sim2real_instructions.json`
- `examples.sh`：常用 `bench_env.run` 命令示例，默认不执行
- `audit/`：任务审计工具，包括 judge 验证、任务数量统计、任务索引更新

## ime

输入法词库生成脚本。

## dev

开发辅助脚本，例如 dist 清理、App state schema 导出、主题资源准备、浏览器存储实验。

## server

Nginx + API gateway 生产服务入口。`start_nginx_gateway.sh` 启动静态资源服务和 `/api/gw/*` 后端网关，`api_gateway.py` 提供 Starlette 转发服务。

## reverse

APK、真机 UI、反编译资源抽取与相关分析脚本。开源清理时优先审查这一组。
