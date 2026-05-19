# Runbooks

操作性诊断 / 修复文档。每篇聚焦一个具体故障现象,包含:

1. **症状**(怎么知道是这个问题)
2. **根因**(背后是什么)
3. **诊断命令**(快速验证)
4. **修复**(短期 workaround + 长期治本)
5. **已尝试无效的方法**(避免下次重蹈)

适用读者:遇到 bench / 部署 / 启动 / 性能问题时,**先在这里查**。

## 索引

| 现象 | 文档 |
|---|---|
| `_wait_ready phase=__SIM__ timeout` 在 `--parallel ≥ 192` 时大量出现,CPU/GPU/网络都不饱和 | [bench-inotify-limit.md](./bench-inotify-limit.md) |

> 几篇内部部署相关的 runbook(大规模 vLLM 调优、多进程 contexts 隔离的已知 bug 等)已迁移至 [`docs/archive/internal-2026/`](../archive/internal-2026/),不再属于公开文档路径。
