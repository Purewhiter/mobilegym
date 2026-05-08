# 系统网络服务（NetworkService）与统一网关（/api/gw）使用说明

本项目运行在浏览器里模拟手机系统。浏览器有 **CORS（跨域）** 限制，而真实手机原生 App 没有。为获得“像真实手机一样”的网络体验，我们提供了：

- 系统网络服务：`os/NetworkService.ts`
- 同源网关：`vite.config.ts` 中间件（`/api/gw/*`）

目标：**所有 App 不需要再为 CORS 单独写代理**，统一走系统网络服务即可。

---

## 1. 你应该怎么写网络请求

### 1.1 推荐：统一用 `netFetch/netJson/netText`

- `netFetch(url, init)`：返回 `Response`
- `netJson<T>(url, init)`：自动解析 JSON，非 2xx 抛错（包含部分响应文本用于排查）
- `netText(url, init)`：读取文本

使用示例：

```ts
import { netJson } from '@/os/NetworkService';

const data = await netJson('https://example.com/api/foo', {
  headers: { 'x-foo': 'bar' },
});
```

### 1.2 什么时候可以直接 `fetch`

- 同源请求（相对路径，例如 `/api/list-public-files`、`/sdcard/...`）
- 静态资源直连（图片/视频等）：优先用 `<img src="...">` / `<video src="...">`

> 说明：静态资源通常不需要 JS `fetch`，而且直连 CDN 性能更好。

---

## 2. `NetworkService` 如何规避 CORS（工作原理）

`netFetch` 会按 URL 类型自动选择：

- **相对路径**：直接浏览器 `fetch`（同源，不触发 CORS）
- **绝对 URL（http/https）**：自动走同源网关
  - `body` 为 **string**（JSON/text）：走 `POST /api/gw/fetch`
  - `body` 为 **FormData/Blob/ArrayBuffer/流**：走 ` /api/gw/proxy?url=...`（请求/响应都流式转发）

这样对 App 来说，“访问外部域名”不会再被浏览器 CORS 卡住。

---

## 3. Cookie（像原生 App 的“cookie jar”）

浏览器跨域时，`fetch` 很难可靠携带/设置第三方 cookie；而很多站点/接口需要 cookie 维持登录态。

网关实现了 **服务端 cookie jar（按会话隔离）**：

- 前端会自动给每个浏览器生成 `x-gw-session`（存 `localStorage`）
- 网关按 session 维护 `cookie jar`
  - 收到上游 `Set-Cookie` 会保存
  - 后续请求会自动加上 `Cookie`

这模拟了“原生 App 的 cookie 存储”，对需要 cookie 的接口兼容性更强。

> 注意：如果你在请求里自己显式设置了 `Cookie` header，网关会尊重你的 header（不再自动补 cookie jar）。

---

## 4. Header 转发策略（兼容性注意）

网关会过滤 hop-by-hop headers（如 `connection/transfer-encoding/upgrade/host` 等），避免协议层问题。

对于响应头，网关会转发一组“安全且常用”的头（如 `content-type/cache-control/etag/...`），并**避免转发 `content-encoding/content-length`**，防止“上游自动解压但 header 仍写 gzip”导致浏览器报 `Failed to fetch`。

如果你遇到“下载文件名缺失”等问题，需要补转发的头（例如 `content-disposition`），可以在网关里扩展 allowList。

---

## 5. 性能建议

- **API JSON**：优先 `netJson`，开销很小（本机多一跳转发）
- **大文件/上传/流**：用 `netFetch` + 非字符串 body（会自动走 `/api/gw/proxy` 流式），避免内存爆
- **高频请求**：加缓存/节流
  - 天气已在 `Weather` 做了 5 分钟 bundle 缓存（L1 内存 + L2 localStorage）
  - 反地理编码已做 10 分钟缓存（同上）

---

## 6. 常见问题排查

### 6.1 “Missing service in path”

说明你访问了 `/api/gw/...` 但路径不符合，或 dev server 未重启导致旧中间件还在跑。先重启 `npm run dev`。

### 6.2 “Failed to fetch / incorrect header check”

通常是 gzip 相关的 header/body 不一致问题。当前网关已规避（强制 `accept-encoding: identity` + 不转发 `content-encoding`）。

### 6.3 429 Too Many Requests（第三方限流）

需要缓存/退避：

- 应用侧缓存（如天气 bundle）
- 或网关侧全局缓存（后续可加）

---

## 7. 给新 App 的最小规范（建议）

- 访问外部 API：统一用 `netJson/netFetch`
- 图片/视频：优先直接 `<img>/<video>`，除非需要鉴权/风控才走网关
- 需要登录态：依赖网关 cookie jar，不要自己在浏览器里硬塞第三方 cookie

