# Mobile-Gym 公开发布改进方案（总纲）

> 本目录包含 Mobile-Gym 从内部项目走向公开发布所需的完整改进方案。
> 审计时间：2026-03-02

## 项目现状评估

| 维度 | 现状 | 目标 |
|------|------|------|
| 安全合规 | `.env` 含真实 API Key 未 gitignore；无 LICENSE | 零泄露、MIT/Apache 2.0 许可 |
| 工程规范 | 无 lint/format/test/CI | 完整 CI 流水线、≥60% 核心覆盖率 |
| 架构健康度 | `__OS__` 每帧重建、SystemShell 1000 行、类型安全弱 | stable API proxy、组件拆分、strict TS |
| App 一致性 | 26 个 App 中 8 个无 navigation.declaration、部分直接用 navigate() | 100% 遵循统一模式 |
| 文档 | 面向内部/AI，缺少 Quick Start、API Ref、Contributing Guide | 完整文档站 |
| 生态 | 无 SDK、无 Playground、无 Leaderboard | 可扩展生态系统 |
| 部署 | 无 Docker、无版本管理 | 一键部署、semver 发布 |

## 方案文件索引

| 文件 | 优先级 | 内容 |
|------|--------|------|
| [`P0-security-and-legal.md`](./P0-security-and-legal.md) | **P0 — 发布前必须** | 密钥安全、LICENSE、品牌合规、包名修正 |
| [`P1-engineering-quality.md`](./P1-engineering-quality.md) | **P1 — 发布质量** | ESLint/Prettier、CI/CD、Docker、版本管理 |
| [`P1-architecture-refactor.md`](./P1-architecture-refactor.md) | **P1 — 发布质量** | `__OS__` stable proxy、SystemShell 拆分、类型安全加固 |
| [`P2-testing-strategy.md`](./P2-testing-strategy.md) | **P2 — 架构提升** | Vitest 引入、核心模块测试、E2E smoke test |
| [`P2-app-consistency.md`](./P2-app-consistency.md) | **P2 — 架构提升** | App 模式统一、脚手架、lint 规则 |
| [`P3-documentation.md`](./P3-documentation.md) | **P3 — 生态建设** | 文档站、API Reference、国际化、Contributing Guide |
| [`P3-ecosystem.md`](./P3-ecosystem.md) | **P3 — 生态建设** | Core 包拆分、App SDK、Playground、Agent Protocol |
| [`P3-benchmark-enhancement.md`](./P3-benchmark-enhancement.md) | **P3 — 生态建设** | Benchmark 标准化、Leaderboard、可观测性 |

## 总体路线图

```
Phase 0 — 安全准入（1~2 天）
  ├── .env 处理 + .gitignore 修复
  ├── 添加 LICENSE
  ├── package.json name 修正
  └── 品牌风险评估 + 免责声明

Phase 1 — 工程基建（1~2 周）
  ├── ESLint + Prettier 配置
  ├── GitHub Actions CI（typecheck + lint）
  ├── Dockerfile + docker-compose
  ├── __OS__ stable proxy 重构
  ├── SystemShell 组件拆分
  ├── TypeScript strict mode 渐进启用
  └── semantic versioning + CHANGELOG

Phase 2 — 质量加固（2~4 周）
  ├── Vitest 测试基础设施
  ├── 核心模块单元测试（≥60% 覆盖率）
  ├── E2E smoke test
  ├── 8 个缺失 App 的 navigation.declaration 补齐
  ├── 全量 App go()/back() 合规审计
  └── App 脚手架工具

Phase 3 — 生态起飞（持续）
  ├── VitePress 文档站
  ├── Web Playground 部署
  ├── @mobile-gym/core + @mobile-gym/app-sdk 拆分
  ├── Agent Protocol 标准化
  ├── Benchmark Leaderboard
  └── 国际化完善
```

## 工作量估算

| Phase | 预计人力 | 产出 |
|-------|---------|------|
| Phase 0 | 1 人 × 2 天 | 可安全公开的仓库 |
| Phase 1 | 2 人 × 2 周 | 工程级别的开源项目 |
| Phase 2 | 2 人 × 4 周 | 高质量的、可信赖的平台 |
| Phase 3 | 3 人 × 持续 | 有生态的社区项目 |
