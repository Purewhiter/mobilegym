# scripts

脚本按用途分组，根目录只保留项目常用入口。

## 根目录

- `lint_store_getters.mjs`
- `explore_nav_graph.py`：在运行中的模拟器上逐个点击带标签的元素，记录点击和随后返回各落到哪个 URL；`--diff` 比较两个构建的导航图（用于导航改动前后对拍，见 `docs/platform/navigation/routes.md`）

这些是导航图探索、状态 store 检查等正式开发入口。

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
