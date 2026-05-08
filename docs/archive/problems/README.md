# 模拟器代码问题清单

本目录记录了对模拟器代码库（不含 bench_env）的全面审查结果。

## 文件结构

| 文件 | 内容 |
|------|------|
| [os-layer.md](./os-layer.md) | OS 层架构、设计、实现问题 |
| [apps-layer.md](./apps-layer.md) | Apps 层一致性、导航、状态管理问题 |
| [data-resources.md](./data-resources.md) | 数据架构、资源规范、类型安全问题 |
| [scripts-config.md](./scripts-config.md) | 脚本、配置、全局 API 问题 |
| [misc.md](./misc.md) | 其他问题（localStorage、网络、XSS、不确定性等） |

---

## 优先级总结

### 高优先级（阻断 benchmark / 架构缺陷）

1. **8 个 app 无导航声明**，无法生成任务图
   - Browser, Calculator, Calendar, Clock, Gallery, Notes, Sms, ThemeStore

2. **8 个 app 零手势标签**，agent 无法操作
   - 同上列表

3. **OSContext 直接导入 app state**，跨层耦合
   - `os/OSContext.tsx:34-35`

4. **navigation.ts 3170 行重复代码**，应抽取为工厂
   - 15 个 app 复制近乎相同逻辑

5. **Weather 三重持久化**，存在数据一致性风险
   - state.ts + weatherStore.ts + 废弃的 cityManagerStore.ts

6. **TypeScript strict 模式未启用**
   - `tsconfig.json` 缺少 noImplicitAny, strictNullChecks

### 中优先级（违反规范 / 维护困难）

7. **图标命名未用 Ic* 前缀**（5处）
   - Map, TencentMeeting, Ebay, Sms, Wechat

8. **constants vs defaults 边界混淆**（Alipay 最严重）
   - 静态服务目录放在 defaults.json

9. **业务页面直接用 useNavigate**
   - Calendar、Notes、Weather、Sms 全部页面

10. **超大单文件**
    - ExplorePage 4404 行, Clock 1716 行, Gallery 1372 行

11. **Spotify 绕过 NetworkService**
    - 直接 fetch iTunes API

### 低优先级（代码质量 / 清理）

12. 废弃代码 cityManagerStore.ts
13. App 内脚本/工具文件未分离（Reddit data/、X scripts/）
14. console.log 占位按钮（Spotify）
15. 导入路径风格不一致

---

## 统计概览

| 类别 | 数量 |
|------|------|
| 高严重度问题 | 16 |
| 中严重度问题 | 22 |
| 低严重度问题 | 15 |
| 受影响 App 数 | 18/26 |
| 需重构的超大文件 | 3 |
| 重复代码行数 | ~3500+ |

---

*审查日期: 2026-03-02*
