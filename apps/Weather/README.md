# 天气（Weather）- 和风天气 API 调研与接口对照

本目录用于记录“天气”App 需要用到的和风天气（QWeather）接口、字段与请求示例，方便后续实现 UI 与数据层。

> 安全提示：你提供的 **API Key 属于敏感信息**。为了避免泄露，建议在真实项目中使用环境变量（如 `.env`）或服务端代理，不要把 Key 写进代码并提交到 git。

---

##你当前的 Host / Key（用于本地调试）

-**API Host**：`<YOUR_QWEATHER_HOST>`

-**API Key**：`<YOUR_QWEATHER_API_KEY>`

-**鉴权方式**：API KEY（请求头 `X-QW-Api-Key`）

> 说明：和风建议使用 **API Host**（专属域名），公共域名从 2026 年起逐步停止服务。

---

##通用请求规则

###基础 URL

所有请求均为 HTTPS：

`https://{API_HOST}/{path}`

例如：

`https://<YOUR_QWEATHER_HOST>/v7/weather/now?location=101010100`

###鉴权（API KEY）

两种等价方式：

1)**请求头**（推荐，便于统一封装）

```bash

curl--compressed\

  -H "X-QW-Api-Key: <YOUR_KEY>" \

"https://<YOUR_HOST>/v7/weather/now?location=101010100"

```

2)**Query 参数**

```bash

curl--compressed\

  "https://<YOUR_HOST>/v7/weather/now?location=101010100&key=<YOUR_KEY>"

```

###location 参数（非常重要）

不同接口对 `location` 的要求不同：

-**大多数 v7 天气接口**支持：

-`LocationID`（如 `101010100`）

- 或 `经度,纬度`（如 `116.41,39.92`）

-**分钟级降水** `GET /v7/minutely/5m`：只支持 **经度,纬度**

-**空气质量 v1**：不用 `location`，而是用 **路径参数** `{latitude}/{longitude}`

###常用可选参数

-`lang`：语言（如 `zh`）

-`unit`：单位（`m` 公制默认，`i` 英制）

---

##截图 UI 模块 → 接口对照表

###1) 顶部主卡（当前温度/体感/风/湿度/气压/能见度/天气文案）

-**接口**：实时天气

-**Path**：`GET /v7/weather/now`

-**文档**：`https://dev.qweather.com/docs/api/weather/weather-now/`

关键字段（示例）：

-`now.temp`：温度

-`now.feelsLike`：体感

-`now.text` / `now.icon`：天气文案/图标

-`now.windDir` / `now.windScale` / `now.windSpeed`：风向/风力/风速

-`now.humidity`：湿度

-`now.pressure`：气压

-`now.vis`：能见度

你已验证的请求示例（北京 `101010100`）：

```bash

curl--compressed\

  -H "X-QW-Api-Key: <YOUR_QWEATHER_API_KEY>" \

"https://<YOUR_QWEATHER_HOST>/v7/weather/now?location=101010100"

```

对应返回（节选）：

-`temp: "2"`

-`feelsLike: "-7"`

-`text: "多云"`

-`windDir: "北风"`, `windScale: "3"`

-`humidity: "15"`

-`pressure: "1025"`

-`vis: "30"`

---

###2) 未来 7 天（今天/明天/周六…，最高/最低、图标）

-**接口**：每日天气预报

-**Path**：`GET /v7/weather/{days}`，常用：`7d` / `15d`

-**文档**：`https://dev.qweather.com/docs/api/weather/weather-daily-forecast/`

关键字段：

-`daily[].fxDate`：日期

-`daily[].tempMax` / `daily[].tempMin`：最高/最低温

-`daily[].iconDay/textDay`、`daily[].iconNight/textNight`：白天/夜间

-`daily[].sunrise` / `daily[].sunset`：日出日落（高纬可能为空）

示例：

```bash

curl--compressed\

  -H "X-QW-Api-Key: <YOUR_QWEATHER_API_KEY>" \

"https://<YOUR_QWEATHER_HOST>/v7/weather/7d?location=101010100"

```

---

###3) 小时曲线（未来 24 小时：时间/温度/图标/风力等）

-**接口**：逐小时天气预报

-**Path**：`GET /v7/weather/{hours}`，常用：`24h`

-**文档**：`https://dev.qweather.com/docs/api/weather/weather-hourly-forecast/`

关键字段：

-`hourly[].fxTime`：预报时间

-`hourly[].temp`、`hourly[].icon/text`

-`hourly[].windScale`、`hourly[].windDir`

-`hourly[].pop`：降水概率（可能为空）

示例：

```bash

curl--compressed\

  -H "X-QW-Api-Key: <YOUR_QWEATHER_API_KEY>" \

"https://<YOUR_QWEATHER_HOST>/v7/weather/24h?location=101010100"

```

---

###4) 分钟级降水（2 小时内无降雪/无降水，临近预报）

-**接口**：分钟级降水（未来 2 小时、每 5 分钟）

-**Path**：`GET /v7/minutely/5m`

-**文档**：`https://dev.qweather.com/docs/api/minutely/minutely-precipitation/`

注意：

-`location` 必须是 **经度,纬度**（例如 `116.41,39.92`），不能用 LocationID。

示例：

```bash

curl--compressed\

  -H "X-QW-Api-Key: <YOUR_QWEATHER_API_KEY>" \

"https://<YOUR_QWEATHER_HOST>/v7/minutely/5m?location=116.41,39.92"

```

关键字段：

-`summary`：概括文案（如“2小时内无降雪/放心出行吧”）

-`minutely[].precip`、`minutely[].type`（rain/snow）

---

###5) 空气质量（例如 “空气优 25”）

-**接口**：实时空气质量（注意：这是 **Air Quality API v1**，不是 v7）

-**Path**：`GET /airquality/v1/current/{latitude}/{longitude}`

-**文档**：`https://dev.qweather.com/docs/api/air-quality/air-current/`

注意：

- 该接口使用 **路径参数**，不是 `?location=...`
- 返回里 `indexes[]` 可能同时包含本地 AQI 与 QAQI，两者展示口径需产品决定。

示例（北京大概坐标）：

```bash

curl--compressed\

  -H "X-QW-Api-Key: <YOUR_QWEATHER_API_KEY>" \

"https://<YOUR_QWEATHER_HOST>/airquality/v1/current/39.90/116.40"

```

常用字段：

-`indexes[].aqiDisplay`：适合直接展示的 AQI 数值

-`indexes[].category`：优良中差等

-`indexes[].primaryPollutant`：首要污染物

---

###6) 灾害预警（例如 “大风蓝色预警” 卡片）

-**接口**：天气预警

-**Path**：`GET /v7/warning/now`

-**文档**：`https://dev.qweather.com/en/docs/api/warning/weather-warning`

示例：

```bash

curl--compressed\

  -H "X-QW-Api-Key: <YOUR_QWEATHER_API_KEY>" \

"https://<YOUR_QWEATHER_HOST>/v7/warning/now?location=101010100"

```

常用字段：

-`warning[].title`：卡片标题

-`warning[].severity` / `warning[].severityColor`：严重等级/推荐颜色（用于“蓝/黄/橙/红”等视觉）

-`warning[].text`：详情描述

---

###7) 生活指数建议（穿衣/防晒/运动/洗车/带伞/感冒…）

-**接口**：天气指数预报

-**Path**：`GET /v7/indices/{days}`，常用：`1d`

-**文档**：`https://dev.qweather.com/docs/api/indices/indices-forecast/`

注意：

-`type` 必填，可用英文逗号一次取多个指数：`type=3,5,9` 等

- 每个指数的 ID/含义参考文档里的“天气指数信息”页

示例（先用少量 type 试通）：

```bash

curl--compressed\

  -H "X-QW-Api-Key: <YOUR_QWEATHER_API_KEY>" \

"https://<YOUR_QWEATHER_HOST>/v7/indices/1d?location=101010100&type=1,2,3,5"

```

常用字段：

-`daily[].name`：指数名（穿衣/洗车/感冒…）

-`daily[].category`：等级文案（适宜/较不宜/很强…）

-`daily[].text`：详细建议（可用于详情页/tooltip）

---

##城市搜索（LocationID 获取）

如果需要“添加城市/搜索城市”，使用 GeoAPI：

-**接口**：城市搜索

-**Path**：`GET /geo/v2/city/lookup?location=北京`

-**文档**：`https://dev.qweather.com/docs/api/geoapi/city-lookup/`

示例：

```bash

curl--compressed\

  -H "X-QW-Api-Key: <YOUR_QWEATHER_API_KEY>" \

"https://<YOUR_QWEATHER_HOST>/geo/v2/city/lookup?location=北京&range=cn&number=10"

```

取 `location[].id` 作为后续 v7 天气接口的 `location`。

---

##后续实现建议（仅记录）

-**数据聚合**：前端页面通常需要并发请求 `now + 24h + 7d + indices + warning`，再按 UI 模块组装。

-**经纬度管理**：分钟级降水与空气质量都需要经纬度，建议在“城市搜索”结果里缓存 `lat/lon`。

-**缓存**：短时间内重复打开页面可缓存（如 5-10 分钟），减少计费与延迟。
