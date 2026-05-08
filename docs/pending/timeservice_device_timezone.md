# TimeService 设备时区支持

## 问题

当前 `TimeService` 没有时区概念，所有本地时间操作（`.getFullYear()`、`.getMonth()`、`.getDate()` 等）依赖**浏览器运行环境的本地时区**。

如果模拟器在非 UTC+8 的环境运行（如海外服务器、国外开发者本地），"今天是几号"的判定会与中国用户看到的不一致，导致：

- 天气 app 的日期平移 (`rehydrateLibraryDates`) 偏移 1 天
- 所有用 `toLocalDateKey()` 派生的"今天"标签错位
- `TimeService.getToday()` (用 `toISOString()` 取 UTC) 与 `formatDateCN()` (用本地时区) 在同一服务内就不一致
- bench 判定逻辑与前端显示可能看到不同日期

## 影响范围

不仅限于天气 app，整个项目凡是用 `.getFullYear()/.getMonth()/.getDate()/.getHours()` 的地方都隐含了"浏览器时区 = 设备时区"的假设。

## 方案

类似 Android 的 `persist.sys.timezone`，在 OS 层引入模拟设备时区：

1. **`TimeService` 增加 `deviceTimezone` 配置**（默认 `'Asia/Shanghai'`），可通过 `SIMULATOR_CONFIG` 或 `__SIM__` 设置
2. **提供时区感知的日期 API**，例如：
   - `toDeviceLocalDate(ts): { year, month, day, hours, ... }` — 按设备时区解析
   - `formatDeviceDate(ts, options)` — 按设备时区格式化
3. **全项目替换**裸 `.getFullYear()` 等调用为新 API
4. **修复 `getToday()`** — 当前用 `.toISOString().split('T')[0]` 取的是 UTC 日期，应改为设备时区

## 优先级

低。当前项目定位是模拟中国 Android 手机，实际运行环境大多在 UTC+8。仅在需要海外部署 bench 或支持多时区场景时再推进。
