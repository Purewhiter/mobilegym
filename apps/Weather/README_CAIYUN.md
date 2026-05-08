# 天气（Weather）- 彩云天气 API v2.6 接入文档（历史方案）

> 说明：Weather App 当前主数据源已经切换为 **和风天气（QWeather）**。本文档仅保留为历史调研资料，方便回溯彩云字段设计与旧实现思路。

本文档用于把“天气”App 的数据源切换到 **彩云天气 API v2.6**，并覆盖你截图里的全部信息展示需求：实时天气、未来小时/天预报、空气质量、生活指数、日出日落、（可选）分钟级降水与天气预警。

> 重要说明：彩云的 **分钟级预报（minutely）** 与 **预警（alert）** 在 v2.6 文档中均标注为 **增值/付费能力**。若你的套餐不包含它们，下面会给出降级方案。

---

## 1. 选择 v2.6 的调用方式（推荐：App Key & App Secret）

彩云 v2.6 支持两种认证：

- **App Key & App Secret（推荐）**：URL 路径用 `{app_key}`，并在 Header 里带签名（更安全）
- **Token（不建议）**：URL 路径用 `{token}`，存在泄漏风险

官方鉴权文档：`https://docs.caiyunapp.com/weather-api/v2/v2.6/auth.html`

### 1.1 Base URL 与坐标顺序

基础格式（综合接口举例）：

`https://api.caiyunapp.com/v2.6/{app_key}/{longitude},{latitude}/weather?...`

注意坐标顺序是：**经度在前、纬度在后**（`lon,lat`）。

### 1.2 App Key & App Secret 签名（v2.6）

请求头：

- `x-cy-nonce`：随机字符串（16-40 位，建议 UUID），每次请求不可重复
- `x-cy-timestamp`：Unix 秒级时间戳（过旧可能被拒绝）
- `x-cy-signature`：签名

签名步骤（按官方描述整理）：

1) 若有 query 参数：把 query **按字母排序**，拼成 `k=v&k2=v2...`（并做 URL encode）

2) 构造签名串：

\[
stringToSign = "{method}:{path}:{query}:{app\_key}:{nonce}:{timestamp}"
\]

- `method`：目前仅 GET
- `path`：**包含 app_key 的完整路径**，例如 `/v2.6/your_app_key/116.3176,39.9760/weather`
- `query`：没有 query 时为空字符串（注意仍保留 `::` 的占位）

3) 用 `app_secret` 做密钥，计算 `HMAC-SHA256(stringToSign)`

4) 对哈希结果做 **URL Safe Base64**，得到 `x-cy-signature`

### 1.3 Token 方式（仅用于快速联调）

`https://api.caiyunapp.com/v2.6/{token}/{longitude},{latitude}/weather`

本仓库当前实现（`apps/Weather/services/weatherService.ts`）使用 **Token 方式**，并要求你在本地设置：

- `.env.local`（推荐，已被 gitignore 的 `*.local` 覆盖，不会提交）
  - `VITE_CAIYUN_TOKEN=...`

你可以复制仓库根目录的 `.env.local.example` 为 `.env.local` 再填写 token。

---

## 2. 推荐的接口组合（一个接口拿齐绝大多数数据）

### 2.1 综合接口（weather）——优先使用

文档：`https://docs.caiyunapp.com/weather-api/v2/v2.6/6-weather.html`

一次返回打包数据：

- `result.realtime`：实时
- `result.hourly`：小时级（可配步长）
- `result.daily`：天级（可配步长，最多 15 天）
- `result.minutely`：分钟级（**增值**，若套餐不含会不可用/为空）
- `result.alert`：预警（**付费**，需 `alert=true`）

典型请求（按你截图所需最常用配置）：

- `hourlysteps=24`：小时级取 24 小时
- `dailysteps=15`：天级取 15 天（用于“查看近15日天气”与温度范围条）
- `alert=true`：取预警（若没购买可不传）

示例（把 `{app_key}` 换成你的，并加签名头）：

`GET /v2.6/{app_key}/{lon},{lat}/weather?dailysteps=15&hourlysteps=24&alert=true`

---

## 3. 单位/字段口径（实现 UI 时最容易踩坑的点）

### 3.1 单位制（unit）

文档：`https://docs.caiyunapp.com/weather-api/v2/v2.6/tables/unit.html`

- 默认 `unit=metric`
- **风速**：默认公制下为 `km/h`
- **气压**：`Pa`（帕），UI 常用 `hPa`（百帕）需换算
- **湿度**：`0~1` 的小数，UI 要展示百分比
- **分钟级降水**：默认返回“雷达降水强度(0~1)”；如要“mm/h”，需 `unit=metric:v2`

### 3.2 关键换算/派生规则（对齐截图）

- **湿度(%)**：`humidityPercent = round(realtime.humidity * 100)`
- **气压(hPa)**：`pressureHpa = round(realtime.pressure / 100)`
- **风力等级（0~17 级）**：由 `wind.speed`（km/h）按官方对照表区间映射
  - 对照表：`https://docs.caiyunapp.com/weather-api/resources/wind.html`
- **风向文字（16 风向）**：由 `wind.direction`（0~360°，从北顺时针）映射到 N/NNE/NE...（同上文档）

### 3.3 天气现象（skycon）

文档：`https://docs.caiyunapp.com/weather-api/v2/v2.6/tables/skycon.html`

你截图里“晴/多云/阴/雨雪/雾霾”等都来自 `skycon` 代码（例如 `CLEAR_DAY`）。

---

## 4. 截图 UI → 彩云字段映射（逐项）

下面的 JSONPath 以 **综合接口**返回为准（即 `$.result...`），单独接口返回路径一致。

### 4.1 顶部主卡（地点 / 当前温度 / 天气现象 / 高低温）

- **地点文字（如“怀柔区 怀丰公路东侧路”）**
  - **彩云天气 API 不提供 POI/道路级反向地理编码**（仅接收经纬度并返回天气）
  - **实现建议**：用系统定位 + 反地理编码（Apple/高德/腾讯/Google）得到可展示的地点名，并缓存到城市/定位模型里

- **当前温度（大号 1°）**
  - JSONPath：`$.result.realtime.temperature`

- **当前天气文案（如“晴”）**
  - JSONPath：`$.result.realtime.skycon`
  - 显示：把 `skycon` code 映射为中文（参见 skycon 表）

- **今日最高/最低（如“最高1° 最低-10°”）**
  - JSONPath：`$.result.daily.temperature[0].max` / `$.result.daily.temperature[0].min`
  - 说明：`daily.temperature` 是“全天最高/最低/平均”

### 4.2 “空气优 25”（空气质量）

实时空气质量（国标口径）：

- **AQI 数值**：`$.result.realtime.air_quality.aqi.chn`
- **等级/描述**：`$.result.realtime.air_quality.description.chn`

> 备注：截图里用“优/良…”，通常可直接用 `description.chn`；如果你要严格按国标阈值输出“优/良/轻度污染…”，可用 `aqi.chn` 自己做阈值映射。

### 4.3 “大风蓝色预警”卡片（预警）

文档：`https://docs.caiyunapp.com/weather-api/v2/v2.6/5-alert.html`

- **开关**：在请求里加 `alert=true`
- **付费限制**：文档标注为付费能力（免费额度不适用）
- **标题**：`$.result.alert.content[0].title`
- **描述**：`$.result.alert.content[0].description`
- **发布时间**：`$.result.alert.content[0].pubtimestamp`
- **级别/颜色**：可从 `code` 解析（后两位是等级：00 白/01 蓝/02 黄/03 橙/04 红）

### 4.4 未来 24 小时曲线（时间 / 温度 / 图标 / 风）

小时级文档：`https://docs.caiyunapp.com/weather-api/v2/v2.6/3-hourly.html`

用于截图中“17:00 / 现在 / 日落 / 18:00...”这一行：

- **时间**：`$.result.hourly.temperature[i].datetime`
- **温度**：`$.result.hourly.temperature[i].value`
- **天气现象图标**：`$.result.hourly.skycon[i].value`
- **风**：`$.result.hourly.wind[i].speed` / `$.result.hourly.wind[i].direction`
- **（可选）降水概率**：`$.result.hourly.precipitation[i].probability`

显示建议：

- 选取 `hourlysteps=24`
- “现在”可用 `server_time` 与数组的 `datetime` 做最近邻匹配，或直接用 realtime

### 4.5 “2小时内无降雪/无降水”（分钟级降水预报）

分钟级文档：`https://docs.caiyunapp.com/weather-api/v2/v2.6/2-minutely.html`

付费/套餐限制：

- 文档明确标注：分钟级 API 属于增值服务（通常仅企业套餐提供）

可直接用于截图中的两块内容：

- **“降水预报 / 2小时内无降雪”文案**
  - JSONPath：`$.result.minutely.description`
  - 也可用综合接口里的：`$.result.forecast_keypoint`（更像“关键点”一句话）
- **未来 2 小时逐分钟降水强度曲线**
  - JSONPath：`$.result.minutely.precipitation_2h[]`（长度约 120）
- **未来 2 小时每半小时降水概率**
  - JSONPath：`$.result.minutely.probability[]`

降级方案（如果 minutely 不可用）：

- 用小时级 `$.result.hourly.precipitation[i].probability` 取未来 2 小时（2 个点）的概率，生成文案：
  - 例如：两小时内最大概率 < 10% → “短时内无明显降水”
- “无降雪/无降雨”的判定：结合未来 2 小时的 `hourly.skycon[i].value` 是否包含 `*_SNOW` / `*_RAIN`

### 4.6 详情页顶部“未来短时内无降水”（关键点/自然语言描述）

综合接口示例里有全局关键点字段：

- **关键点一句话**：`$.result.forecast_keypoint`

小时级也有自然语言描述：

- **小时级描述**：`$.result.hourly.description`

> 建议优先展示 `forecast_keypoint`；如果为空或不符合产品风格，再退回 `hourly.description`。

### 4.7 详情页数据卡片（紫外线/湿度/体感/风/日出日落/气压）

这些都可直接从 `realtime + daily(astro)` 得到：

- **紫外线（弱 / UV 数值）**
  - JSONPath：`$.result.realtime.life_index.ultraviolet.index`
  - JSONPath：`$.result.realtime.life_index.ultraviolet.desc`
  - 展示建议：`index` 作为仪表盘数值，`desc` 作为文案（弱/中等/强…）

- **湿度（13%）**
  - JSONPath：`$.result.realtime.humidity`
  - 换算：`round(humidity * 100)` 得到百分比

- **体感（3°）**
  - JSONPath：`$.result.realtime.apparent_temperature`

- **风（西北风 3级）**
  - JSONPath：`$.result.realtime.wind.direction`（0~360°）
  - JSONPath：`$.result.realtime.wind.speed`（默认 `unit=metric` 时为 km/h）
  - 派生：direction → 16 风向文字；speed → 风力等级（0~17 级）
  - 参考：`https://docs.caiyunapp.com/weather-api/resources/wind.html`

- **日出/日落（07:20 / 17:36）**
  - JSONPath：`$.result.daily.astro[0].sunrise.time`
  - JSONPath：`$.result.daily.astro[0].sunset.time`
  - 注意：官方说明里提到 **tzshift 不作用在这个变量**，`time` 已是当地时区时刻

- **气压（1020 hPa）**
  - JSONPath：`$.result.realtime.pressure`（Pa）
  - 换算：`round(pressure / 100)` → hPa

（可选）如果你详情页还想加“能见度/云量/短波辐射”等：

- 能见度：`$.result.realtime.visibility`
- 云量：`$.result.realtime.cloudrate`
- 辐射：`$.result.realtime.dswrf`

### 4.8 底部“生活建议”九宫格（穿衣/防晒/运动/限行/洗车/带伞/感冒…）

天级生活指数在 `daily.life_index` 中（文档：`https://docs.caiyunapp.com/weather-api/v2/v2.6/4-daily.html`）：

取当天（索引 0）：

- **穿衣**：`$.result.daily.life_index.dressing[0].desc`
- **防晒/紫外线**：`$.result.daily.life_index.ultraviolet[0].desc`
- **洗车**：`$.result.daily.life_index.carWashing[0].desc`
- **感冒**：`$.result.daily.life_index.coldRisk[0].desc`
- **舒适度**（如需）：`$.result.daily.life_index.comfort[0].desc`

与截图文案不完全一致的处理建议（让 UI 更像“天气”）：

- “适宜羽绒服”：彩云返回的是体感/穿衣等级描述（如“寒冷/极冷/冷/凉爽…”），建议在前端做二次映射：
  - 例：`dressing.desc ∈ {寒冷, 极冷}` → “适宜羽绒服”
- “无需防晒”：用 `ultraviolet.desc` 二次映射：
  - 例：`ultraviolet.desc ∈ {无, 很弱, 最弱, 弱}` → “无需防晒”
- “不用带伞”：彩云没有独立“雨伞指数”，建议用降水概率派生：
  - 当天：`$.result.daily.precipitation[0].probability`
  - 或未来 2 小时：`hourly.precipitation[i].probability`
  - 例：概率 < 10% → “不用带伞”
- “宜室内运动”：彩云 v2.6 未提供“运动指数”，建议根据温度/风/降水/空气质量派生一个简单规则
- “今日限行 116”：彩云不提供限行政策/尾号数据
  - **实现建议**：按城市（北京等）用本地规则表 + 日期计算，或接入第三方交通/限行 API
- “央视天气预报”视频：彩云不提供该视频内容，属于额外内容源（可内置链接/接入公开源/自建）

### 4.9 未来 3 天列表 + “查看近15日天气”

天级预报（最多 15 天）：`dailysteps=15`

用于“今天/明天/周六 … 高低温 + 图标”：

- 日期：`$.result.daily.temperature[i].date`（或 `daily.skycon[i].date`，同一天）
- 最高/最低：`$.result.daily.temperature[i].max` / `$.result.daily.temperature[i].min`
- 天气现象：`$.result.daily.skycon[i].value`

温度范围条（截图里每行右侧的横条）建议做法：

- 先用 15 天数据找全局 min/max（`min(temp.min)` 与 `max(temp.max)`）
- 每天的条形起止用当日 `min/max` 映射到 \([0, 1]\)

---

## 5. 付费能力清单（避免“接口不对/请求失败”）

- **分钟级（minutely）**：v2.6 文档标注“增值服务”
- **预警（alert）**：v2.6 文档标注“付费套餐”，通过 `alert=true` 获取

如果你先要把 App 跑通并覆盖主要 UI：

- 可以只用 `realtime + hourly + daily + air_quality + life_index + astro`（这些在文档里是常规能力）
- minutely/alert 用降级方案占位，后续再按套餐补齐

---

## 6. 实现落地建议（请求策略/缓存/限流）

- **并发策略**：优先只打一次综合 `weather` 接口（`hourlysteps=24&dailysteps=15`）
- **缓存**：同一城市/坐标建议做 5-10 分钟缓存，减少调用与延迟
- **QPS**：彩云按套餐有不同 QPS 限制，平台可查看：`https://platform.caiyunapp.com/api/manage?mode=weather`
