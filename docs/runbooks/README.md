# Runbooks

操作性诊断/修复文档。每篇聚焦一个具体故障现象,包含:

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
| 256 envs 跑得通但比 128 envs 还慢,`reset.wait_ready` / `warm` / `infer` 随并发恶化 | [bench-256-envs-slow.md](./bench-256-envs-slow.md) |
| vLLM `--data-parallel-size N` 部署下一张 GPU 满载 KV 99%、其他闲在 10%(长 stream 工作负载) | [vllm-dp-imbalance.md](./vllm-dp-imbalance.md) |
| 多进程 runner + contexts 隔离下准确率低 4-5%,`_post_sample` 注入的 seed 没生效(已知未修) | [bench-multiprocess-contexts-state-race.md](./bench-multiprocess-contexts-state-race.md) |
