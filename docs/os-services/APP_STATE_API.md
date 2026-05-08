# App State API 文档

> 由 `scripts/dev/dump_app_state_schema.py` 自动生成于 2026-05-08，从运行中的服务直接获取 `__SIM__.getState()`

本文档描述 `__SIM__.getState()` 返回的**真实**数据结构。

## OS 状态

```javascript
const os = __SIM__.getState().os;
```

| 路径 | 类型 | 示例 |
|------|------|------|
| `os.tasks` | array | (0 项) |
| `os.activeTaskId` | NoneType |  |
| `os.isLauncherVisible` | bool | `True` |
| `os.isRecentsVisible` | bool | `False` |
| `os.runningApps` | array | (0 项) |
| `os.activeAppId` | NoneType |  |
| `os.locale` | str | `zh-Hans` |
| `os.time` | object |  |
| `os.time.mode` | str | `real` |
| `os.time.timestamp` | int | `1778251598834` |
| `os.time.formatted` | str | `22:46` |
| `os.time.date` | str | `5月8日` |
| `os.time.dayOfWeek` | str | `周五` |
| `os.location` | object |  |
| `os.location.mode` | str | `simulated` |
| `os.location.coords` | object |  |
| `os.location.coords.latitude` | float | `39.9794688` |
| `os.location.coords.longitude` | float | `116.3323982` |
| `os.location.coords.accuracy` | NoneType |  |
| `os.installedApps` | array&lt;object&gt; | (27 项) |
| `os.installedApps[].id` | str | `alipay` |
| `os.installedApps[].name` | str | `支付宝` |
| `os.installedApps[].type` | str | `plugin` |
| `os.clipboard` | NoneType |  |
| `os.notifications` | object |  |
| `os.notifications.items` | array | (0 项) |
| `os.notifications.unreadCount` | int | `0` |
| `os.shade` | object |  |
| `os.shade.open` | bool | `False` |
| `os.shade.kind` | str | `notifications` |
| `os.launcher` | object |  |
| `os.launcher.version` | int | `1` |
| `os.launcher.grid` | object |  |
| `os.launcher.grid.columns` | int | `4` |
| `os.launcher.grid.rows` | int | `6` |
| `os.launcher.wallpaper` | object |  |
| `os.launcher.wallpaper.kind` | str | `image` |
| `os.launcher.wallpaper.imageUrl` | str | `/cdn/themes/af0f7f90-04fb-417b-941e-ae7b549fe5e...` |
| `os.launcher.screensCount` | int | `2` |
| `os.launcher.screens` | array&lt;object&gt; | (2 项) |
| `os.launcher.screens[].id` | str | `screen_1` |
| `os.launcher.screens[].items` | array&lt;object&gt; | (10 项) |
| `os.launcher.hiddenApps` | array | (0 项) |
| `os.launcher.hotseat` | array&lt;object&gt; | (3 项) |
| `os.launcher.hotseat[].slot` | int | `0` |
| `os.launcher.hotseat[].kind` | str | `app` |
| `os.launcher.hotseat[].appId` | str | `sms` |
| `os.launcher.folders` | array | (0 项) |
| `os.settings` | object |  |
| `os.settings.system` | object |  |
| `os.settings.system.brightness` | int | `100` |
| `os.settings.system.mediaVolume` | int | `30` |
| `os.settings.system.fontSizePct` | int | `50` |
| `os.settings.system.displaySizePct` | int | `50` |
| `os.settings.system.eyeComfortLevel` | int | `60` |
| `os.settings.global` | object |  |
| `os.settings.global.wifiEnabled` | bool | `True` |
| `os.settings.global.mobileDataEnabled` | bool | `True` |
| `os.settings.global.bluetoothEnabled` | bool | `True` |
| `os.settings.global.airplaneModeEnabled` | bool | `False` |
| `os.settings.global.doNotDisturbEnabled` | bool | `False` |
| `os.settings.global.silentMode` | bool | `False` |
| `os.settings.global.flashlightEnabled` | bool | `False` |
| `os.settings.global.batterySaverEnabled` | bool | `False` |
| `os.settings.global.rotationLocked` | bool | `True` |
| `os.settings.global.locationEnabled` | bool | `True` |
| `os.settings.global.nfcEnabled` | bool | `True` |
| `os.settings.global.screenCastEnabled` | bool | `False` |
| `os.settings.global.autoBrightnessEnabled` | bool | `True` |
| `os.settings.global.eyeComfortEnabled` | bool | `False` |
| `os.settings.global.darkModeEnabled` | bool | `False` |
| `os.settings.global.language` | str | `zh-Hans` |
| `os.hardware` | object |  |
| `os.hardware.battery` | object |  |
| `os.hardware.battery.percent` | int | `78` |
| `os.hardware.battery.charging` | bool | `False` |
| `os.hardware.battery.fastCharging` | bool | `False` |
| `os.hardware.battery.chargingType` | str | `usb` |
| `os.hardware.battery.temperature` | float | `31.2` |
| `os.hardware.battery.voltage` | float | `4.12` |
| `os.hardware.battery.health` | str | `good` |
| `os.hardware.battery.technology` | str | `Li-poly` |
| `os.hardware.battery.cycleCount` | int | `285` |
| `os.hardware.battery.estimatedRemaining` | str | `约 12 小时 30 分` |
| `os.hardware.cellular` | object |  |
| `os.hardware.cellular.signalLevel` | int | `4` |
| `os.hardware.cellular.mobileDataType` | str | `4g` |
| `os.hardware.cellular.noSim` | bool | `False` |
| `os.hardware.wifi` | object |  |
| `os.hardware.wifi.level` | int | `4` |
| `os.hardware.wifi.connectedSsid` | str | `Xiaomi_AX3` |
| `os.hardware.wifi.ipAddress` | str | `192.168.31.105` |
| `os.hardware.wifi.macAddress` | str | `A4:CF:12:**:**:**` |
| `os.hardware.wifi.linkSpeed` | int | `866` |
| `os.hardware.wifi.frequency` | int | `5180` |
| `os.hardware.bluetooth` | object |  |
| `os.hardware.bluetooth.name` | str | `Xiaomi 15 Ultra` |
| `os.hardware.storage` | object |  |
| `os.hardware.storage.used` | str | `317 GB` |
| `os.hardware.hotspot` | object |  |
| `os.hardware.hotspot.enabled` | bool | `False` |
| `os.hardware.hotspot.ssid` | str | `Xiaomi 15 Ultra` |
| `os.hardware.hotspot.password` | str | `12345678` |
| `os.hardware.vpnEnabled` | bool | `False` |
| `os.hardware.headsetConnected` | bool | `False` |
| `os.hardware.alarmSet` | bool | `False` |
| `os.hardware.nearbyWifi` | array&lt;object&gt; | (5 项) |
| `os.hardware.nearbyWifi[].ssid` | str | `Xiaomi_AX3` |
| `os.hardware.nearbyWifi[].bssid` | str | `A4:CF:12:11:22:33` |
| `os.hardware.nearbyWifi[].security` | str | `WPA3` |
| `os.hardware.nearbyWifi[].signalLevel` | int | `4` |
| `os.hardware.nearbyWifi[].frequency` | int | `5180` |
| `os.hardware.nearbyBluetooth` | array&lt;object&gt; | (5 项) |
| `os.hardware.nearbyBluetooth[].name` | str | `Xiaomi Buds 4 Pro` |
| `os.hardware.nearbyBluetooth[].mac` | str | `C8:7F:54:12:34:56` |
| `os.hardware.nearbyBluetooth[].type` | str | `audio` |
| `os.hardware.nearbyBluetooth[].paired` | bool | `True` |
| `os.hardware.nearbyBluetooth[].connected` | bool | `True` |
| `os.hardware.nearbyBluetooth[].batteryLevel` | int | `78` |
| `os.permissions` | object |  |
| `os.preferences` | object |  |
| `os.preferences.wifi_password__Xiaomi_AX3` | str | `12345678` |
| `os.preferences.wifi_password__ChinaNet-5G-8F2A` | str | `12345678` |
| `os.preferences.wifi_password__MiHome_2.4G` | str | `12345678` |
| `os.preferences.wifi_password__Neighbor-5G` | str | `12345678` |
| `os.build` | object |  |
| `os.build.brand` | str | `Xiaomi` |
| `os.build.marketName` | str | `小米 15 Ultra` |
| `os.build.model` | str | `Xiaomi 15 Ultra` |
| `os.build.manufacturer` | str | `Xiaomi Communications Co., Ltd.` |
| `os.build.processor` | str | `Snapdragon 8 Elite` |
| `os.build.cpuCores` | int | `8` |
| `os.build.cpuMaxFreq` | str | `4.32 GHz` |
| `os.build.gpu` | str | `Adreno 830` |
| `os.build.ramTotal` | str | `16 GB` |
| `os.build.storageTotal` | str | `512 GB` |
| `os.build.screenSize` | str | `6.73 英寸` |
| `os.build.screenResolution` | str | `3200 × 1440` |
| `os.build.screenDensity` | int | `522` |
| `os.build.refreshRate` | int | `120` |
| `os.build.hdrSupport` | bool | `True` |
| `os.build.rearCamera` | str | `50MP + 50MP + 200MP` |
| `os.build.frontCamera` | str | `32MP` |
| `os.build.batteryCapacity` | str | `5000 mAh` |
| `os.build.chargingSpeed` | str | `90W 有线 / 50W 无线` |
| `os.build.androidVersion` | str | `15` |
| `os.build.hyperOSVersion` | str | `2.1.0` |
| `os.build.securityPatch` | str | `2026-01-05` |
| `os.build.buildNumber` | str | `V816.0.9.0.VNACNXM` |
| `os.build.kernelVersion` | str | `6.1.75-android15` |
| `os.build.basebandVersion` | str | `MPSS.AB.1.0-00123` |
| `os.build.imei1` | str | `86*************1` |
| `os.build.imei2` | str | `86*************2` |
| `os.build.serialNumber` | str | `HX2***********B` |
| `os.build.macAddress` | str | `A4:CF:12:**:**:**` |
| `os.build.bluetoothMac` | str | `A4:CF:12:**:**:**` |
| `os.telephony` | object |  |
| `os.telephony.sims` | array&lt;object&gt; | (2 项) |
| `os.telephony.sims[].slot` | int | `1` |
| `os.telephony.sims[].carrier` | str | `中国移动` |
| `os.telephony.sims[].phoneNumber` | str | `138****8888` |
| `os.telephony.sims[].iccid` | str | `8986***************` |
| `os.telephony.sims[].networkType` | str | `5G SA` |
| `os.telephony.sims[].dataRoaming` | bool | `False` |
| `os.telephony.sims[].voLTE` | bool | `True` |
| `os.telephony.defaultDataSim` | int | `1` |
| `os.services` | object |  |
| `os.services.location` | object |  |
| `os.services.location.mode` | str | `simulated` |
| `os.services.location.simulatedLocation` | object |  |
| `os.services.location.simulateError` | NoneType |  |
| `os.services.keyboard` | object |  |
| `os.services.keyboard.visible` | bool | `False` |
| `os.services.keyboard.mode` | str | `en` |
| `os.services.keyboard.height` | int | `0` |
| `os.services.shade` | object |  |
| `os.services.shade.open` | bool | `False` |
| `os.services.shade.kind` | str | `notifications` |
| `os.services.taskManager` | object |  |
| `os.services.taskManager.tasks` | array | (0 项) |
| `os.services.taskManager.activeTaskId` | NoneType |  |
| `os.services.taskManager.isLauncherVisible` | bool | `True` |
| `os.services.taskManager.isRecentsVisible` | bool | `False` |
| `os.providers` | object |  |
| `os.providers.contacts` | object |  |
| `os.providers.contacts.contacts` | array&lt;object&gt; | (12 项) |
| `os.providers.media` | object |  |
| `os.providers.media.favorites` | array | (0 项) |
| `os.providers.sms` | object |  |
| `os.providers.sms.conversations` | array&lt;object&gt; | (6 项) |
| `os.providers.sms.messagesByConversationId` | object |  |
| `os.fileSystem` | object |  |
| `os.fileSystem.nodes` | array&lt;object&gt; | (85 项) |
| `os.fileSystem.nodes[].id` | str | `root` |
| `os.fileSystem.nodes[].name` | str | `/` |
| `os.fileSystem.nodes[].type` | str | `directory` |
| `os.fileSystem.nodes[].parentId` | NoneType |  |
| `os.fileSystem.nodes[].path` | str | `/` |
| `os.fileSystem.nodes[].size` | int | `0` |
| `os.fileSystem.nodes[].createdAt` | int | `1778251597657` |
| `os.fileSystem.nodes[].modifiedAt` | int | `1778251597657` |
| `os.fileSystem.nodes[].storage` | str | `memory` |

## Apps 概览

```javascript
const apps = __SIM__.getState().apps;
```

| App ID | 名称 | 顶层字段 |
|--------|------|----------|
| `weather` | 天气 | `version, selectedCityId, savedCities, bundlesByCityId, settings, weatherLibrary` |
| `clock` | clock | `alarms, selectedCityIds, cities, selectedCities` |
| `spotify` | spotify | `currentUser, accounts, currentTrack, isPlaying, shuffle, repeat, queue, recentPlays, likedSongs, followedArtists, customPlaylists, playHistory, settings, pendingPlaylistTrack, searchHistory, _temp` |
| `alipay` | alipay | `userInfo, language, balance, transferRecords, notifications, quickActions, mainServices, commonServices, flashSale, financeServices, myServicesList, myServicesGrid, myCivicServices, conversations, chatHistory, contacts, settings, bankCards, subscriptions, lastPaymentHint, rechargeCards, billSearchHistory, transferDraft, transferReceipt` |
| `bilibili` | 哔哩哔哩 | `homeTabs, recommendedUp, shopItems, settings, user, activeVideoId` |
| `ebay` | ebay | `user, recentSearches, savedItems, cartItems, homeProducts, messages, settings, search` |
| `map` | 地图 | `user, searchHistory, settings, currentLocation, currentView` |
| `railway12306` | railway12306 | `from, to, date, isStudent, searchHistory, stationSelectTarget, orders, passengers, settings, selectedTrain, notificationsRead, lastQuerySummary, invoiceHeaders, invoiceEmail, userProfile, isLoggedIn, loginUser, auth, directTrains, transferPlans, _temp, searchForm, user, notifications, account, studentVerify, servicePhones, queryState, lastPickedTrain, lastLoginHint` |
| `redbook` | 小红书 | `user, entities, feedIds, userIds, chats, notifications, history, settings, storage, homeState, publishDraft` |
| `reddit` | reddit | `user, communities, posts, joinedCommunityIds, postVotes, commentVotes, chatThreadsByUsername, chatThreadRepliesByKey, userCommentsByPostId, userPosts, createDraft, settings` |
| `tencent_meeting` | 腾讯会议 | `user, personalRoom, messages, otherDevices, ongoingMeetings, history, contacts, scheduledMeetings, settings, activeMeeting, pendingMeetingConfig, currentScheduledMeeting` |
| `wechat` | 微信 | `user, auth, chats, contacts, moments, authorizedApps, nearbyPeople, momentDraft, textMomentDraft, settings, subscriptions, _temp` |
| `wechat_reading` | 微信读书 | `user, shelf, store, bookProgress, readingRecords, settings, readerPrefs, recommendedAudiobooks, likedListBooks, likedListSyncToHome, _temp, allProgressBookIds, readingBookIds, finishedBookIds, homeFinishedBookIds, hotSearch, audiobooks, users` |
| `x` | X (Twitter) | `posts, conversations, followedUserIds, likedPostIds, retweetedPostIds, bookmarkedPostIds, settings, currentSearchQuery, pendingQuotedPostId, importedUsers, importedPosts, _temp, user, users, followerUserIds, trends, notifications, recentSearches` |
| `answer_sheet` | answer_sheet | `question, hint, fields, answers, submitted` |
| `browser` | 浏览器 | `tabs, activeTabId, visitedUrls` |
| `calculator2` | calculator2 | `state, formula, result` |
| `calendar` | calendar | `settings, events, selectedDateTs` |
| `compass` | compass | `headingDeg, levelAngleDeg, directionText, latitude, longitude` |
| `contacts` | contacts | `searchHistory, settings` |
| `file_manager` | file_manager | `clipboardItems, clipboardOperation` |
| `gallery` | gallery | `-` |
| `notes` | 备忘录 | `notes, todos, folders, selectedFolderId, settings` |
| `settings` | settings | `preferences, wifi, _temp` |
| `sms` | sms | `settings, _temp` |

## 各 App 状态字段详情

### 天气 (`weather`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.weather;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `version` | int | `1` |
| `selectedCityId` | str | `located` |
| `savedCities` | array&lt;object&gt; | (6 项) |
| `savedCities[].id` | str | `beijing` |
| `savedCities[].name` | str | `北京市` |
| `savedCities[].lon` | float | `116.4074` |
| `savedCities[].lat` | float | `39.9042` |
| `bundlesByCityId` | object |  |
| `settings` | object |  |
| `settings.morningEveningAlert` | bool | `True` |
| `settings.warningAlert` | bool | `True` |
| `settings.abnormalWeatherAlert` | bool | `True` |
| `settings.nightDnd` | bool | `False` |
| `settings.tempUnit` | str | `celsius` |
| `settings.windUnit` | str | `beaufort` |
| `settings.pressureUnit` | str | `hpa` |
| `settings.nightAutoUpdate` | bool | `True` |
| `settings.revokeConsent` | bool | `False` |
| `weatherLibrary` | object |  |
| `weatherLibrary.beijing` | object |  |
| `weatherLibrary.beijing.lonLat` | str | `116.4074,39.9042` |
| `weatherLibrary.beijing.locationName` | str | `东城区 东华门街道` |
| `weatherLibrary.beijing.bundle` | object |  |
| `weatherLibrary.beijing.bundle.now` | object |  |
| `weatherLibrary.beijing.bundle.now.obsTime` | str | `2026-05-08T12:42+08:00` |
| `weatherLibrary.beijing.bundle.now.temp` | str | `20` |
| `weatherLibrary.beijing.bundle.now.feelsLike` | str | `17` |
| `weatherLibrary.beijing.bundle.now.icon` | str | `502` |
| `weatherLibrary.beijing.bundle.now.text` | str | `霾` |
| `weatherLibrary.beijing.bundle.now.wind360` | str | `339` |
| `weatherLibrary.beijing.bundle.now.windDir` | str | `北风` |
| `weatherLibrary.beijing.bundle.now.windScale` | str | `1` |
| `weatherLibrary.beijing.bundle.now.windSpeed` | str | `2` |
| `weatherLibrary.beijing.bundle.now.humidity` | str | `47` |
| `weatherLibrary.beijing.bundle.now.precip` | str | `0.0` |
| `weatherLibrary.beijing.bundle.now.pressure` | str | `1009` |
| `weatherLibrary.beijing.bundle.now.vis` | str | `3` |
| `weatherLibrary.beijing.bundle.now.cloud` | str | `10` |
| `weatherLibrary.beijing.bundle.now.dew` | str | `3` |
| `weatherLibrary.beijing.bundle.daily` | array&lt;object&gt; | (15 项) |
| `weatherLibrary.beijing.bundle.daily[].fxDate` | str | `2026-05-08` |
| `weatherLibrary.beijing.bundle.daily[].sunrise` | str | `06:10` |
| `weatherLibrary.beijing.bundle.daily[].sunset` | str | `18:32` |
| `weatherLibrary.beijing.bundle.daily[].moonrise` | str | `10:57` |
| `weatherLibrary.beijing.bundle.daily[].moonset` | str | `02:08` |
| `weatherLibrary.beijing.bundle.daily[].moonPhase` | str | `上弦月` |
| `weatherLibrary.beijing.bundle.daily[].moonPhaseIcon` | str | `802` |
| `weatherLibrary.beijing.bundle.daily[].tempMax` | str | `24` |
| `weatherLibrary.beijing.bundle.daily[].tempMin` | str | `10` |
| `weatherLibrary.beijing.bundle.daily[].iconDay` | str | `101` |
| `weatherLibrary.beijing.bundle.daily[].textDay` | str | `多云` |
| `weatherLibrary.beijing.bundle.daily[].iconNight` | str | `151` |
| `weatherLibrary.beijing.bundle.daily[].textNight` | str | `多云` |
| `weatherLibrary.beijing.bundle.daily[].wind360Day` | str | `0` |
| `weatherLibrary.beijing.bundle.daily[].windDirDay` | str | `北风` |
| `weatherLibrary.beijing.bundle.daily[].windScaleDay` | str | `1` |
| `weatherLibrary.beijing.bundle.daily[].windSpeedDay` | str | `3` |
| `weatherLibrary.beijing.bundle.daily[].wind360Night` | str | `45` |
| `weatherLibrary.beijing.bundle.daily[].windDirNight` | str | `东北风` |
| `weatherLibrary.beijing.bundle.daily[].windScaleNight` | str | `1` |
| `weatherLibrary.beijing.bundle.daily[].windSpeedNight` | str | `3` |
| `weatherLibrary.beijing.bundle.daily[].humidity` | str | `23` |
| `weatherLibrary.beijing.bundle.daily[].precip` | str | `0.0` |
| `weatherLibrary.beijing.bundle.daily[].pressure` | str | `1012` |
| `weatherLibrary.beijing.bundle.daily[].vis` | str | `25` |
| `weatherLibrary.beijing.bundle.daily[].cloud` | str | `0` |
| `weatherLibrary.beijing.bundle.daily[].uvIndex` | str | `5` |
| `weatherLibrary.beijing.bundle.hourly` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.beijing.bundle.hourly[].fxTime` | str | `2026-05-08T13:00+08:00` |
| `weatherLibrary.beijing.bundle.hourly[].temp` | str | `21` |
| `weatherLibrary.beijing.bundle.hourly[].icon` | str | `100` |
| `weatherLibrary.beijing.bundle.hourly[].text` | str | `晴` |
| `weatherLibrary.beijing.bundle.hourly[].wind360` | str | `79` |
| `weatherLibrary.beijing.bundle.hourly[].windDir` | str | `东风` |
| `weatherLibrary.beijing.bundle.hourly[].windScale` | str | `2` |
| `weatherLibrary.beijing.bundle.hourly[].windSpeed` | str | `7` |
| `weatherLibrary.beijing.bundle.hourly[].humidity` | str | `25` |
| `weatherLibrary.beijing.bundle.hourly[].pop` | str | `0` |
| `weatherLibrary.beijing.bundle.hourly[].precip` | str | `0.0` |
| `weatherLibrary.beijing.bundle.hourly[].pressure` | str | `1007` |
| `weatherLibrary.beijing.bundle.hourly[].cloud` | str | `18` |
| `weatherLibrary.beijing.bundle.hourly[].dew` | str | `1` |
| `weatherLibrary.beijing.bundle.indices` | array&lt;object&gt; | (5 项) |
| `weatherLibrary.beijing.bundle.indices[].date` | str | `2026-05-08` |
| `weatherLibrary.beijing.bundle.indices[].type` | str | `1` |
| `weatherLibrary.beijing.bundle.indices[].name` | str | `运动指数` |
| `weatherLibrary.beijing.bundle.indices[].level` | str | `3` |
| `weatherLibrary.beijing.bundle.indices[].category` | str | `较不宜` |
| `weatherLibrary.beijing.bundle.indices[].text` | str | `有扬沙或浮尘，建议适当停止户外运动，选择在室内进行运动，以避免吸入更多沙尘，有损健康。` |
| `weatherLibrary.beijing.bundle.warnings` | array | (0 项) |
| `weatherLibrary.beijing.bundle.airQuality` | object |  |
| `weatherLibrary.beijing.bundle.airQuality.pubTime` | str | `2026-05-08T04:45:17.023Z` |
| `weatherLibrary.beijing.bundle.airQuality.aqi` | str | `222` |
| `weatherLibrary.beijing.bundle.airQuality.level` | str | `5` |
| `weatherLibrary.beijing.bundle.airQuality.category` | str | `重度污染` |
| `weatherLibrary.beijing.bundle.airQuality.primaryPollutant` | str | `颗粒物（粒径小于等于2.5µm）` |
| `weatherLibrary.beijing.bundle.airQuality.pm10` | str | `239.86` |
| `weatherLibrary.beijing.bundle.airQuality.pm2p5` | str | `171.14` |
| `weatherLibrary.beijing.bundle.airQuality.no2` | str | `29.57` |
| `weatherLibrary.beijing.bundle.airQuality.so2` | str | `13.57` |
| `weatherLibrary.beijing.bundle.airQuality.co` | str | `1.59` |
| `weatherLibrary.beijing.bundle.airQuality.o3` | str | `127.29` |
| `weatherLibrary.beijing.bundle.minutely` | object |  |
| `weatherLibrary.beijing.bundle.minutely.summary` | str | `未来两小时无降水` |
| `weatherLibrary.beijing.bundle.minutely.minutely` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.beijing.historicalYesterday` | object |  |
| `weatherLibrary.beijing.historicalYesterday.fxDate` | str | `2026-05-07` |
| `weatherLibrary.beijing.historicalYesterday.sunrise` | str | `06:11` |
| `weatherLibrary.beijing.historicalYesterday.sunset` | str | `18:32` |
| `weatherLibrary.beijing.historicalYesterday.moonrise` | str | `09:50` |
| `weatherLibrary.beijing.historicalYesterday.moonset` | str | `01:03` |
| `weatherLibrary.beijing.historicalYesterday.moonPhase` | str | `蛾眉月` |
| `weatherLibrary.beijing.historicalYesterday.moonPhaseIcon` | str |  |
| `weatherLibrary.beijing.historicalYesterday.tempMax` | str | `24` |
| `weatherLibrary.beijing.historicalYesterday.tempMin` | str | `6` |
| `weatherLibrary.beijing.historicalYesterday.iconDay` | str | `502` |
| `weatherLibrary.beijing.historicalYesterday.textDay` | str | `霾` |
| `weatherLibrary.beijing.historicalYesterday.iconNight` | str | `502` |
| `weatherLibrary.beijing.historicalYesterday.textNight` | str | `霾` |
| `weatherLibrary.beijing.historicalYesterday.wind360Day` | str | `166` |
| `weatherLibrary.beijing.historicalYesterday.windDirDay` | str | `南风` |
| `weatherLibrary.beijing.historicalYesterday.windScaleDay` | str | `2` |
| `weatherLibrary.beijing.historicalYesterday.windSpeedDay` | str | `8` |
| `weatherLibrary.beijing.historicalYesterday.wind360Night` | str | `33` |
| `weatherLibrary.beijing.historicalYesterday.windDirNight` | str | `东北风` |
| `weatherLibrary.beijing.historicalYesterday.windScaleNight` | str | `1` |
| `weatherLibrary.beijing.historicalYesterday.windSpeedNight` | str | `2` |
| `weatherLibrary.beijing.historicalYesterday.humidity` | str | `54` |
| `weatherLibrary.beijing.historicalYesterday.precip` | str | `0.0` |
| `weatherLibrary.beijing.historicalYesterday.pressure` | str | `1006` |
| `weatherLibrary.beijing.historicalYesterday.vis` | str |  |
| `weatherLibrary.beijing.historicalYesterday.cloud` | str |  |
| `weatherLibrary.beijing.historicalYesterday.uvIndex` | str |  |
| `weatherLibrary.beijing.airQualityForecast` | array&lt;object&gt; | (3 项) |
| `weatherLibrary.beijing.airQualityForecast[].forecastStartTime` | str | `2026-05-07T16:00Z` |
| `weatherLibrary.beijing.airQualityForecast[].forecastEndTime` | str | `2026-05-08T16:00Z` |
| `weatherLibrary.beijing.airQualityForecast[].aqi` | str | `103` |
| `weatherLibrary.beijing.airQualityForecast[].level` | str | `3` |
| `weatherLibrary.beijing.airQualityForecast[].category` | str | `轻度污染` |
| `weatherLibrary.beijing.airQualityForecast[].primaryPollutant` | str | `颗粒物（粒径小于等于2.5µm）` |
| `weatherLibrary.guangzhou` | object |  |
| `weatherLibrary.guangzhou.lonLat` | str | `113.2644,23.1291` |
| `weatherLibrary.guangzhou.locationName` | str | `越秀区 北京街道` |
| `weatherLibrary.guangzhou.bundle` | object |  |
| `weatherLibrary.guangzhou.bundle.now` | object |  |
| `weatherLibrary.guangzhou.bundle.now.obsTime` | str | `2026-05-08T12:42+08:00` |
| `weatherLibrary.guangzhou.bundle.now.temp` | str | `26` |
| `weatherLibrary.guangzhou.bundle.now.feelsLike` | str | `28` |
| `weatherLibrary.guangzhou.bundle.now.icon` | str | `104` |
| `weatherLibrary.guangzhou.bundle.now.text` | str | `阴` |
| `weatherLibrary.guangzhou.bundle.now.wind360` | str | `136` |
| `weatherLibrary.guangzhou.bundle.now.windDir` | str | `东南风` |
| `weatherLibrary.guangzhou.bundle.now.windScale` | str | `2` |
| `weatherLibrary.guangzhou.bundle.now.windSpeed` | str | `10` |
| `weatherLibrary.guangzhou.bundle.now.humidity` | str | `68` |
| `weatherLibrary.guangzhou.bundle.now.precip` | str | `0.0` |
| `weatherLibrary.guangzhou.bundle.now.pressure` | str | `1004` |
| `weatherLibrary.guangzhou.bundle.now.vis` | str | `30` |
| `weatherLibrary.guangzhou.bundle.now.cloud` | str | `91` |
| `weatherLibrary.guangzhou.bundle.now.dew` | str | `19` |
| `weatherLibrary.guangzhou.bundle.daily` | array&lt;object&gt; | (15 项) |
| `weatherLibrary.guangzhou.bundle.daily[].fxDate` | str | `2026-05-08` |
| `weatherLibrary.guangzhou.bundle.daily[].sunrise` | str | `06:26` |
| `weatherLibrary.guangzhou.bundle.daily[].sunset` | str | `18:41` |
| `weatherLibrary.guangzhou.bundle.daily[].moonrise` | str | `12:05` |
| `weatherLibrary.guangzhou.bundle.daily[].moonset` | str | `01:25` |
| `weatherLibrary.guangzhou.bundle.daily[].moonPhase` | str | `上弦月` |
| `weatherLibrary.guangzhou.bundle.daily[].moonPhaseIcon` | str | `802` |
| `weatherLibrary.guangzhou.bundle.daily[].tempMax` | str | `30` |
| `weatherLibrary.guangzhou.bundle.daily[].tempMin` | str | `21` |
| `weatherLibrary.guangzhou.bundle.daily[].iconDay` | str | `101` |
| `weatherLibrary.guangzhou.bundle.daily[].textDay` | str | `多云` |
| `weatherLibrary.guangzhou.bundle.daily[].iconNight` | str | `350` |
| `weatherLibrary.guangzhou.bundle.daily[].textNight` | str | `阵雨` |
| `weatherLibrary.guangzhou.bundle.daily[].wind360Day` | str | `0` |
| `weatherLibrary.guangzhou.bundle.daily[].windDirDay` | str | `北风` |
| `weatherLibrary.guangzhou.bundle.daily[].windScaleDay` | str | `1` |
| `weatherLibrary.guangzhou.bundle.daily[].windSpeedDay` | str | `3` |
| `weatherLibrary.guangzhou.bundle.daily[].wind360Night` | str | `0` |
| `weatherLibrary.guangzhou.bundle.daily[].windDirNight` | str | `北风` |
| `weatherLibrary.guangzhou.bundle.daily[].windScaleNight` | str | `1` |
| `weatherLibrary.guangzhou.bundle.daily[].windSpeedNight` | str | `3` |
| `weatherLibrary.guangzhou.bundle.daily[].humidity` | str | `73` |
| `weatherLibrary.guangzhou.bundle.daily[].precip` | str | `0.3` |
| `weatherLibrary.guangzhou.bundle.daily[].pressure` | str | `1010` |
| `weatherLibrary.guangzhou.bundle.daily[].vis` | str | `25` |
| `weatherLibrary.guangzhou.bundle.daily[].cloud` | str | `55` |
| `weatherLibrary.guangzhou.bundle.daily[].uvIndex` | str | `4` |
| `weatherLibrary.guangzhou.bundle.hourly` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.guangzhou.bundle.hourly[].fxTime` | str | `2026-05-08T13:00+08:00` |
| `weatherLibrary.guangzhou.bundle.hourly[].temp` | str | `28` |
| `weatherLibrary.guangzhou.bundle.hourly[].icon` | str | `101` |
| `weatherLibrary.guangzhou.bundle.hourly[].text` | str | `多云` |
| `weatherLibrary.guangzhou.bundle.hourly[].wind360` | str | `183` |
| `weatherLibrary.guangzhou.bundle.hourly[].windDir` | str | `南风` |
| `weatherLibrary.guangzhou.bundle.hourly[].windScale` | str | `2` |
| `weatherLibrary.guangzhou.bundle.hourly[].windSpeed` | str | `10` |
| `weatherLibrary.guangzhou.bundle.hourly[].humidity` | str | `53` |
| `weatherLibrary.guangzhou.bundle.hourly[].pop` | str | `5` |
| `weatherLibrary.guangzhou.bundle.hourly[].precip` | str | `0.0` |
| `weatherLibrary.guangzhou.bundle.hourly[].pressure` | str | `1010` |
| `weatherLibrary.guangzhou.bundle.hourly[].cloud` | str | `76` |
| `weatherLibrary.guangzhou.bundle.hourly[].dew` | str | `19` |
| `weatherLibrary.guangzhou.bundle.indices` | array&lt;object&gt; | (5 项) |
| `weatherLibrary.guangzhou.bundle.indices[].date` | str | `2026-05-08` |
| `weatherLibrary.guangzhou.bundle.indices[].type` | str | `1` |
| `weatherLibrary.guangzhou.bundle.indices[].name` | str | `运动指数` |
| `weatherLibrary.guangzhou.bundle.indices[].level` | str | `2` |
| `weatherLibrary.guangzhou.bundle.indices[].category` | str | `较适宜` |
| `weatherLibrary.guangzhou.bundle.indices[].text` | str | `天气较好，较适宜进行各种运动，但因天气热，请适当减少运动时间，降低运动强度。` |
| `weatherLibrary.guangzhou.bundle.warnings` | array | (0 项) |
| `weatherLibrary.guangzhou.bundle.airQuality` | object |  |
| `weatherLibrary.guangzhou.bundle.airQuality.pubTime` | str | `2026-05-08T04:45:17.726Z` |
| `weatherLibrary.guangzhou.bundle.airQuality.aqi` | str | `31` |
| `weatherLibrary.guangzhou.bundle.airQuality.level` | str | `1` |
| `weatherLibrary.guangzhou.bundle.airQuality.category` | str | `优` |
| `weatherLibrary.guangzhou.bundle.airQuality.primaryPollutant` | str |  |
| `weatherLibrary.guangzhou.bundle.airQuality.pm10` | str | `31` |
| `weatherLibrary.guangzhou.bundle.airQuality.pm2p5` | str | `18.17` |
| `weatherLibrary.guangzhou.bundle.airQuality.no2` | str | `16.33` |
| `weatherLibrary.guangzhou.bundle.airQuality.so2` | str | `4.67` |
| `weatherLibrary.guangzhou.bundle.airQuality.co` | str | `0.55` |
| `weatherLibrary.guangzhou.bundle.airQuality.o3` | str | `60.33` |
| `weatherLibrary.guangzhou.bundle.minutely` | object |  |
| `weatherLibrary.guangzhou.bundle.minutely.summary` | str | `未来两小时无降水` |
| `weatherLibrary.guangzhou.bundle.minutely.minutely` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.guangzhou.historicalYesterday` | object |  |
| `weatherLibrary.guangzhou.historicalYesterday.fxDate` | str | `2026-05-07` |
| `weatherLibrary.guangzhou.historicalYesterday.sunrise` | str | `06:27` |
| `weatherLibrary.guangzhou.historicalYesterday.sunset` | str | `18:41` |
| `weatherLibrary.guangzhou.historicalYesterday.moonrise` | str | `10:59` |
| `weatherLibrary.guangzhou.historicalYesterday.moonset` | str | `00:20` |
| `weatherLibrary.guangzhou.historicalYesterday.moonPhase` | str | `蛾眉月` |
| `weatherLibrary.guangzhou.historicalYesterday.moonPhaseIcon` | str |  |
| `weatherLibrary.guangzhou.historicalYesterday.tempMax` | str | `30` |
| `weatherLibrary.guangzhou.historicalYesterday.tempMin` | str | `19` |
| `weatherLibrary.guangzhou.historicalYesterday.iconDay` | str | `101` |
| `weatherLibrary.guangzhou.historicalYesterday.textDay` | str | `多云` |
| `weatherLibrary.guangzhou.historicalYesterday.iconNight` | str | `150` |
| `weatherLibrary.guangzhou.historicalYesterday.textNight` | str | `晴` |
| `weatherLibrary.guangzhou.historicalYesterday.wind360Day` | str | `192` |
| `weatherLibrary.guangzhou.historicalYesterday.windDirDay` | str | `南风` |
| `weatherLibrary.guangzhou.historicalYesterday.windScaleDay` | str | `1` |
| `weatherLibrary.guangzhou.historicalYesterday.windSpeedDay` | str | `3` |
| `weatherLibrary.guangzhou.historicalYesterday.wind360Night` | str | `163` |
| `weatherLibrary.guangzhou.historicalYesterday.windDirNight` | str | `南风` |
| `weatherLibrary.guangzhou.historicalYesterday.windScaleNight` | str | `1` |
| `weatherLibrary.guangzhou.historicalYesterday.windSpeedNight` | str | `4` |
| `weatherLibrary.guangzhou.historicalYesterday.humidity` | str | `75` |
| `weatherLibrary.guangzhou.historicalYesterday.precip` | str | `0.0` |
| `weatherLibrary.guangzhou.historicalYesterday.pressure` | str | `1004` |
| `weatherLibrary.guangzhou.historicalYesterday.vis` | str |  |
| `weatherLibrary.guangzhou.historicalYesterday.cloud` | str |  |
| `weatherLibrary.guangzhou.historicalYesterday.uvIndex` | str |  |
| `weatherLibrary.guangzhou.airQualityForecast` | array&lt;object&gt; | (3 项) |
| `weatherLibrary.guangzhou.airQualityForecast[].forecastStartTime` | str | `2026-05-07T16:00Z` |
| `weatherLibrary.guangzhou.airQualityForecast[].forecastEndTime` | str | `2026-05-08T16:00Z` |
| `weatherLibrary.guangzhou.airQualityForecast[].aqi` | str | `80` |
| `weatherLibrary.guangzhou.airQualityForecast[].level` | str | `2` |
| `weatherLibrary.guangzhou.airQualityForecast[].category` | str | `良` |
| `weatherLibrary.guangzhou.airQualityForecast[].primaryPollutant` | str | `颗粒物（粒径小于等于10µm）` |
| `weatherLibrary.shenzhen` | object |  |
| `weatherLibrary.shenzhen.lonLat` | str | `114.0579,22.5431` |
| `weatherLibrary.shenzhen.locationName` | str | `福田区 莲花街道` |
| `weatherLibrary.shenzhen.bundle` | object |  |
| `weatherLibrary.shenzhen.bundle.now` | object |  |
| `weatherLibrary.shenzhen.bundle.now.obsTime` | str | `2026-05-08T12:42+08:00` |
| `weatherLibrary.shenzhen.bundle.now.temp` | str | `28` |
| `weatherLibrary.shenzhen.bundle.now.feelsLike` | str | `28` |
| `weatherLibrary.shenzhen.bundle.now.icon` | str | `104` |
| `weatherLibrary.shenzhen.bundle.now.text` | str | `阴` |
| `weatherLibrary.shenzhen.bundle.now.wind360` | str | `160` |
| `weatherLibrary.shenzhen.bundle.now.windDir` | str | `南风` |
| `weatherLibrary.shenzhen.bundle.now.windScale` | str | `2` |
| `weatherLibrary.shenzhen.bundle.now.windSpeed` | str | `7` |
| `weatherLibrary.shenzhen.bundle.now.humidity` | str | `62` |
| `weatherLibrary.shenzhen.bundle.now.precip` | str | `0.0` |
| `weatherLibrary.shenzhen.bundle.now.pressure` | str | `1005` |
| `weatherLibrary.shenzhen.bundle.now.vis` | str | `30` |
| `weatherLibrary.shenzhen.bundle.now.cloud` | str | `10` |
| `weatherLibrary.shenzhen.bundle.now.dew` | str | `20` |
| `weatherLibrary.shenzhen.bundle.daily` | array&lt;object&gt; | (15 项) |
| `weatherLibrary.shenzhen.bundle.daily[].fxDate` | str | `2026-05-08` |
| `weatherLibrary.shenzhen.bundle.daily[].sunrise` | str | `06:23` |
| `weatherLibrary.shenzhen.bundle.daily[].sunset` | str | `18:37` |
| `weatherLibrary.shenzhen.bundle.daily[].moonrise` | str | `12:03` |
| `weatherLibrary.shenzhen.bundle.daily[].moonset` | str | `01:20` |
| `weatherLibrary.shenzhen.bundle.daily[].moonPhase` | str | `上弦月` |
| `weatherLibrary.shenzhen.bundle.daily[].moonPhaseIcon` | str | `802` |
| `weatherLibrary.shenzhen.bundle.daily[].tempMax` | str | `29` |
| `weatherLibrary.shenzhen.bundle.daily[].tempMin` | str | `22` |
| `weatherLibrary.shenzhen.bundle.daily[].iconDay` | str | `101` |
| `weatherLibrary.shenzhen.bundle.daily[].textDay` | str | `多云` |
| `weatherLibrary.shenzhen.bundle.daily[].iconNight` | str | `151` |
| `weatherLibrary.shenzhen.bundle.daily[].textNight` | str | `多云` |
| `weatherLibrary.shenzhen.bundle.daily[].wind360Day` | str | `0` |
| `weatherLibrary.shenzhen.bundle.daily[].windDirDay` | str | `北风` |
| `weatherLibrary.shenzhen.bundle.daily[].windScaleDay` | str | `1` |
| `weatherLibrary.shenzhen.bundle.daily[].windSpeedDay` | str | `3` |
| `weatherLibrary.shenzhen.bundle.daily[].wind360Night` | str | `0` |
| `weatherLibrary.shenzhen.bundle.daily[].windDirNight` | str | `北风` |
| `weatherLibrary.shenzhen.bundle.daily[].windScaleNight` | str | `1` |
| `weatherLibrary.shenzhen.bundle.daily[].windSpeedNight` | str | `3` |
| `weatherLibrary.shenzhen.bundle.daily[].humidity` | str | `86` |
| `weatherLibrary.shenzhen.bundle.daily[].precip` | str | `0.0` |
| `weatherLibrary.shenzhen.bundle.daily[].pressure` | str | `1004` |
| `weatherLibrary.shenzhen.bundle.daily[].vis` | str | `24` |
| `weatherLibrary.shenzhen.bundle.daily[].cloud` | str | `25` |
| `weatherLibrary.shenzhen.bundle.daily[].uvIndex` | str | `4` |
| `weatherLibrary.shenzhen.bundle.hourly` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.shenzhen.bundle.hourly[].fxTime` | str | `2026-05-08T13:00+08:00` |
| `weatherLibrary.shenzhen.bundle.hourly[].temp` | str | `29` |
| `weatherLibrary.shenzhen.bundle.hourly[].icon` | str | `100` |
| `weatherLibrary.shenzhen.bundle.hourly[].text` | str | `晴` |
| `weatherLibrary.shenzhen.bundle.hourly[].wind360` | str | `152` |
| `weatherLibrary.shenzhen.bundle.hourly[].windDir` | str | `东南风` |
| `weatherLibrary.shenzhen.bundle.hourly[].windScale` | str | `2` |
| `weatherLibrary.shenzhen.bundle.hourly[].windSpeed` | str | `10` |
| `weatherLibrary.shenzhen.bundle.hourly[].humidity` | str | `59` |
| `weatherLibrary.shenzhen.bundle.hourly[].pop` | str | `0` |
| `weatherLibrary.shenzhen.bundle.hourly[].precip` | str | `0.0` |
| `weatherLibrary.shenzhen.bundle.hourly[].pressure` | str | `1006` |
| `weatherLibrary.shenzhen.bundle.hourly[].cloud` | str | `68` |
| `weatherLibrary.shenzhen.bundle.hourly[].dew` | str | `20` |
| `weatherLibrary.shenzhen.bundle.indices` | array&lt;object&gt; | (5 项) |
| `weatherLibrary.shenzhen.bundle.indices[].date` | str | `2026-05-08` |
| `weatherLibrary.shenzhen.bundle.indices[].type` | str | `1` |
| `weatherLibrary.shenzhen.bundle.indices[].name` | str | `运动指数` |
| `weatherLibrary.shenzhen.bundle.indices[].level` | str | `2` |
| `weatherLibrary.shenzhen.bundle.indices[].category` | str | `较适宜` |
| `weatherLibrary.shenzhen.bundle.indices[].text` | str | `天气较好，较适宜进行各种运动，但因天气热，请适当减少运动时间，降低运动强度。` |
| `weatherLibrary.shenzhen.bundle.warnings` | array | (0 项) |
| `weatherLibrary.shenzhen.bundle.airQuality` | object |  |
| `weatherLibrary.shenzhen.bundle.airQuality.pubTime` | str | `2026-05-08T04:45:18.410Z` |
| `weatherLibrary.shenzhen.bundle.airQuality.aqi` | str | `28` |
| `weatherLibrary.shenzhen.bundle.airQuality.level` | str | `1` |
| `weatherLibrary.shenzhen.bundle.airQuality.category` | str | `优` |
| `weatherLibrary.shenzhen.bundle.airQuality.primaryPollutant` | str |  |
| `weatherLibrary.shenzhen.bundle.airQuality.pm10` | str | `27.2` |
| `weatherLibrary.shenzhen.bundle.airQuality.pm2p5` | str | `17.2` |
| `weatherLibrary.shenzhen.bundle.airQuality.no2` | str | `18.2` |
| `weatherLibrary.shenzhen.bundle.airQuality.so2` | str | `5` |
| `weatherLibrary.shenzhen.bundle.airQuality.co` | str | `0.45` |
| `weatherLibrary.shenzhen.bundle.airQuality.o3` | str | `58.6` |
| `weatherLibrary.shenzhen.bundle.minutely` | object |  |
| `weatherLibrary.shenzhen.bundle.minutely.summary` | str | `未来两小时无降水` |
| `weatherLibrary.shenzhen.bundle.minutely.minutely` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.shenzhen.historicalYesterday` | object |  |
| `weatherLibrary.shenzhen.historicalYesterday.fxDate` | str | `2026-05-07` |
| `weatherLibrary.shenzhen.historicalYesterday.sunrise` | str | `06:24` |
| `weatherLibrary.shenzhen.historicalYesterday.sunset` | str | `18:37` |
| `weatherLibrary.shenzhen.historicalYesterday.moonrise` | str | `10:57` |
| `weatherLibrary.shenzhen.historicalYesterday.moonset` | str | `00:15` |
| `weatherLibrary.shenzhen.historicalYesterday.moonPhase` | str | `蛾眉月` |
| `weatherLibrary.shenzhen.historicalYesterday.moonPhaseIcon` | str |  |
| `weatherLibrary.shenzhen.historicalYesterday.tempMax` | str | `29` |
| `weatherLibrary.shenzhen.historicalYesterday.tempMin` | str | `21` |
| `weatherLibrary.shenzhen.historicalYesterday.iconDay` | str | `101` |
| `weatherLibrary.shenzhen.historicalYesterday.textDay` | str | `多云` |
| `weatherLibrary.shenzhen.historicalYesterday.iconNight` | str | `150` |
| `weatherLibrary.shenzhen.historicalYesterday.textNight` | str | `晴` |
| `weatherLibrary.shenzhen.historicalYesterday.wind360Day` | str | `181` |
| `weatherLibrary.shenzhen.historicalYesterday.windDirDay` | str | `南风` |
| `weatherLibrary.shenzhen.historicalYesterday.windScaleDay` | str | `2` |
| `weatherLibrary.shenzhen.historicalYesterday.windSpeedDay` | str | `10` |
| `weatherLibrary.shenzhen.historicalYesterday.wind360Night` | str | `164` |
| `weatherLibrary.shenzhen.historicalYesterday.windDirNight` | str | `南风` |
| `weatherLibrary.shenzhen.historicalYesterday.windScaleNight` | str | `1` |
| `weatherLibrary.shenzhen.historicalYesterday.windSpeedNight` | str | `2` |
| `weatherLibrary.shenzhen.historicalYesterday.humidity` | str | `75` |
| `weatherLibrary.shenzhen.historicalYesterday.precip` | str | `0.0` |
| `weatherLibrary.shenzhen.historicalYesterday.pressure` | str | `1005` |
| `weatherLibrary.shenzhen.historicalYesterday.vis` | str |  |
| `weatherLibrary.shenzhen.historicalYesterday.cloud` | str |  |
| `weatherLibrary.shenzhen.historicalYesterday.uvIndex` | str |  |
| `weatherLibrary.shenzhen.airQualityForecast` | array&lt;object&gt; | (3 项) |
| `weatherLibrary.shenzhen.airQualityForecast[].forecastStartTime` | str | `2026-05-07T16:00Z` |
| `weatherLibrary.shenzhen.airQualityForecast[].forecastEndTime` | str | `2026-05-08T16:00Z` |
| `weatherLibrary.shenzhen.airQualityForecast[].aqi` | str | `46` |
| `weatherLibrary.shenzhen.airQualityForecast[].level` | str | `1` |
| `weatherLibrary.shenzhen.airQualityForecast[].category` | str | `优` |
| `weatherLibrary.shenzhen.airQualityForecast[].primaryPollutant` | str |  |
| `weatherLibrary.hangzhou` | object |  |
| `weatherLibrary.hangzhou.lonLat` | str | `120.1551,30.2741` |
| `weatherLibrary.hangzhou.locationName` | str | `拱墅区 米市巷街道` |
| `weatherLibrary.hangzhou.bundle` | object |  |
| `weatherLibrary.hangzhou.bundle.now` | object |  |
| `weatherLibrary.hangzhou.bundle.now.obsTime` | str | `2026-05-08T12:42+08:00` |
| `weatherLibrary.hangzhou.bundle.now.temp` | str | `16` |
| `weatherLibrary.hangzhou.bundle.now.feelsLike` | str | `15` |
| `weatherLibrary.hangzhou.bundle.now.icon` | str | `502` |
| `weatherLibrary.hangzhou.bundle.now.text` | str | `霾` |
| `weatherLibrary.hangzhou.bundle.now.wind360` | str | `142` |
| `weatherLibrary.hangzhou.bundle.now.windDir` | str | `东南风` |
| `weatherLibrary.hangzhou.bundle.now.windScale` | str | `2` |
| `weatherLibrary.hangzhou.bundle.now.windSpeed` | str | `10` |
| `weatherLibrary.hangzhou.bundle.now.humidity` | str | `61` |
| `weatherLibrary.hangzhou.bundle.now.precip` | str | `0.0` |
| `weatherLibrary.hangzhou.bundle.now.pressure` | str | `1010` |
| `weatherLibrary.hangzhou.bundle.now.vis` | str | `4` |
| `weatherLibrary.hangzhou.bundle.now.cloud` | str | `100` |
| `weatherLibrary.hangzhou.bundle.now.dew` | str | `8` |
| `weatherLibrary.hangzhou.bundle.daily` | array&lt;object&gt; | (15 项) |
| `weatherLibrary.hangzhou.bundle.daily[].fxDate` | str | `2026-05-08` |
| `weatherLibrary.hangzhou.bundle.daily[].sunrise` | str | `05:57` |
| `weatherLibrary.hangzhou.bundle.daily[].sunset` | str | `18:15` |
| `weatherLibrary.hangzhou.bundle.daily[].moonrise` | str | `11:16` |
| `weatherLibrary.hangzhou.bundle.daily[].moonset` | str | `01:17` |
| `weatherLibrary.hangzhou.bundle.daily[].moonPhase` | str | `上弦月` |
| `weatherLibrary.hangzhou.bundle.daily[].moonPhaseIcon` | str | `802` |
| `weatherLibrary.hangzhou.bundle.daily[].tempMax` | str | `19` |
| `weatherLibrary.hangzhou.bundle.daily[].tempMin` | str | `12` |
| `weatherLibrary.hangzhou.bundle.daily[].iconDay` | str | `305` |
| `weatherLibrary.hangzhou.bundle.daily[].textDay` | str | `小雨` |
| `weatherLibrary.hangzhou.bundle.daily[].iconNight` | str | `305` |
| `weatherLibrary.hangzhou.bundle.daily[].textNight` | str | `小雨` |
| `weatherLibrary.hangzhou.bundle.daily[].wind360Day` | str | `45` |
| `weatherLibrary.hangzhou.bundle.daily[].windDirDay` | str | `东北风` |
| `weatherLibrary.hangzhou.bundle.daily[].windScaleDay` | str | `1` |
| `weatherLibrary.hangzhou.bundle.daily[].windSpeedDay` | str | `3` |
| `weatherLibrary.hangzhou.bundle.daily[].wind360Night` | str | `45` |
| `weatherLibrary.hangzhou.bundle.daily[].windDirNight` | str | `东北风` |
| `weatherLibrary.hangzhou.bundle.daily[].windScaleNight` | str | `1` |
| `weatherLibrary.hangzhou.bundle.daily[].windSpeedNight` | str | `3` |
| `weatherLibrary.hangzhou.bundle.daily[].humidity` | str | `95` |
| `weatherLibrary.hangzhou.bundle.daily[].precip` | str | `0.0` |
| `weatherLibrary.hangzhou.bundle.daily[].pressure` | str | `1013` |
| `weatherLibrary.hangzhou.bundle.daily[].vis` | str | `19` |
| `weatherLibrary.hangzhou.bundle.daily[].cloud` | str | `6` |
| `weatherLibrary.hangzhou.bundle.daily[].uvIndex` | str | `3` |
| `weatherLibrary.hangzhou.bundle.hourly` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.hangzhou.bundle.hourly[].fxTime` | str | `2026-05-08T13:00+08:00` |
| `weatherLibrary.hangzhou.bundle.hourly[].temp` | str | `17` |
| `weatherLibrary.hangzhou.bundle.hourly[].icon` | str | `101` |
| `weatherLibrary.hangzhou.bundle.hourly[].text` | str | `多云` |
| `weatherLibrary.hangzhou.bundle.hourly[].wind360` | str | `91` |
| `weatherLibrary.hangzhou.bundle.hourly[].windDir` | str | `东风` |
| `weatherLibrary.hangzhou.bundle.hourly[].windScale` | str | `2` |
| `weatherLibrary.hangzhou.bundle.hourly[].windSpeed` | str | `7` |
| `weatherLibrary.hangzhou.bundle.hourly[].humidity` | str | `52` |
| `weatherLibrary.hangzhou.bundle.hourly[].pop` | str | `0` |
| `weatherLibrary.hangzhou.bundle.hourly[].precip` | str | `0.0` |
| `weatherLibrary.hangzhou.bundle.hourly[].pressure` | str | `1012` |
| `weatherLibrary.hangzhou.bundle.hourly[].cloud` | str | `100` |
| `weatherLibrary.hangzhou.bundle.hourly[].dew` | str | `8` |
| `weatherLibrary.hangzhou.bundle.indices` | array&lt;object&gt; | (5 项) |
| `weatherLibrary.hangzhou.bundle.indices[].date` | str | `2026-05-08` |
| `weatherLibrary.hangzhou.bundle.indices[].type` | str | `1` |
| `weatherLibrary.hangzhou.bundle.indices[].name` | str | `运动指数` |
| `weatherLibrary.hangzhou.bundle.indices[].level` | str | `3` |
| `weatherLibrary.hangzhou.bundle.indices[].category` | str | `较不宜` |
| `weatherLibrary.hangzhou.bundle.indices[].text` | str | `有扬沙或浮尘，建议适当停止户外运动，选择在室内进行运动，以避免吸入更多沙尘，有损健康。` |
| `weatherLibrary.hangzhou.bundle.warnings` | array | (0 项) |
| `weatherLibrary.hangzhou.bundle.airQuality` | object |  |
| `weatherLibrary.hangzhou.bundle.airQuality.pubTime` | str | `2026-05-08T04:45:19.173Z` |
| `weatherLibrary.hangzhou.bundle.airQuality.aqi` | str | `137` |
| `weatherLibrary.hangzhou.bundle.airQuality.level` | str | `3` |
| `weatherLibrary.hangzhou.bundle.airQuality.category` | str | `轻度污染` |
| `weatherLibrary.hangzhou.bundle.airQuality.primaryPollutant` | str | `颗粒物（粒径小于等于2.5µm）` |
| `weatherLibrary.hangzhou.bundle.airQuality.pm10` | str | `149.33` |
| `weatherLibrary.hangzhou.bundle.airQuality.pm2p5` | str | `103.83` |
| `weatherLibrary.hangzhou.bundle.airQuality.no2` | str | `53.17` |
| `weatherLibrary.hangzhou.bundle.airQuality.so2` | str | `9.83` |
| `weatherLibrary.hangzhou.bundle.airQuality.co` | str | `0.78` |
| `weatherLibrary.hangzhou.bundle.airQuality.o3` | str | `59.67` |
| `weatherLibrary.hangzhou.bundle.minutely` | object |  |
| `weatherLibrary.hangzhou.bundle.minutely.summary` | str | `未来两小时无降水` |
| `weatherLibrary.hangzhou.bundle.minutely.minutely` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.hangzhou.historicalYesterday` | object |  |
| `weatherLibrary.hangzhou.historicalYesterday.fxDate` | str | `2026-05-07` |
| `weatherLibrary.hangzhou.historicalYesterday.sunrise` | str | `05:58` |
| `weatherLibrary.hangzhou.historicalYesterday.sunset` | str | `18:14` |
| `weatherLibrary.hangzhou.historicalYesterday.moonrise` | str | `10:09` |
| `weatherLibrary.hangzhou.historicalYesterday.moonset` | str | `00:12` |
| `weatherLibrary.hangzhou.historicalYesterday.moonPhase` | str | `蛾眉月` |
| `weatherLibrary.hangzhou.historicalYesterday.moonPhaseIcon` | str |  |
| `weatherLibrary.hangzhou.historicalYesterday.tempMax` | str | `20` |
| `weatherLibrary.hangzhou.historicalYesterday.tempMin` | str | `10` |
| `weatherLibrary.hangzhou.historicalYesterday.iconDay` | str | `101` |
| `weatherLibrary.hangzhou.historicalYesterday.textDay` | str | `多云` |
| `weatherLibrary.hangzhou.historicalYesterday.iconNight` | str | `151` |
| `weatherLibrary.hangzhou.historicalYesterday.textNight` | str | `多云` |
| `weatherLibrary.hangzhou.historicalYesterday.wind360Day` | str | `78` |
| `weatherLibrary.hangzhou.historicalYesterday.windDirDay` | str | `东风` |
| `weatherLibrary.hangzhou.historicalYesterday.windScaleDay` | str | `1` |
| `weatherLibrary.hangzhou.historicalYesterday.windSpeedDay` | str | `4` |
| `weatherLibrary.hangzhou.historicalYesterday.wind360Night` | str | `172` |
| `weatherLibrary.hangzhou.historicalYesterday.windDirNight` | str | `南风` |
| `weatherLibrary.hangzhou.historicalYesterday.windScaleNight` | str | `1` |
| `weatherLibrary.hangzhou.historicalYesterday.windSpeedNight` | str | `5` |
| `weatherLibrary.hangzhou.historicalYesterday.humidity` | str | `67` |
| `weatherLibrary.hangzhou.historicalYesterday.precip` | str | `0.0` |
| `weatherLibrary.hangzhou.historicalYesterday.pressure` | str | `1011` |
| `weatherLibrary.hangzhou.historicalYesterday.vis` | str |  |
| `weatherLibrary.hangzhou.historicalYesterday.cloud` | str |  |
| `weatherLibrary.hangzhou.historicalYesterday.uvIndex` | str |  |
| `weatherLibrary.hangzhou.airQualityForecast` | array&lt;object&gt; | (3 项) |
| `weatherLibrary.hangzhou.airQualityForecast[].forecastStartTime` | str | `2026-05-07T16:00Z` |
| `weatherLibrary.hangzhou.airQualityForecast[].forecastEndTime` | str | `2026-05-08T16:00Z` |
| `weatherLibrary.hangzhou.airQualityForecast[].aqi` | str | `77` |
| `weatherLibrary.hangzhou.airQualityForecast[].level` | str | `2` |
| `weatherLibrary.hangzhou.airQualityForecast[].category` | str | `良` |
| `weatherLibrary.hangzhou.airQualityForecast[].primaryPollutant` | str | `颗粒物（粒径小于等于10µm）` |
| `weatherLibrary.chengdu` | object |  |
| `weatherLibrary.chengdu.lonLat` | str | `104.0665,30.5728` |
| `weatherLibrary.chengdu.locationName` | str | `武侯区 桂溪街道` |
| `weatherLibrary.chengdu.bundle` | object |  |
| `weatherLibrary.chengdu.bundle.now` | object |  |
| `weatherLibrary.chengdu.bundle.now.obsTime` | str | `2026-05-08T12:42+08:00` |
| `weatherLibrary.chengdu.bundle.now.temp` | str | `23` |
| `weatherLibrary.chengdu.bundle.now.feelsLike` | str | `21` |
| `weatherLibrary.chengdu.bundle.now.icon` | str | `101` |
| `weatherLibrary.chengdu.bundle.now.text` | str | `多云` |
| `weatherLibrary.chengdu.bundle.now.wind360` | str | `313` |
| `weatherLibrary.chengdu.bundle.now.windDir` | str | `西北风` |
| `weatherLibrary.chengdu.bundle.now.windScale` | str | `1` |
| `weatherLibrary.chengdu.bundle.now.windSpeed` | str | `4` |
| `weatherLibrary.chengdu.bundle.now.humidity` | str | `38` |
| `weatherLibrary.chengdu.bundle.now.precip` | str | `0.0` |
| `weatherLibrary.chengdu.bundle.now.pressure` | str | `956` |
| `weatherLibrary.chengdu.bundle.now.vis` | str | `16` |
| `weatherLibrary.chengdu.bundle.now.cloud` | str | `10` |
| `weatherLibrary.chengdu.bundle.now.dew` | str | `9` |
| `weatherLibrary.chengdu.bundle.daily` | array&lt;object&gt; | (15 项) |
| `weatherLibrary.chengdu.bundle.daily[].fxDate` | str | `2026-05-08` |
| `weatherLibrary.chengdu.bundle.daily[].sunrise` | str | `07:02` |
| `weatherLibrary.chengdu.bundle.daily[].sunset` | str | `19:19` |
| `weatherLibrary.chengdu.bundle.daily[].moonrise` | str | `12:23` |
| `weatherLibrary.chengdu.bundle.daily[].moonset` | str | `02:25` |
| `weatherLibrary.chengdu.bundle.daily[].moonPhase` | str | `上弦月` |
| `weatherLibrary.chengdu.bundle.daily[].moonPhaseIcon` | str | `802` |
| `weatherLibrary.chengdu.bundle.daily[].tempMax` | str | `23` |
| `weatherLibrary.chengdu.bundle.daily[].tempMin` | str | `12` |
| `weatherLibrary.chengdu.bundle.daily[].iconDay` | str | `101` |
| `weatherLibrary.chengdu.bundle.daily[].textDay` | str | `多云` |
| `weatherLibrary.chengdu.bundle.daily[].iconNight` | str | `151` |
| `weatherLibrary.chengdu.bundle.daily[].textNight` | str | `多云` |
| `weatherLibrary.chengdu.bundle.daily[].wind360Day` | str | `0` |
| `weatherLibrary.chengdu.bundle.daily[].windDirDay` | str | `北风` |
| `weatherLibrary.chengdu.bundle.daily[].windScaleDay` | str | `1` |
| `weatherLibrary.chengdu.bundle.daily[].windSpeedDay` | str | `3` |
| `weatherLibrary.chengdu.bundle.daily[].wind360Night` | str | `0` |
| `weatherLibrary.chengdu.bundle.daily[].windDirNight` | str | `北风` |
| `weatherLibrary.chengdu.bundle.daily[].windScaleNight` | str | `1` |
| `weatherLibrary.chengdu.bundle.daily[].windSpeedNight` | str | `3` |
| `weatherLibrary.chengdu.bundle.daily[].humidity` | str | `60` |
| `weatherLibrary.chengdu.bundle.daily[].precip` | str | `0.0` |
| `weatherLibrary.chengdu.bundle.daily[].pressure` | str | `954` |
| `weatherLibrary.chengdu.bundle.daily[].vis` | str | `25` |
| `weatherLibrary.chengdu.bundle.daily[].cloud` | str | `2` |
| `weatherLibrary.chengdu.bundle.daily[].uvIndex` | str | `8` |
| `weatherLibrary.chengdu.bundle.hourly` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.chengdu.bundle.hourly[].fxTime` | str | `2026-05-08T13:00+08:00` |
| `weatherLibrary.chengdu.bundle.hourly[].temp` | str | `21` |
| `weatherLibrary.chengdu.bundle.hourly[].icon` | str | `100` |
| `weatherLibrary.chengdu.bundle.hourly[].text` | str | `晴` |
| `weatherLibrary.chengdu.bundle.hourly[].wind360` | str | `151` |
| `weatherLibrary.chengdu.bundle.hourly[].windDir` | str | `东南风` |
| `weatherLibrary.chengdu.bundle.hourly[].windScale` | str | `2` |
| `weatherLibrary.chengdu.bundle.hourly[].windSpeed` | str | `10` |
| `weatherLibrary.chengdu.bundle.hourly[].humidity` | str | `44` |
| `weatherLibrary.chengdu.bundle.hourly[].pop` | str | `0` |
| `weatherLibrary.chengdu.bundle.hourly[].precip` | str | `0.0` |
| `weatherLibrary.chengdu.bundle.hourly[].pressure` | str | `955` |
| `weatherLibrary.chengdu.bundle.hourly[].cloud` | str | `59` |
| `weatherLibrary.chengdu.bundle.hourly[].dew` | str | `8` |
| `weatherLibrary.chengdu.bundle.indices` | array&lt;object&gt; | (5 项) |
| `weatherLibrary.chengdu.bundle.indices[].date` | str | `2026-05-08` |
| `weatherLibrary.chengdu.bundle.indices[].type` | str | `1` |
| `weatherLibrary.chengdu.bundle.indices[].name` | str | `运动指数` |
| `weatherLibrary.chengdu.bundle.indices[].level` | str | `1` |
| `weatherLibrary.chengdu.bundle.indices[].category` | str | `适宜` |
| `weatherLibrary.chengdu.bundle.indices[].text` | str | `天气较好，赶快投身大自然参与户外运动，尽情感受运动的快乐吧。` |
| `weatherLibrary.chengdu.bundle.warnings` | array | (0 项) |
| `weatherLibrary.chengdu.bundle.airQuality` | object |  |
| `weatherLibrary.chengdu.bundle.airQuality.pubTime` | str | `2026-05-08T04:45:19.852Z` |
| `weatherLibrary.chengdu.bundle.airQuality.aqi` | str | `45` |
| `weatherLibrary.chengdu.bundle.airQuality.level` | str | `1` |
| `weatherLibrary.chengdu.bundle.airQuality.category` | str | `优` |
| `weatherLibrary.chengdu.bundle.airQuality.primaryPollutant` | str |  |
| `weatherLibrary.chengdu.bundle.airQuality.pm10` | str | `44.75` |
| `weatherLibrary.chengdu.bundle.airQuality.pm2p5` | str | `26.25` |
| `weatherLibrary.chengdu.bundle.airQuality.no2` | str | `28` |
| `weatherLibrary.chengdu.bundle.airQuality.so2` | str | `5` |
| `weatherLibrary.chengdu.bundle.airQuality.co` | str | `0.63` |
| `weatherLibrary.chengdu.bundle.airQuality.o3` | str | `67.75` |
| `weatherLibrary.chengdu.bundle.minutely` | object |  |
| `weatherLibrary.chengdu.bundle.minutely.summary` | str | `未来两小时无降水` |
| `weatherLibrary.chengdu.bundle.minutely.minutely` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.chengdu.historicalYesterday` | object |  |
| `weatherLibrary.chengdu.historicalYesterday.fxDate` | str | `2026-05-07` |
| `weatherLibrary.chengdu.historicalYesterday.sunrise` | str | `07:02` |
| `weatherLibrary.chengdu.historicalYesterday.sunset` | str | `19:19` |
| `weatherLibrary.chengdu.historicalYesterday.moonrise` | str | `11:16` |
| `weatherLibrary.chengdu.historicalYesterday.moonset` | str | `01:20` |
| `weatherLibrary.chengdu.historicalYesterday.moonPhase` | str | `蛾眉月` |
| `weatherLibrary.chengdu.historicalYesterday.moonPhaseIcon` | str |  |
| `weatherLibrary.chengdu.historicalYesterday.tempMax` | str | `18` |
| `weatherLibrary.chengdu.historicalYesterday.tempMin` | str | `14` |
| `weatherLibrary.chengdu.historicalYesterday.iconDay` | str | `104` |
| `weatherLibrary.chengdu.historicalYesterday.textDay` | str | `阴` |
| `weatherLibrary.chengdu.historicalYesterday.iconNight` | str | `104` |
| `weatherLibrary.chengdu.historicalYesterday.textNight` | str | `阴` |
| `weatherLibrary.chengdu.historicalYesterday.wind360Day` | str | `224` |
| `weatherLibrary.chengdu.historicalYesterday.windDirDay` | str | `西南风` |
| `weatherLibrary.chengdu.historicalYesterday.windScaleDay` | str | `1` |
| `weatherLibrary.chengdu.historicalYesterday.windSpeedDay` | str | `2` |
| `weatherLibrary.chengdu.historicalYesterday.wind360Night` | str | `6` |
| `weatherLibrary.chengdu.historicalYesterday.windDirNight` | str | `北风` |
| `weatherLibrary.chengdu.historicalYesterday.windScaleNight` | str | `1` |
| `weatherLibrary.chengdu.historicalYesterday.windSpeedNight` | str | `1` |
| `weatherLibrary.chengdu.historicalYesterday.humidity` | str | `75` |
| `weatherLibrary.chengdu.historicalYesterday.precip` | str | `0.0` |
| `weatherLibrary.chengdu.historicalYesterday.pressure` | str | `955` |
| `weatherLibrary.chengdu.historicalYesterday.vis` | str |  |
| `weatherLibrary.chengdu.historicalYesterday.cloud` | str |  |
| `weatherLibrary.chengdu.historicalYesterday.uvIndex` | str |  |
| `weatherLibrary.chengdu.airQualityForecast` | array&lt;object&gt; | (3 项) |
| `weatherLibrary.chengdu.airQualityForecast[].forecastStartTime` | str | `2026-05-07T16:00Z` |
| `weatherLibrary.chengdu.airQualityForecast[].forecastEndTime` | str | `2026-05-08T16:00Z` |
| `weatherLibrary.chengdu.airQualityForecast[].aqi` | str | `47` |
| `weatherLibrary.chengdu.airQualityForecast[].level` | str | `1` |
| `weatherLibrary.chengdu.airQualityForecast[].category` | str | `优` |
| `weatherLibrary.chengdu.airQualityForecast[].primaryPollutant` | str |  |
| `weatherLibrary.shanghai` | object |  |
| `weatherLibrary.shanghai.lonLat` | str | `121.4737,31.2304` |
| `weatherLibrary.shanghai.locationName` | str | `黄浦区 南京东路街道` |
| `weatherLibrary.shanghai.bundle` | object |  |
| `weatherLibrary.shanghai.bundle.now` | object |  |
| `weatherLibrary.shanghai.bundle.now.obsTime` | str | `2026-05-08T12:42+08:00` |
| `weatherLibrary.shanghai.bundle.now.temp` | str | `16` |
| `weatherLibrary.shanghai.bundle.now.feelsLike` | str | `13` |
| `weatherLibrary.shanghai.bundle.now.icon` | str | `104` |
| `weatherLibrary.shanghai.bundle.now.text` | str | `阴` |
| `weatherLibrary.shanghai.bundle.now.wind360` | str | `359` |
| `weatherLibrary.shanghai.bundle.now.windDir` | str | `北风` |
| `weatherLibrary.shanghai.bundle.now.windScale` | str | `1` |
| `weatherLibrary.shanghai.bundle.now.windSpeed` | str | `3` |
| `weatherLibrary.shanghai.bundle.now.humidity` | str | `47` |
| `weatherLibrary.shanghai.bundle.now.precip` | str | `0.0` |
| `weatherLibrary.shanghai.bundle.now.pressure` | str | `1017` |
| `weatherLibrary.shanghai.bundle.now.vis` | str | `18` |
| `weatherLibrary.shanghai.bundle.now.cloud` | str | `100` |
| `weatherLibrary.shanghai.bundle.now.dew` | str | `7` |
| `weatherLibrary.shanghai.bundle.daily` | array&lt;object&gt; | (15 项) |
| `weatherLibrary.shanghai.bundle.daily[].fxDate` | str | `2026-05-08` |
| `weatherLibrary.shanghai.bundle.daily[].sunrise` | str | `05:52` |
| `weatherLibrary.shanghai.bundle.daily[].sunset` | str | `18:09` |
| `weatherLibrary.shanghai.bundle.daily[].moonrise` | str | `11:07` |
| `weatherLibrary.shanghai.bundle.daily[].moonset` | str | `01:14` |
| `weatherLibrary.shanghai.bundle.daily[].moonPhase` | str | `上弦月` |
| `weatherLibrary.shanghai.bundle.daily[].moonPhaseIcon` | str | `802` |
| `weatherLibrary.shanghai.bundle.daily[].tempMax` | str | `18` |
| `weatherLibrary.shanghai.bundle.daily[].tempMin` | str | `11` |
| `weatherLibrary.shanghai.bundle.daily[].iconDay` | str | `104` |
| `weatherLibrary.shanghai.bundle.daily[].textDay` | str | `阴` |
| `weatherLibrary.shanghai.bundle.daily[].iconNight` | str | `305` |
| `weatherLibrary.shanghai.bundle.daily[].textNight` | str | `小雨` |
| `weatherLibrary.shanghai.bundle.daily[].wind360Day` | str | `135` |
| `weatherLibrary.shanghai.bundle.daily[].windDirDay` | str | `东南风` |
| `weatherLibrary.shanghai.bundle.daily[].windScaleDay` | str | `1` |
| `weatherLibrary.shanghai.bundle.daily[].windSpeedDay` | str | `3` |
| `weatherLibrary.shanghai.bundle.daily[].wind360Night` | str | `135` |
| `weatherLibrary.shanghai.bundle.daily[].windDirNight` | str | `东南风` |
| `weatherLibrary.shanghai.bundle.daily[].windScaleNight` | str | `1` |
| `weatherLibrary.shanghai.bundle.daily[].windSpeedNight` | str | `3` |
| `weatherLibrary.shanghai.bundle.daily[].humidity` | str | `86` |
| `weatherLibrary.shanghai.bundle.daily[].precip` | str | `0.0` |
| `weatherLibrary.shanghai.bundle.daily[].pressure` | str | `1016` |
| `weatherLibrary.shanghai.bundle.daily[].vis` | str | `24` |
| `weatherLibrary.shanghai.bundle.daily[].cloud` | str | `1` |
| `weatherLibrary.shanghai.bundle.daily[].uvIndex` | str | `3` |
| `weatherLibrary.shanghai.bundle.hourly` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.shanghai.bundle.hourly[].fxTime` | str | `2026-05-08T13:00+08:00` |
| `weatherLibrary.shanghai.bundle.hourly[].temp` | str | `18` |
| `weatherLibrary.shanghai.bundle.hourly[].icon` | str | `101` |
| `weatherLibrary.shanghai.bundle.hourly[].text` | str | `多云` |
| `weatherLibrary.shanghai.bundle.hourly[].wind360` | str | `138` |
| `weatherLibrary.shanghai.bundle.hourly[].windDir` | str | `东南风` |
| `weatherLibrary.shanghai.bundle.hourly[].windScale` | str | `2` |
| `weatherLibrary.shanghai.bundle.hourly[].windSpeed` | str | `10` |
| `weatherLibrary.shanghai.bundle.hourly[].humidity` | str | `47` |
| `weatherLibrary.shanghai.bundle.hourly[].pop` | str | `0` |
| `weatherLibrary.shanghai.bundle.hourly[].precip` | str | `0.0` |
| `weatherLibrary.shanghai.bundle.hourly[].pressure` | str | `1016` |
| `weatherLibrary.shanghai.bundle.hourly[].cloud` | str | `100` |
| `weatherLibrary.shanghai.bundle.hourly[].dew` | str | `6` |
| `weatherLibrary.shanghai.bundle.indices` | array&lt;object&gt; | (5 项) |
| `weatherLibrary.shanghai.bundle.indices[].date` | str | `2026-05-08` |
| `weatherLibrary.shanghai.bundle.indices[].type` | str | `1` |
| `weatherLibrary.shanghai.bundle.indices[].name` | str | `运动指数` |
| `weatherLibrary.shanghai.bundle.indices[].level` | str | `2` |
| `weatherLibrary.shanghai.bundle.indices[].category` | str | `较适宜` |
| `weatherLibrary.shanghai.bundle.indices[].text` | str | `阴天，较适宜进行各种户内外运动。` |
| `weatherLibrary.shanghai.bundle.warnings` | array | (0 项) |
| `weatherLibrary.shanghai.bundle.airQuality` | object |  |
| `weatherLibrary.shanghai.bundle.airQuality.pubTime` | str | `2026-05-08T04:45:20.534Z` |
| `weatherLibrary.shanghai.bundle.airQuality.aqi` | str | `26` |
| `weatherLibrary.shanghai.bundle.airQuality.level` | str | `1` |
| `weatherLibrary.shanghai.bundle.airQuality.category` | str | `优` |
| `weatherLibrary.shanghai.bundle.airQuality.primaryPollutant` | str |  |
| `weatherLibrary.shanghai.bundle.airQuality.pm10` | str | `24.8` |
| `weatherLibrary.shanghai.bundle.airQuality.pm2p5` | str | `15.9` |
| `weatherLibrary.shanghai.bundle.airQuality.no2` | str | `36.4` |
| `weatherLibrary.shanghai.bundle.airQuality.so2` | str | `6.3` |
| `weatherLibrary.shanghai.bundle.airQuality.co` | str | `0.4` |
| `weatherLibrary.shanghai.bundle.airQuality.o3` | str | `82.4` |
| `weatherLibrary.shanghai.bundle.minutely` | object |  |
| `weatherLibrary.shanghai.bundle.minutely.summary` | str | `未来两小时无降水` |
| `weatherLibrary.shanghai.bundle.minutely.minutely` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.shanghai.historicalYesterday` | object |  |
| `weatherLibrary.shanghai.historicalYesterday.fxDate` | str | `2026-05-07` |
| `weatherLibrary.shanghai.historicalYesterday.sunrise` | str | `05:53` |
| `weatherLibrary.shanghai.historicalYesterday.sunset` | str | `18:09` |
| `weatherLibrary.shanghai.historicalYesterday.moonrise` | str | `10:00` |
| `weatherLibrary.shanghai.historicalYesterday.moonset` | str | `00:09` |
| `weatherLibrary.shanghai.historicalYesterday.moonPhase` | str | `蛾眉月` |
| `weatherLibrary.shanghai.historicalYesterday.moonPhaseIcon` | str |  |
| `weatherLibrary.shanghai.historicalYesterday.tempMax` | str | `18` |
| `weatherLibrary.shanghai.historicalYesterday.tempMin` | str | `10` |
| `weatherLibrary.shanghai.historicalYesterday.iconDay` | str | `101` |
| `weatherLibrary.shanghai.historicalYesterday.textDay` | str | `多云` |
| `weatherLibrary.shanghai.historicalYesterday.iconNight` | str | `501` |
| `weatherLibrary.shanghai.historicalYesterday.textNight` | str | `雾` |
| `weatherLibrary.shanghai.historicalYesterday.wind360Day` | str | `95` |
| `weatherLibrary.shanghai.historicalYesterday.windDirDay` | str | `东风` |
| `weatherLibrary.shanghai.historicalYesterday.windScaleDay` | str | `1` |
| `weatherLibrary.shanghai.historicalYesterday.windSpeedDay` | str | `2` |
| `weatherLibrary.shanghai.historicalYesterday.wind360Night` | str | `344` |
| `weatherLibrary.shanghai.historicalYesterday.windDirNight` | str | `北风` |
| `weatherLibrary.shanghai.historicalYesterday.windScaleNight` | str | `1` |
| `weatherLibrary.shanghai.historicalYesterday.windSpeedNight` | str | `4` |
| `weatherLibrary.shanghai.historicalYesterday.humidity` | str | `71` |
| `weatherLibrary.shanghai.historicalYesterday.precip` | str | `0.0` |
| `weatherLibrary.shanghai.historicalYesterday.pressure` | str | `1016` |
| `weatherLibrary.shanghai.historicalYesterday.vis` | str |  |
| `weatherLibrary.shanghai.historicalYesterday.cloud` | str |  |
| `weatherLibrary.shanghai.historicalYesterday.uvIndex` | str |  |
| `weatherLibrary.shanghai.airQualityForecast` | array&lt;object&gt; | (3 项) |
| `weatherLibrary.shanghai.airQualityForecast[].forecastStartTime` | str | `2026-05-07T16:00Z` |
| `weatherLibrary.shanghai.airQualityForecast[].forecastEndTime` | str | `2026-05-08T16:00Z` |
| `weatherLibrary.shanghai.airQualityForecast[].aqi` | str | `73` |
| `weatherLibrary.shanghai.airQualityForecast[].level` | str | `2` |
| `weatherLibrary.shanghai.airQualityForecast[].category` | str | `良` |
| `weatherLibrary.shanghai.airQualityForecast[].primaryPollutant` | str | `颗粒物（粒径小于等于2.5µm）` |
| `weatherLibrary.nanjing` | object |  |
| `weatherLibrary.nanjing.lonLat` | str | `118.7975,32.0871` |
| `weatherLibrary.nanjing.locationName` | str | `玄武区 红山街道` |
| `weatherLibrary.nanjing.bundle` | object |  |
| `weatherLibrary.nanjing.bundle.now` | object |  |
| `weatherLibrary.nanjing.bundle.now.obsTime` | str | `2026-05-08T12:42+08:00` |
| `weatherLibrary.nanjing.bundle.now.temp` | str | `18` |
| `weatherLibrary.nanjing.bundle.now.feelsLike` | str | `12` |
| `weatherLibrary.nanjing.bundle.now.icon` | str | `502` |
| `weatherLibrary.nanjing.bundle.now.text` | str | `霾` |
| `weatherLibrary.nanjing.bundle.now.wind360` | str | `149` |
| `weatherLibrary.nanjing.bundle.now.windDir` | str | `东南风` |
| `weatherLibrary.nanjing.bundle.now.windScale` | str | `3` |
| `weatherLibrary.nanjing.bundle.now.windSpeed` | str | `19` |
| `weatherLibrary.nanjing.bundle.now.humidity` | str | `42` |
| `weatherLibrary.nanjing.bundle.now.precip` | str | `0.0` |
| `weatherLibrary.nanjing.bundle.now.pressure` | str | `1011` |
| `weatherLibrary.nanjing.bundle.now.vis` | str | `6` |
| `weatherLibrary.nanjing.bundle.now.cloud` | str | `100` |
| `weatherLibrary.nanjing.bundle.now.dew` | str | `9` |
| `weatherLibrary.nanjing.bundle.daily` | array&lt;object&gt; | (15 项) |
| `weatherLibrary.nanjing.bundle.daily[].fxDate` | str | `2026-05-08` |
| `weatherLibrary.nanjing.bundle.daily[].sunrise` | str | `06:02` |
| `weatherLibrary.nanjing.bundle.daily[].sunset` | str | `18:20` |
| `weatherLibrary.nanjing.bundle.daily[].moonrise` | str | `11:16` |
| `weatherLibrary.nanjing.bundle.daily[].moonset` | str | `01:28` |
| `weatherLibrary.nanjing.bundle.daily[].moonPhase` | str | `上弦月` |
| `weatherLibrary.nanjing.bundle.daily[].moonPhaseIcon` | str | `802` |
| `weatherLibrary.nanjing.bundle.daily[].tempMax` | str | `19` |
| `weatherLibrary.nanjing.bundle.daily[].tempMin` | str | `12` |
| `weatherLibrary.nanjing.bundle.daily[].iconDay` | str | `101` |
| `weatherLibrary.nanjing.bundle.daily[].textDay` | str | `多云` |
| `weatherLibrary.nanjing.bundle.daily[].iconNight` | str | `104` |
| `weatherLibrary.nanjing.bundle.daily[].textNight` | str | `阴` |
| `weatherLibrary.nanjing.bundle.daily[].wind360Day` | str | `90` |
| `weatherLibrary.nanjing.bundle.daily[].windDirDay` | str | `东风` |
| `weatherLibrary.nanjing.bundle.daily[].windScaleDay` | str | `4` |
| `weatherLibrary.nanjing.bundle.daily[].windSpeedDay` | str | `24` |
| `weatherLibrary.nanjing.bundle.daily[].wind360Night` | str | `90` |
| `weatherLibrary.nanjing.bundle.daily[].windDirNight` | str | `东风` |
| `weatherLibrary.nanjing.bundle.daily[].windScaleNight` | str | `3` |
| `weatherLibrary.nanjing.bundle.daily[].windSpeedNight` | str | `16` |
| `weatherLibrary.nanjing.bundle.daily[].humidity` | str | `79` |
| `weatherLibrary.nanjing.bundle.daily[].precip` | str | `0.0` |
| `weatherLibrary.nanjing.bundle.daily[].pressure` | str | `1014` |
| `weatherLibrary.nanjing.bundle.daily[].vis` | str | `25` |
| `weatherLibrary.nanjing.bundle.daily[].cloud` | str | `25` |
| `weatherLibrary.nanjing.bundle.daily[].uvIndex` | str | `3` |
| `weatherLibrary.nanjing.bundle.hourly` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.nanjing.bundle.hourly[].fxTime` | str | `2026-05-08T13:00+08:00` |
| `weatherLibrary.nanjing.bundle.hourly[].temp` | str | `18` |
| `weatherLibrary.nanjing.bundle.hourly[].icon` | str | `101` |
| `weatherLibrary.nanjing.bundle.hourly[].text` | str | `多云` |
| `weatherLibrary.nanjing.bundle.hourly[].wind360` | str | `108` |
| `weatherLibrary.nanjing.bundle.hourly[].windDir` | str | `东风` |
| `weatherLibrary.nanjing.bundle.hourly[].windScale` | str | `5` |
| `weatherLibrary.nanjing.bundle.hourly[].windSpeed` | str | `32` |
| `weatherLibrary.nanjing.bundle.hourly[].humidity` | str | `52` |
| `weatherLibrary.nanjing.bundle.hourly[].pop` | str | `7` |
| `weatherLibrary.nanjing.bundle.hourly[].precip` | str | `0.0` |
| `weatherLibrary.nanjing.bundle.hourly[].pressure` | str | `1013` |
| `weatherLibrary.nanjing.bundle.hourly[].cloud` | str | `100` |
| `weatherLibrary.nanjing.bundle.hourly[].dew` | str | `9` |
| `weatherLibrary.nanjing.bundle.indices` | array&lt;object&gt; | (5 项) |
| `weatherLibrary.nanjing.bundle.indices[].date` | str | `2026-05-08` |
| `weatherLibrary.nanjing.bundle.indices[].type` | str | `1` |
| `weatherLibrary.nanjing.bundle.indices[].name` | str | `运动指数` |
| `weatherLibrary.nanjing.bundle.indices[].level` | str | `3` |
| `weatherLibrary.nanjing.bundle.indices[].category` | str | `较不宜` |
| `weatherLibrary.nanjing.bundle.indices[].text` | str | `有扬沙或浮尘，建议适当停止户外运动，选择在室内进行运动，以避免吸入更多沙尘，有损健康。` |
| `weatherLibrary.nanjing.bundle.warnings` | array | (0 项) |
| `weatherLibrary.nanjing.bundle.airQuality` | object |  |
| `weatherLibrary.nanjing.bundle.airQuality.pubTime` | str | `2026-05-08T04:45:21.279Z` |
| `weatherLibrary.nanjing.bundle.airQuality.aqi` | str | `116` |
| `weatherLibrary.nanjing.bundle.airQuality.level` | str | `3` |
| `weatherLibrary.nanjing.bundle.airQuality.category` | str | `轻度污染` |
| `weatherLibrary.nanjing.bundle.airQuality.primaryPollutant` | str | `颗粒物（粒径小于等于2.5µm）` |
| `weatherLibrary.nanjing.bundle.airQuality.pm10` | str | `111.63` |
| `weatherLibrary.nanjing.bundle.airQuality.pm2p5` | str | `87.38` |
| `weatherLibrary.nanjing.bundle.airQuality.no2` | str | `18.88` |
| `weatherLibrary.nanjing.bundle.airQuality.so2` | str | `7.5` |
| `weatherLibrary.nanjing.bundle.airQuality.co` | str | `0.86` |
| `weatherLibrary.nanjing.bundle.airQuality.o3` | str | `132.25` |
| `weatherLibrary.nanjing.bundle.minutely` | object |  |
| `weatherLibrary.nanjing.bundle.minutely.summary` | str | `15分钟后开始下小雨` |
| `weatherLibrary.nanjing.bundle.minutely.minutely` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.nanjing.historicalYesterday` | object |  |
| `weatherLibrary.nanjing.historicalYesterday.fxDate` | str | `2026-05-07` |
| `weatherLibrary.nanjing.historicalYesterday.sunrise` | str | `06:03` |
| `weatherLibrary.nanjing.historicalYesterday.sunset` | str | `18:20` |
| `weatherLibrary.nanjing.historicalYesterday.moonrise` | str | `10:09` |
| `weatherLibrary.nanjing.historicalYesterday.moonset` | str | `00:23` |
| `weatherLibrary.nanjing.historicalYesterday.moonPhase` | str | `蛾眉月` |
| `weatherLibrary.nanjing.historicalYesterday.moonPhaseIcon` | str |  |
| `weatherLibrary.nanjing.historicalYesterday.tempMax` | str | `19` |
| `weatherLibrary.nanjing.historicalYesterday.tempMin` | str | `7` |
| `weatherLibrary.nanjing.historicalYesterday.iconDay` | str | `101` |
| `weatherLibrary.nanjing.historicalYesterday.textDay` | str | `多云` |
| `weatherLibrary.nanjing.historicalYesterday.iconNight` | str | `104` |
| `weatherLibrary.nanjing.historicalYesterday.textNight` | str | `阴` |
| `weatherLibrary.nanjing.historicalYesterday.wind360Day` | str | `182` |
| `weatherLibrary.nanjing.historicalYesterday.windDirDay` | str | `南风` |
| `weatherLibrary.nanjing.historicalYesterday.windScaleDay` | str | `2` |
| `weatherLibrary.nanjing.historicalYesterday.windSpeedDay` | str | `8` |
| `weatherLibrary.nanjing.historicalYesterday.wind360Night` | str | `337` |
| `weatherLibrary.nanjing.historicalYesterday.windDirNight` | str | `西北风` |
| `weatherLibrary.nanjing.historicalYesterday.windScaleNight` | str | `1` |
| `weatherLibrary.nanjing.historicalYesterday.windSpeedNight` | str | `1` |
| `weatherLibrary.nanjing.historicalYesterday.humidity` | str | `76` |
| `weatherLibrary.nanjing.historicalYesterday.precip` | str | `0.0` |
| `weatherLibrary.nanjing.historicalYesterday.pressure` | str | `1012` |
| `weatherLibrary.nanjing.historicalYesterday.vis` | str |  |
| `weatherLibrary.nanjing.historicalYesterday.cloud` | str |  |
| `weatherLibrary.nanjing.historicalYesterday.uvIndex` | str |  |
| `weatherLibrary.nanjing.airQualityForecast` | array&lt;object&gt; | (3 项) |
| `weatherLibrary.nanjing.airQualityForecast[].forecastStartTime` | str | `2026-05-07T16:00Z` |
| `weatherLibrary.nanjing.airQualityForecast[].forecastEndTime` | str | `2026-05-08T16:00Z` |
| `weatherLibrary.nanjing.airQualityForecast[].aqi` | str | `96` |
| `weatherLibrary.nanjing.airQualityForecast[].level` | str | `2` |
| `weatherLibrary.nanjing.airQualityForecast[].category` | str | `良` |
| `weatherLibrary.nanjing.airQualityForecast[].primaryPollutant` | str | `颗粒物（粒径小于等于10µm）` |
| `weatherLibrary.wuhan` | object |  |
| `weatherLibrary.wuhan.lonLat` | str | `114.4243,30.6067` |
| `weatherLibrary.wuhan.locationName` | str | `洪山区 和平街道` |
| `weatherLibrary.wuhan.bundle` | object |  |
| `weatherLibrary.wuhan.bundle.now` | object |  |
| `weatherLibrary.wuhan.bundle.now.obsTime` | str | `2026-05-08T12:42+08:00` |
| `weatherLibrary.wuhan.bundle.now.temp` | str | `17` |
| `weatherLibrary.wuhan.bundle.now.feelsLike` | str | `17` |
| `weatherLibrary.wuhan.bundle.now.icon` | str | `501` |
| `weatherLibrary.wuhan.bundle.now.text` | str | `雾` |
| `weatherLibrary.wuhan.bundle.now.wind360` | str | `294` |
| `weatherLibrary.wuhan.bundle.now.windDir` | str | `西北风` |
| `weatherLibrary.wuhan.bundle.now.windScale` | str | `1` |
| `weatherLibrary.wuhan.bundle.now.windSpeed` | str | `5` |
| `weatherLibrary.wuhan.bundle.now.humidity` | str | `80` |
| `weatherLibrary.wuhan.bundle.now.precip` | str | `0.0` |
| `weatherLibrary.wuhan.bundle.now.pressure` | str | `1011` |
| `weatherLibrary.wuhan.bundle.now.vis` | str | `5` |
| `weatherLibrary.wuhan.bundle.now.cloud` | str | `99` |
| `weatherLibrary.wuhan.bundle.now.dew` | str | `13` |
| `weatherLibrary.wuhan.bundle.daily` | array&lt;object&gt; | (15 项) |
| `weatherLibrary.wuhan.bundle.daily[].fxDate` | str | `2026-05-08` |
| `weatherLibrary.wuhan.bundle.daily[].sunrise` | str | `06:21` |
| `weatherLibrary.wuhan.bundle.daily[].sunset` | str | `18:38` |
| `weatherLibrary.wuhan.bundle.daily[].moonrise` | str | `11:40` |
| `weatherLibrary.wuhan.bundle.daily[].moonset` | str | `01:42` |
| `weatherLibrary.wuhan.bundle.daily[].moonPhase` | str | `上弦月` |
| `weatherLibrary.wuhan.bundle.daily[].moonPhaseIcon` | str | `802` |
| `weatherLibrary.wuhan.bundle.daily[].tempMax` | str | `19` |
| `weatherLibrary.wuhan.bundle.daily[].tempMin` | str | `10` |
| `weatherLibrary.wuhan.bundle.daily[].iconDay` | str | `305` |
| `weatherLibrary.wuhan.bundle.daily[].textDay` | str | `小雨` |
| `weatherLibrary.wuhan.bundle.daily[].iconNight` | str | `151` |
| `weatherLibrary.wuhan.bundle.daily[].textNight` | str | `多云` |
| `weatherLibrary.wuhan.bundle.daily[].wind360Day` | str | `45` |
| `weatherLibrary.wuhan.bundle.daily[].windDirDay` | str | `东北风` |
| `weatherLibrary.wuhan.bundle.daily[].windScaleDay` | str | `1` |
| `weatherLibrary.wuhan.bundle.daily[].windSpeedDay` | str | `3` |
| `weatherLibrary.wuhan.bundle.daily[].wind360Night` | str | `0` |
| `weatherLibrary.wuhan.bundle.daily[].windDirNight` | str | `北风` |
| `weatherLibrary.wuhan.bundle.daily[].windScaleNight` | str | `1` |
| `weatherLibrary.wuhan.bundle.daily[].windSpeedNight` | str | `3` |
| `weatherLibrary.wuhan.bundle.daily[].humidity` | str | `87` |
| `weatherLibrary.wuhan.bundle.daily[].precip` | str | `1.0` |
| `weatherLibrary.wuhan.bundle.daily[].pressure` | str | `1012` |
| `weatherLibrary.wuhan.bundle.daily[].vis` | str | `24` |
| `weatherLibrary.wuhan.bundle.daily[].cloud` | str | `57` |
| `weatherLibrary.wuhan.bundle.daily[].uvIndex` | str | `2` |
| `weatherLibrary.wuhan.bundle.hourly` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.wuhan.bundle.hourly[].fxTime` | str | `2026-05-08T13:00+08:00` |
| `weatherLibrary.wuhan.bundle.hourly[].temp` | str | `17` |
| `weatherLibrary.wuhan.bundle.hourly[].icon` | str | `101` |
| `weatherLibrary.wuhan.bundle.hourly[].text` | str | `多云` |
| `weatherLibrary.wuhan.bundle.hourly[].wind360` | str | `40` |
| `weatherLibrary.wuhan.bundle.hourly[].windDir` | str | `东北风` |
| `weatherLibrary.wuhan.bundle.hourly[].windScale` | str | `2` |
| `weatherLibrary.wuhan.bundle.hourly[].windSpeed` | str | `7` |
| `weatherLibrary.wuhan.bundle.hourly[].humidity` | str | `78` |
| `weatherLibrary.wuhan.bundle.hourly[].pop` | str | `20` |
| `weatherLibrary.wuhan.bundle.hourly[].precip` | str | `0.0` |
| `weatherLibrary.wuhan.bundle.hourly[].pressure` | str | `1012` |
| `weatherLibrary.wuhan.bundle.hourly[].cloud` | str | `99` |
| `weatherLibrary.wuhan.bundle.hourly[].dew` | str | `13` |
| `weatherLibrary.wuhan.bundle.indices` | array&lt;object&gt; | (5 项) |
| `weatherLibrary.wuhan.bundle.indices[].date` | str | `2026-05-08` |
| `weatherLibrary.wuhan.bundle.indices[].type` | str | `1` |
| `weatherLibrary.wuhan.bundle.indices[].name` | str | `运动指数` |
| `weatherLibrary.wuhan.bundle.indices[].level` | str | `3` |
| `weatherLibrary.wuhan.bundle.indices[].category` | str | `较不宜` |
| `weatherLibrary.wuhan.bundle.indices[].text` | str | `有降水，推荐您在室内进行健身休闲运动；若坚持户外运动，须注意携带雨具并注意避雨防滑。` |
| `weatherLibrary.wuhan.bundle.warnings` | array | (0 项) |
| `weatherLibrary.wuhan.bundle.airQuality` | object |  |
| `weatherLibrary.wuhan.bundle.airQuality.pubTime` | str | `2026-05-08T04:45:22.001Z` |
| `weatherLibrary.wuhan.bundle.airQuality.aqi` | str | `75` |
| `weatherLibrary.wuhan.bundle.airQuality.level` | str | `2` |
| `weatherLibrary.wuhan.bundle.airQuality.category` | str | `良` |
| `weatherLibrary.wuhan.bundle.airQuality.primaryPollutant` | str | `颗粒物（粒径小于等于2.5µm）` |
| `weatherLibrary.wuhan.bundle.airQuality.pm10` | str | `71` |
| `weatherLibrary.wuhan.bundle.airQuality.pm2p5` | str | `55` |
| `weatherLibrary.wuhan.bundle.airQuality.no2` | str | `41` |
| `weatherLibrary.wuhan.bundle.airQuality.so2` | str | `6.67` |
| `weatherLibrary.wuhan.bundle.airQuality.co` | str | `0.8` |
| `weatherLibrary.wuhan.bundle.airQuality.o3` | str | `50` |
| `weatherLibrary.wuhan.bundle.minutely` | object |  |
| `weatherLibrary.wuhan.bundle.minutely.summary` | str | `未来两小时无降水` |
| `weatherLibrary.wuhan.bundle.minutely.minutely` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.wuhan.historicalYesterday` | object |  |
| `weatherLibrary.wuhan.historicalYesterday.fxDate` | str | `2026-05-07` |
| `weatherLibrary.wuhan.historicalYesterday.sunrise` | str | `06:21` |
| `weatherLibrary.wuhan.historicalYesterday.sunset` | str | `18:38` |
| `weatherLibrary.wuhan.historicalYesterday.moonrise` | str | `10:34` |
| `weatherLibrary.wuhan.historicalYesterday.moonset` | str | `00:37` |
| `weatherLibrary.wuhan.historicalYesterday.moonPhase` | str | `蛾眉月` |
| `weatherLibrary.wuhan.historicalYesterday.moonPhaseIcon` | str |  |
| `weatherLibrary.wuhan.historicalYesterday.tempMax` | str | `22` |
| `weatherLibrary.wuhan.historicalYesterday.tempMin` | str | `8` |
| `weatherLibrary.wuhan.historicalYesterday.iconDay` | str | `502` |
| `weatherLibrary.wuhan.historicalYesterday.textDay` | str | `霾` |
| `weatherLibrary.wuhan.historicalYesterday.iconNight` | str | `501` |
| `weatherLibrary.wuhan.historicalYesterday.textNight` | str | `雾` |
| `weatherLibrary.wuhan.historicalYesterday.wind360Day` | str | `147` |
| `weatherLibrary.wuhan.historicalYesterday.windDirDay` | str | `东南风` |
| `weatherLibrary.wuhan.historicalYesterday.windScaleDay` | str | `2` |
| `weatherLibrary.wuhan.historicalYesterday.windSpeedDay` | str | `11` |
| `weatherLibrary.wuhan.historicalYesterday.wind360Night` | str | `271` |
| `weatherLibrary.wuhan.historicalYesterday.windDirNight` | str | `西风` |
| `weatherLibrary.wuhan.historicalYesterday.windScaleNight` | str | `1` |
| `weatherLibrary.wuhan.historicalYesterday.windSpeedNight` | str | `4` |
| `weatherLibrary.wuhan.historicalYesterday.humidity` | str | `83` |
| `weatherLibrary.wuhan.historicalYesterday.precip` | str | `0.0` |
| `weatherLibrary.wuhan.historicalYesterday.pressure` | str | `1013` |
| `weatherLibrary.wuhan.historicalYesterday.vis` | str |  |
| `weatherLibrary.wuhan.historicalYesterday.cloud` | str |  |
| `weatherLibrary.wuhan.historicalYesterday.uvIndex` | str |  |
| `weatherLibrary.wuhan.airQualityForecast` | array&lt;object&gt; | (3 项) |
| `weatherLibrary.wuhan.airQualityForecast[].forecastStartTime` | str | `2026-05-07T16:00Z` |
| `weatherLibrary.wuhan.airQualityForecast[].forecastEndTime` | str | `2026-05-08T16:00Z` |
| `weatherLibrary.wuhan.airQualityForecast[].aqi` | str | `68` |
| `weatherLibrary.wuhan.airQualityForecast[].level` | str | `2` |
| `weatherLibrary.wuhan.airQualityForecast[].category` | str | `良` |
| `weatherLibrary.wuhan.airQualityForecast[].primaryPollutant` | str | `颗粒物（粒径小于等于2.5µm）` |
| `weatherLibrary.sanya` | object |  |
| `weatherLibrary.sanya.lonLat` | str | `109.4089,18.3091` |
| `weatherLibrary.sanya.locationName` | str | `天涯区 天涯区直辖` |
| `weatherLibrary.sanya.bundle` | object |  |
| `weatherLibrary.sanya.bundle.now` | object |  |
| `weatherLibrary.sanya.bundle.now.obsTime` | str | `2026-05-08T12:42+08:00` |
| `weatherLibrary.sanya.bundle.now.temp` | str | `29` |
| `weatherLibrary.sanya.bundle.now.feelsLike` | str | `29` |
| `weatherLibrary.sanya.bundle.now.icon` | str | `100` |
| `weatherLibrary.sanya.bundle.now.text` | str | `晴` |
| `weatherLibrary.sanya.bundle.now.wind360` | str | `72` |
| `weatherLibrary.sanya.bundle.now.windDir` | str | `东风` |
| `weatherLibrary.sanya.bundle.now.windScale` | str | `2` |
| `weatherLibrary.sanya.bundle.now.windSpeed` | str | `7` |
| `weatherLibrary.sanya.bundle.now.humidity` | str | `68` |
| `weatherLibrary.sanya.bundle.now.precip` | str | `0.0` |
| `weatherLibrary.sanya.bundle.now.pressure` | str | `1012` |
| `weatherLibrary.sanya.bundle.now.vis` | str | `17` |
| `weatherLibrary.sanya.bundle.now.cloud` | str | `10` |
| `weatherLibrary.sanya.bundle.now.dew` | str | `21` |
| `weatherLibrary.sanya.bundle.daily` | array&lt;object&gt; | (15 项) |
| `weatherLibrary.sanya.bundle.daily[].fxDate` | str | `2026-05-08` |
| `weatherLibrary.sanya.bundle.daily[].sunrise` | str | `06:43` |
| `weatherLibrary.sanya.bundle.daily[].sunset` | str | `18:55` |
| `weatherLibrary.sanya.bundle.daily[].moonrise` | str | `12:34` |
| `weatherLibrary.sanya.bundle.daily[].moonset` | str | `01:28` |
| `weatherLibrary.sanya.bundle.daily[].moonPhase` | str | `上弦月` |
| `weatherLibrary.sanya.bundle.daily[].moonPhaseIcon` | str | `802` |
| `weatherLibrary.sanya.bundle.daily[].tempMax` | str | `31` |
| `weatherLibrary.sanya.bundle.daily[].tempMin` | str | `22` |
| `weatherLibrary.sanya.bundle.daily[].iconDay` | str | `101` |
| `weatherLibrary.sanya.bundle.daily[].textDay` | str | `多云` |
| `weatherLibrary.sanya.bundle.daily[].iconNight` | str | `151` |
| `weatherLibrary.sanya.bundle.daily[].textNight` | str | `多云` |
| `weatherLibrary.sanya.bundle.daily[].wind360Day` | str | `0` |
| `weatherLibrary.sanya.bundle.daily[].windDirDay` | str | `北风` |
| `weatherLibrary.sanya.bundle.daily[].windScaleDay` | str | `1` |
| `weatherLibrary.sanya.bundle.daily[].windSpeedDay` | str | `3` |
| `weatherLibrary.sanya.bundle.daily[].wind360Night` | str | `0` |
| `weatherLibrary.sanya.bundle.daily[].windDirNight` | str | `北风` |
| `weatherLibrary.sanya.bundle.daily[].windScaleNight` | str | `1` |
| `weatherLibrary.sanya.bundle.daily[].windSpeedNight` | str | `3` |
| `weatherLibrary.sanya.bundle.daily[].humidity` | str | `89` |
| `weatherLibrary.sanya.bundle.daily[].precip` | str | `0.0` |
| `weatherLibrary.sanya.bundle.daily[].pressure` | str | `996` |
| `weatherLibrary.sanya.bundle.daily[].vis` | str | `24` |
| `weatherLibrary.sanya.bundle.daily[].cloud` | str | `1` |
| `weatherLibrary.sanya.bundle.daily[].uvIndex` | str | `11` |
| `weatherLibrary.sanya.bundle.hourly` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.sanya.bundle.hourly[].fxTime` | str | `2026-05-08T13:00+08:00` |
| `weatherLibrary.sanya.bundle.hourly[].temp` | str | `30` |
| `weatherLibrary.sanya.bundle.hourly[].icon` | str | `100` |
| `weatherLibrary.sanya.bundle.hourly[].text` | str | `晴` |
| `weatherLibrary.sanya.bundle.hourly[].wind360` | str | `162` |
| `weatherLibrary.sanya.bundle.hourly[].windDir` | str | `南风` |
| `weatherLibrary.sanya.bundle.hourly[].windScale` | str | `2` |
| `weatherLibrary.sanya.bundle.hourly[].windSpeed` | str | `7` |
| `weatherLibrary.sanya.bundle.hourly[].humidity` | str | `61` |
| `weatherLibrary.sanya.bundle.hourly[].pop` | str | `0` |
| `weatherLibrary.sanya.bundle.hourly[].precip` | str | `0.0` |
| `weatherLibrary.sanya.bundle.hourly[].pressure` | str | `998` |
| `weatherLibrary.sanya.bundle.hourly[].cloud` | str | `9` |
| `weatherLibrary.sanya.bundle.hourly[].dew` | str | `20` |
| `weatherLibrary.sanya.bundle.indices` | array&lt;object&gt; | (5 项) |
| `weatherLibrary.sanya.bundle.indices[].date` | str | `2026-05-08` |
| `weatherLibrary.sanya.bundle.indices[].type` | str | `1` |
| `weatherLibrary.sanya.bundle.indices[].name` | str | `运动指数` |
| `weatherLibrary.sanya.bundle.indices[].level` | str | `2` |
| `weatherLibrary.sanya.bundle.indices[].category` | str | `较适宜` |
| `weatherLibrary.sanya.bundle.indices[].text` | str | `天气较好，较适宜进行各种运动，但因天气热，请适当减少运动时间，降低运动强度。` |
| `weatherLibrary.sanya.bundle.warnings` | array | (0 项) |
| `weatherLibrary.sanya.bundle.airQuality` | object |  |
| `weatherLibrary.sanya.bundle.airQuality.pubTime` | str | `2026-05-08T04:45:22.746Z` |
| `weatherLibrary.sanya.bundle.airQuality.aqi` | str | `23` |
| `weatherLibrary.sanya.bundle.airQuality.level` | str | `1` |
| `weatherLibrary.sanya.bundle.airQuality.category` | str | `优` |
| `weatherLibrary.sanya.bundle.airQuality.primaryPollutant` | str |  |
| `weatherLibrary.sanya.bundle.airQuality.pm10` | str | `22` |
| `weatherLibrary.sanya.bundle.airQuality.pm2p5` | str | `16` |
| `weatherLibrary.sanya.bundle.airQuality.no2` | str | `5` |
| `weatherLibrary.sanya.bundle.airQuality.so2` | str | `4` |
| `weatherLibrary.sanya.bundle.airQuality.co` | str | `0.5` |
| `weatherLibrary.sanya.bundle.airQuality.o3` | str | `68` |
| `weatherLibrary.sanya.bundle.minutely` | object |  |
| `weatherLibrary.sanya.bundle.minutely.summary` | str | `未来两小时无降水` |
| `weatherLibrary.sanya.bundle.minutely.minutely` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.sanya.historicalYesterday` | object |  |
| `weatherLibrary.sanya.historicalYesterday.fxDate` | str | `2026-05-07` |
| `weatherLibrary.sanya.historicalYesterday.sunrise` | str | `06:43` |
| `weatherLibrary.sanya.historicalYesterday.sunset` | str | `18:55` |
| `weatherLibrary.sanya.historicalYesterday.moonrise` | str | `11:28` |
| `weatherLibrary.sanya.historicalYesterday.moonset` | str | `00:23` |
| `weatherLibrary.sanya.historicalYesterday.moonPhase` | str | `蛾眉月` |
| `weatherLibrary.sanya.historicalYesterday.moonPhaseIcon` | str |  |
| `weatherLibrary.sanya.historicalYesterday.tempMax` | str | `30` |
| `weatherLibrary.sanya.historicalYesterday.tempMin` | str | `22` |
| `weatherLibrary.sanya.historicalYesterday.iconDay` | str | `100` |
| `weatherLibrary.sanya.historicalYesterday.textDay` | str | `晴` |
| `weatherLibrary.sanya.historicalYesterday.iconNight` | str | `150` |
| `weatherLibrary.sanya.historicalYesterday.textNight` | str | `晴` |
| `weatherLibrary.sanya.historicalYesterday.wind360Day` | str | `67` |
| `weatherLibrary.sanya.historicalYesterday.windDirDay` | str | `东北风` |
| `weatherLibrary.sanya.historicalYesterday.windScaleDay` | str | `2` |
| `weatherLibrary.sanya.historicalYesterday.windSpeedDay` | str | `10` |
| `weatherLibrary.sanya.historicalYesterday.wind360Night` | str | `95` |
| `weatherLibrary.sanya.historicalYesterday.windDirNight` | str | `东风` |
| `weatherLibrary.sanya.historicalYesterday.windScaleNight` | str | `2` |
| `weatherLibrary.sanya.historicalYesterday.windSpeedNight` | str | `7` |
| `weatherLibrary.sanya.historicalYesterday.humidity` | str | `81` |
| `weatherLibrary.sanya.historicalYesterday.precip` | str | `0.0` |
| `weatherLibrary.sanya.historicalYesterday.pressure` | str | `1011` |
| `weatherLibrary.sanya.historicalYesterday.vis` | str |  |
| `weatherLibrary.sanya.historicalYesterday.cloud` | str |  |
| `weatherLibrary.sanya.historicalYesterday.uvIndex` | str |  |
| `weatherLibrary.sanya.airQualityForecast` | array&lt;object&gt; | (3 项) |
| `weatherLibrary.sanya.airQualityForecast[].forecastStartTime` | str | `2026-05-07T16:00Z` |
| `weatherLibrary.sanya.airQualityForecast[].forecastEndTime` | str | `2026-05-08T16:00Z` |
| `weatherLibrary.sanya.airQualityForecast[].aqi` | str | `35` |
| `weatherLibrary.sanya.airQualityForecast[].level` | str | `1` |
| `weatherLibrary.sanya.airQualityForecast[].category` | str | `优` |
| `weatherLibrary.sanya.airQualityForecast[].primaryPollutant` | str |  |
| `weatherLibrary.located` | object |  |
| `weatherLibrary.located.lonLat` | str | `116.3323982,39.9794688` |
| `weatherLibrary.located.locationName` | str | `海淀区 中关村街道` |
| `weatherLibrary.located.bundle` | object |  |
| `weatherLibrary.located.bundle.now` | object |  |
| `weatherLibrary.located.bundle.now.obsTime` | str | `2026-05-08T12:41+08:00` |
| `weatherLibrary.located.bundle.now.temp` | str | `21` |
| `weatherLibrary.located.bundle.now.feelsLike` | str | `19` |
| `weatherLibrary.located.bundle.now.icon` | str | `100` |
| `weatherLibrary.located.bundle.now.text` | str | `晴` |
| `weatherLibrary.located.bundle.now.wind360` | str | `51` |
| `weatherLibrary.located.bundle.now.windDir` | str | `东北风` |
| `weatherLibrary.located.bundle.now.windScale` | str | `2` |
| `weatherLibrary.located.bundle.now.windSpeed` | str | `7` |
| `weatherLibrary.located.bundle.now.humidity` | str | `40` |
| `weatherLibrary.located.bundle.now.precip` | str | `0.0` |
| `weatherLibrary.located.bundle.now.pressure` | str | `1008` |
| `weatherLibrary.located.bundle.now.vis` | str | `20` |
| `weatherLibrary.located.bundle.now.cloud` | str | `0` |
| `weatherLibrary.located.bundle.now.dew` | str | `3` |
| `weatherLibrary.located.bundle.daily` | array&lt;object&gt; | (15 项) |
| `weatherLibrary.located.bundle.daily[].fxDate` | str | `2026-05-08` |
| `weatherLibrary.located.bundle.daily[].sunrise` | str | `06:10` |
| `weatherLibrary.located.bundle.daily[].sunset` | str | `18:32` |
| `weatherLibrary.located.bundle.daily[].moonrise` | str | `10:57` |
| `weatherLibrary.located.bundle.daily[].moonset` | str | `02:08` |
| `weatherLibrary.located.bundle.daily[].moonPhase` | str | `上弦月` |
| `weatherLibrary.located.bundle.daily[].moonPhaseIcon` | str | `802` |
| `weatherLibrary.located.bundle.daily[].tempMax` | str | `26` |
| `weatherLibrary.located.bundle.daily[].tempMin` | str | `7` |
| `weatherLibrary.located.bundle.daily[].iconDay` | str | `101` |
| `weatherLibrary.located.bundle.daily[].textDay` | str | `多云` |
| `weatherLibrary.located.bundle.daily[].iconNight` | str | `151` |
| `weatherLibrary.located.bundle.daily[].textNight` | str | `多云` |
| `weatherLibrary.located.bundle.daily[].wind360Day` | str | `0` |
| `weatherLibrary.located.bundle.daily[].windDirDay` | str | `北风` |
| `weatherLibrary.located.bundle.daily[].windScaleDay` | str | `1` |
| `weatherLibrary.located.bundle.daily[].windSpeedDay` | str | `3` |
| `weatherLibrary.located.bundle.daily[].wind360Night` | str | `0` |
| `weatherLibrary.located.bundle.daily[].windDirNight` | str | `北风` |
| `weatherLibrary.located.bundle.daily[].windScaleNight` | str | `1` |
| `weatherLibrary.located.bundle.daily[].windSpeedNight` | str | `3` |
| `weatherLibrary.located.bundle.daily[].humidity` | str | `23` |
| `weatherLibrary.located.bundle.daily[].precip` | str | `0.0` |
| `weatherLibrary.located.bundle.daily[].pressure` | str | `1008` |
| `weatherLibrary.located.bundle.daily[].vis` | str | `25` |
| `weatherLibrary.located.bundle.daily[].cloud` | str | `0` |
| `weatherLibrary.located.bundle.daily[].uvIndex` | str | `5` |
| `weatherLibrary.located.bundle.hourly` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.located.bundle.hourly[].fxTime` | str | `2026-05-08T13:00+08:00` |
| `weatherLibrary.located.bundle.hourly[].temp` | str | `21` |
| `weatherLibrary.located.bundle.hourly[].icon` | str | `100` |
| `weatherLibrary.located.bundle.hourly[].text` | str | `晴` |
| `weatherLibrary.located.bundle.hourly[].wind360` | str | `119` |
| `weatherLibrary.located.bundle.hourly[].windDir` | str | `东南风` |
| `weatherLibrary.located.bundle.hourly[].windScale` | str | `1` |
| `weatherLibrary.located.bundle.hourly[].windSpeed` | str | `3` |
| `weatherLibrary.located.bundle.hourly[].humidity` | str | `25` |
| `weatherLibrary.located.bundle.hourly[].pop` | str | `0` |
| `weatherLibrary.located.bundle.hourly[].precip` | str | `0.0` |
| `weatherLibrary.located.bundle.hourly[].pressure` | str | `1004` |
| `weatherLibrary.located.bundle.hourly[].cloud` | str | `21` |
| `weatherLibrary.located.bundle.hourly[].dew` | str | `1` |
| `weatherLibrary.located.bundle.indices` | array&lt;object&gt; | (5 项) |
| `weatherLibrary.located.bundle.indices[].date` | str | `2026-05-08` |
| `weatherLibrary.located.bundle.indices[].type` | str | `1` |
| `weatherLibrary.located.bundle.indices[].name` | str | `运动指数` |
| `weatherLibrary.located.bundle.indices[].level` | str | `3` |
| `weatherLibrary.located.bundle.indices[].category` | str | `较不宜` |
| `weatherLibrary.located.bundle.indices[].text` | str | `有扬沙或浮尘，建议适当停止户外运动，选择在室内进行运动，以避免吸入更多沙尘，有损健康。` |
| `weatherLibrary.located.bundle.warnings` | array | (0 项) |
| `weatherLibrary.located.bundle.airQuality` | object |  |
| `weatherLibrary.located.bundle.airQuality.pubTime` | str | `2026-05-08T04:45:23.433Z` |
| `weatherLibrary.located.bundle.airQuality.aqi` | str | `35` |
| `weatherLibrary.located.bundle.airQuality.level` | str | `1` |
| `weatherLibrary.located.bundle.airQuality.category` | str | `优` |
| `weatherLibrary.located.bundle.airQuality.primaryPollutant` | str |  |
| `weatherLibrary.located.bundle.airQuality.pm10` | str | `34` |
| `weatherLibrary.located.bundle.airQuality.pm2p5` | str | `18` |
| `weatherLibrary.located.bundle.airQuality.no2` | str | `19` |
| `weatherLibrary.located.bundle.airQuality.so2` | str | `6` |
| `weatherLibrary.located.bundle.airQuality.co` | str | `0.6` |
| `weatherLibrary.located.bundle.airQuality.o3` | str | `28` |
| `weatherLibrary.located.bundle.minutely` | object |  |
| `weatherLibrary.located.bundle.minutely.summary` | str | `未来两小时无降水` |
| `weatherLibrary.located.bundle.minutely.minutely` | array&lt;object&gt; | (24 项) |
| `weatherLibrary.located.historicalYesterday` | object |  |
| `weatherLibrary.located.historicalYesterday.fxDate` | str | `2026-05-07` |
| `weatherLibrary.located.historicalYesterday.sunrise` | str | `06:11` |
| `weatherLibrary.located.historicalYesterday.sunset` | str | `18:32` |
| `weatherLibrary.located.historicalYesterday.moonrise` | str | `09:50` |
| `weatherLibrary.located.historicalYesterday.moonset` | str | `01:04` |
| `weatherLibrary.located.historicalYesterday.moonPhase` | str | `蛾眉月` |
| `weatherLibrary.located.historicalYesterday.moonPhaseIcon` | str |  |
| `weatherLibrary.located.historicalYesterday.tempMax` | str | `24` |
| `weatherLibrary.located.historicalYesterday.tempMin` | str | `7` |
| `weatherLibrary.located.historicalYesterday.iconDay` | str | `502` |
| `weatherLibrary.located.historicalYesterday.textDay` | str | `霾` |
| `weatherLibrary.located.historicalYesterday.iconNight` | str | `502` |
| `weatherLibrary.located.historicalYesterday.textNight` | str | `霾` |
| `weatherLibrary.located.historicalYesterday.wind360Day` | str | `192` |
| `weatherLibrary.located.historicalYesterday.windDirDay` | str | `南风` |
| `weatherLibrary.located.historicalYesterday.windScaleDay` | str | `2` |
| `weatherLibrary.located.historicalYesterday.windSpeedDay` | str | `11` |
| `weatherLibrary.located.historicalYesterday.wind360Night` | str | `18` |
| `weatherLibrary.located.historicalYesterday.windDirNight` | str | `北风` |
| `weatherLibrary.located.historicalYesterday.windScaleNight` | str | `1` |
| `weatherLibrary.located.historicalYesterday.windSpeedNight` | str | `1` |
| `weatherLibrary.located.historicalYesterday.humidity` | str | `54` |
| `weatherLibrary.located.historicalYesterday.precip` | str | `0.0` |
| `weatherLibrary.located.historicalYesterday.pressure` | str | `1005` |
| `weatherLibrary.located.historicalYesterday.vis` | str |  |
| `weatherLibrary.located.historicalYesterday.cloud` | str |  |
| `weatherLibrary.located.historicalYesterday.uvIndex` | str |  |
| `weatherLibrary.located.airQualityForecast` | array&lt;object&gt; | (3 项) |
| `weatherLibrary.located.airQualityForecast[].forecastStartTime` | str | `2026-05-07T16:00Z` |
| `weatherLibrary.located.airQualityForecast[].forecastEndTime` | str | `2026-05-08T16:00Z` |
| `weatherLibrary.located.airQualityForecast[].aqi` | str | `35` |
| `weatherLibrary.located.airQualityForecast[].level` | str | `1` |
| `weatherLibrary.located.airQualityForecast[].category` | str | `优` |
| `weatherLibrary.located.airQualityForecast[].primaryPollutant` | str |  |

### clock (`clock`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.clock;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `alarms` | array&lt;object&gt; | (7 项) |
| `alarms[].id` | str | `a1` |
| `alarms[].hour` | int | `4` |
| `alarms[].minute` | int | `30` |
| `alarms[].enabled` | bool | `True` |
| `alarms[].repeat` | str | `daily` |
| `alarms[].note` | str | `拿东西` |
| `alarms[].vibrate` | bool | `True` |
| `alarms[].autoDelete` | bool | `False` |
| `selectedCityIds` | array&lt;str&gt; | (4 项) |
| `cities` | array&lt;object&gt; | (15 项) |
| `cities[].id` | str | `abidjan` |
| `cities[].name` | str | `阿比让` |
| `cities[].country` | str | `科特迪瓦` |
| `cities[].gmtOffsetMinutes` | int | `0` |
| `selectedCities` | array&lt;object&gt; | (4 项) |
| `selectedCities[].id` | str | `accra` |
| `selectedCities[].name` | str | `阿克拉` |
| `selectedCities[].country` | str | `加纳` |
| `selectedCities[].gmtOffsetMinutes` | int | `0` |

### spotify (`spotify`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.spotify;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `currentUser` | object |  |
| `currentUser.id` | str | `u1` |
| `currentUser.name` | str | `Ju Zheng` |
| `currentUser.initial` | str | `J` |
| `currentUser.color` | str | `bg-amber-700` |
| `accounts` | array&lt;object&gt; | (1 项) |
| `accounts[].id` | str | `u1` |
| `accounts[].name` | str | `Ju Zheng` |
| `accounts[].initial` | str | `J` |
| `accounts[].color` | str | `bg-amber-700` |
| `currentTrack` | object |  |
| `currentTrack.id` | str | `t1` |
| `currentTrack.title` | str | `搁浅` |
| `currentTrack.artist` | str | `周杰伦` |
| `currentTrack.cover` | str | `https://is1-ssl.mzstatic.com/image/thumb/Music1...` |
| `currentTrack.duration` | str | `3:58` |
| `isPlaying` | bool | `False` |
| `shuffle` | bool | `False` |
| `repeat` | str | `off` |
| `queue` | array&lt;object&gt; | (3 项) |
| `queue[].id` | str | `t1` |
| `queue[].title` | str | `搁浅` |
| `queue[].artist` | str | `周杰伦` |
| `queue[].cover` | str | `https://is1-ssl.mzstatic.com/image/thumb/Music1...` |
| `queue[].duration` | str | `3:58` |
| `recentPlays` | array&lt;object&gt; | (6 项) |
| `recentPlays[].id` | str | `t1` |
| `recentPlays[].title` | str | `搁浅` |
| `recentPlays[].artist` | str | `周杰伦` |
| `recentPlays[].cover` | str | `https://is1-ssl.mzstatic.com/image/thumb/Music1...` |
| `recentPlays[].duration` | str | `3:58` |
| `likedSongs` | array&lt;object&gt; | (10 项) |
| `likedSongs[].id` | str | `ls_1` |
| `likedSongs[].title` | str | `Love Story` |
| `likedSongs[].artist` | str | `Taylor Swift` |
| `likedSongs[].cover` | str | `https://is1-ssl.mzstatic.com/image/thumb/Music1...` |
| `likedSongs[].duration` | str | `3:55` |
| `followedArtists` | array&lt;str&gt; | (3 项) |
| `customPlaylists` | array | (0 项) |
| `playHistory` | array | (0 项) |
| `settings` | object |  |
| `settings.dataSaver` | object |  |
| `settings.dataSaver.saverMode` | int | `1` |
| `settings.dataSaver.downloadCellular` | bool | `False` |
| `settings.dataSaver.downloadAudioOnly` | bool | `False` |
| `settings.dataSaver.streamAudioOnly` | bool | `False` |
| `settings.mediaQuality` | object |  |
| `settings.mediaQuality.wifiQuality` | str | `Automatic` |
| `settings.mediaQuality.cellQuality` | str | `Automatic` |
| `settings.mediaQuality.downloadQuality` | str | `Normal` |
| `settings.playback` | object |  |
| `settings.playback.gapless` | bool | `False` |
| `settings.playback.automix` | bool | `True` |
| `settings.playback.crossfade` | int | `0` |
| `settings.playback.autoplay` | bool | `True` |
| `settings.playback.monoAudio` | bool | `False` |
| `settings.playback.broadcast` | bool | `False` |
| `settings.playback.sleepTimer` | int | `0` |
| `settings.playback.sleepFade` | bool | `False` |
| `settings.playback.lyricsEnabled` | bool | `True` |
| `settings.privacy` | object |  |
| `settings.privacy.shareActivity` | bool | `True` |
| `settings.privacy.privateSession` | bool | `False` |
| `settings.privacy.recentArtists` | bool | `False` |
| `settings.privacy.publicPlaylists` | bool | `True` |
| `settings.privacy.profilePlaylists` | bool | `True` |
| `settings.contentDisplay` | object |  |
| `settings.contentDisplay.reduceMotion` | bool | `False` |
| `settings.contentDisplay.canvas` | bool | `True` |
| `settings.contentDisplay.explicit` | bool | `True` |
| `settings.contentDisplay.unavailable` | bool | `False` |
| `settings.contentDisplay.createBtn` | bool | `True` |
| `settings.appsDevices` | object |  |
| `settings.appsDevices.voiceAssistant` | bool | `True` |
| `settings.appsDevices.connectControl` | bool | `True` |
| `settings.appsDevices.localVisibility` | bool | `False` |
| `settings.appsDevices.localFiles` | bool | `False` |
| `pendingPlaylistTrack` | NoneType |  |
| `searchHistory` | array | (0 项) |
| `_temp` | object |  |
| `_temp.queueToast` | NoneType |  |
| `_temp.likedToast` | NoneType |  |

### alipay (`alipay`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.alipay;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `userInfo` | object |  |
| `userInfo.name` | str | `张三` |
| `userInfo.phone` | str | `13812348888` |
| `userInfo.avatar` | str |  |
| `userInfo.paymentPassword` | str | `123456` |
| `language` | str | `zh-CN` |
| `balance` | object |  |
| `balance.total` | float | `100023.46` |
| `balance.dailyIncome` | float | `9.99` |
| `transferRecords` | array&lt;object&gt; | (62 项) |
| `transferRecords[].id` | str | `tr_today_1` |
| `transferRecords[].counterpartyName` | str | `美团外卖-沙县小吃` |
| `transferRecords[].counterpartyAvatar` | str |  |
| `transferRecords[].delta` | float | `-18.5` |
| `transferRecords[].timestamp` | int | `1778240797184` |
| `transferRecords[].displayTitle` | str | `美团` |
| `transferRecords[].detailTimeLabel` | str | `支付时间` |
| `transferRecords[].paymentMethod` | str | `花呗` |
| `transferRecords[].productDescription` | str | `美团外卖订单-沙县小吃` |
| `transferRecords[].rewardPoints` | int | `100` |
| `transferRecords[].payeeFullName` | str | `北京三快在线科技有限公司` |
| `transferRecords[].serviceDetail` | str | `美团外卖订单` |
| `transferRecords[].orderId` | str | `2026030922001499621415864600` |
| `transferRecords[].merchantOrderId` | str | `20260309215758U65754474825383198` |
| `transferRecords[].kind` | str | `payment` |
| `transferRecords[].category` | str | `dining` |
| `transferRecords[].description` | str | `餐饮美食` |
| `transferRecords[].includeInBudget` | bool | `True` |
| `notifications` | array&lt;object&gt; | (6 项) |
| `notifications[].id` | str | `notif_1` |
| `notifications[].title` | str | `余额宝` |
| `notifications[].content` | str | `余额宝收益到账啦` |
| `notifications[].icon` | str | `IcPiggyBank` |
| `notifications[].timestamp` | int | `1778168797184` |
| `notifications[].read` | bool | `False` |
| `quickActions` | array&lt;object&gt; | (4 项) |
| `quickActions[].id` | str | `scan` |
| `quickActions[].name` | str | `扫一扫` |
| `quickActions[].icon` | str | `IcScan` |
| `quickActions[].color` | str | `#ffffff` |
| `mainServices` | array&lt;object&gt; | (10 项) |
| `mainServices[].id` | str | `antInsure` |
| `mainServices[].name` | str | `蚂蚁保` |
| `mainServices[].icon` | str | `IcSecureCheck` |
| `mainServices[].color` | str | `#1677FF` |
| `commonServices` | array&lt;object&gt; | (5 项) |
| `commonServices[].id` | str | `jinling` |
| `commonServices[].name` | str | `金陵网证` |
| `commonServices[].icon` | str | `IcIdCard` |
| `commonServices[].color` | str | `#1677FF` |
| `flashSale` | array&lt;object&gt; | (4 项) |
| `flashSale[].id` | str | `1` |
| `flashSale[].name` | str | `西瓜` |
| `flashSale[].image` | str | `🍉` |
| `flashSale[].price` | str | `￥20` |
| `flashSale[].label` | str | `哇` |
| `financeServices` | array&lt;object&gt; | (10 项) |
| `financeServices[].id` | str | `余额宝` |
| `financeServices[].name` | str | `余额宝` |
| `financeServices[].icon` | str | `IcPiggyBank` |
| `financeServices[].color` | str | `#1677FF` |
| `myServicesList` | array&lt;object&gt; | (5 项) |
| `myServicesList[].id` | str | `bill` |
| `myServicesList[].name` | str | `账单` |
| `myServicesList[].icon` | str | `IcFile` |
| `myServicesList[].color` | str | `#FF7D00` |
| `myServicesList[].extra` | str |  |
| `myServicesGrid` | array&lt;object&gt; | (6 项) |
| `myServicesGrid[].id` | str | `antInsure` |
| `myServicesGrid[].name` | str | `蚂蚁保` |
| `myServicesGrid[].icon` | str | `IcSecureCheck` |
| `myServicesGrid[].color` | str | `#1677FF` |
| `myCivicServices` | array&lt;object&gt; | (4 项) |
| `myCivicServices[].id` | str | `medical` |
| `myCivicServices[].name` | str | `医保` |
| `myCivicServices[].icon` | str | `IcMedical` |
| `myCivicServices[].color` | str | `#1677FF` |
| `conversations` | array&lt;object&gt; | (18 项) |
| `conversations[].id` | str | `conv_box` |
| `conversations[].kind` | str | `box` |
| `conversations[].name` | str | `消息盒子` |
| `conversations[].lastContent` | str | `活动通知 \| 余额宝帮你赚了多少钱` |
| `conversations[].lastTimestamp` | int | `1778165197184` |
| `conversations[].lastReadAt` | int | `1778078797184` |
| `conversations[].isSticky` | bool | `True` |
| `chatHistory` | object |  |
| `chatHistory.conv_box` | array&lt;object&gt; | (9 项) |
| `chatHistory.conv_box[].id` | str | `chbox_1` |
| `chatHistory.conv_box[].senderId` | str | `system` |
| `chatHistory.conv_box[].type` | str | `system` |
| `chatHistory.conv_box[].content` | str | `余额宝收益播报：昨日收益已到账` |
| `chatHistory.conv_box[].timestamp` | int | `1778132797184` |
| `chatHistory.conv_p_6` | array&lt;object&gt; | (5 项) |
| `chatHistory.conv_p_6[].id` | str | `ch6_1` |
| `chatHistory.conv_p_6[].senderId` | str | `6` |
| `chatHistory.conv_p_6[].type` | str | `text` |
| `chatHistory.conv_p_6[].content` | str | `明天有空吗` |
| `chatHistory.conv_p_6[].timestamp` | int | `1778154397184` |
| `chatHistory.conv_p_7` | array&lt;object&gt; | (2 项) |
| `chatHistory.conv_p_7[].id` | str | `ch7_1` |
| `chatHistory.conv_p_7[].senderId` | str | `self` |
| `chatHistory.conv_p_7[].type` | str | `transfer` |
| `chatHistory.conv_p_7[].content` | str | `[转账] 0.01 元` |
| `chatHistory.conv_p_7[].timestamp` | int | `1778057197184` |
| `chatHistory.conv_svc_sys` | array&lt;object&gt; | (1 项) |
| `chatHistory.conv_svc_sys[].id` | str | `chsys_1` |
| `chatHistory.conv_svc_sys[].senderId` | str | `system` |
| `chatHistory.conv_svc_sys[].type` | str | `system` |
| `chatHistory.conv_svc_sys[].content` | str | `你有新的账单提醒` |
| `chatHistory.conv_svc_sys[].timestamp` | int | `1778161597184` |
| `chatHistory.conv_p_1` | array&lt;object&gt; | (3 项) |
| `chatHistory.conv_p_1[].id` | str | `ch1_1` |
| `chatHistory.conv_p_1[].senderId` | str | `1` |
| `chatHistory.conv_p_1[].type` | str | `text` |
| `chatHistory.conv_p_1[].content` | str | `下午的会议改到3点了` |
| `chatHistory.conv_p_1[].timestamp` | int | `1778242597184` |
| `chatHistory.conv_svc_wealth` | array&lt;object&gt; | (2 项) |
| `chatHistory.conv_svc_wealth[].id` | str | `chwealth_1` |
| `chatHistory.conv_svc_wealth[].senderId` | str | `system` |
| `chatHistory.conv_svc_wealth[].type` | str | `system` |
| `chatHistory.conv_svc_wealth[].content` | str | `余额宝昨日收益已到账` |
| `chatHistory.conv_svc_wealth[].timestamp` | int | `1778154397184` |
| `chatHistory.conv_p_3` | array&lt;object&gt; | (5 项) |
| `chatHistory.conv_p_3[].id` | str | `ch3_1` |
| `chatHistory.conv_p_3[].senderId` | str | `3` |
| `chatHistory.conv_p_3[].type` | str | `text` |
| `chatHistory.conv_p_3[].content` | str | `最近忙什么呢` |
| `chatHistory.conv_p_3[].timestamp` | int | `1778064397184` |
| `chatHistory.conv_p_17` | array&lt;object&gt; | (2 项) |
| `chatHistory.conv_p_17[].id` | str | `ch17_1` |
| `chatHistory.conv_p_17[].senderId` | str | `self` |
| `chatHistory.conv_p_17[].type` | str | `text` |
| `chatHistory.conv_p_17[].content` | str | `文件发一下` |
| `chatHistory.conv_p_17[].timestamp` | int | `1778042797184` |
| `chatHistory.conv_p_10` | array&lt;object&gt; | (4 项) |
| `chatHistory.conv_p_10[].id` | str | `ch10_1` |
| `chatHistory.conv_p_10[].senderId` | str | `10` |
| `chatHistory.conv_p_10[].type` | str | `text` |
| `chatHistory.conv_p_10[].content` | str | `今天下班早吗` |
| `chatHistory.conv_p_10[].timestamp` | int | `1777718797184` |
| `chatHistory.conv_p_4` | array&lt;object&gt; | (1 项) |
| `chatHistory.conv_p_4[].id` | str | `ch4_1` |
| `chatHistory.conv_p_4[].senderId` | str | `4` |
| `chatHistory.conv_p_4[].type` | str | `text` |
| `chatHistory.conv_p_4[].content` | str | `周末一起吃饭吗？` |
| `chatHistory.conv_p_4[].timestamp` | int | `1777646797184` |
| `chatHistory.conv_p_5` | array&lt;object&gt; | (2 项) |
| `chatHistory.conv_p_5[].id` | str | `ch5_1` |
| `chatHistory.conv_p_5[].senderId` | str | `self` |
| `chatHistory.conv_p_5[].type` | str | `text` |
| `chatHistory.conv_p_5[].content` | str | `好的我记一下` |
| `chatHistory.conv_p_5[].timestamp` | int | `1777549597184` |
| `chatHistory.conv_p_12` | array&lt;object&gt; | (4 项) |
| `chatHistory.conv_p_12[].id` | str | `ch12_1` |
| `chatHistory.conv_p_12[].senderId` | str | `self` |
| `chatHistory.conv_p_12[].type` | str | `text` |
| `chatHistory.conv_p_12[].content` | str | `好久没踢了` |
| `chatHistory.conv_p_12[].timestamp` | int | `1777819597184` |
| `chatHistory.conv_svc_life` | array&lt;object&gt; | (5 项) |
| `chatHistory.conv_svc_life[].id` | str | `chlife_1` |
| `chatHistory.conv_svc_life[].senderId` | str | `system` |
| `chatHistory.conv_svc_life[].type` | str | `system` |
| `chatHistory.conv_svc_life[].content` | str | `燃气服务：本月用气账单已生成` |
| `chatHistory.conv_svc_life[].timestamp` | int | `1777358797184` |
| `chatHistory.conv_p_2` | array&lt;object&gt; | (5 项) |
| `chatHistory.conv_p_2[].id` | str | `ch2_1` |
| `chatHistory.conv_p_2[].senderId` | str | `self` |
| `chatHistory.conv_p_2[].type` | str | `text` |
| `chatHistory.conv_p_2[].content` | str | `再说吧` |
| `chatHistory.conv_p_2[].timestamp` | int | `1777286797184` |
| `chatHistory.conv_svc_insure` | array&lt;object&gt; | (3 项) |
| `chatHistory.conv_svc_insure[].id` | str | `chinsure_1` |
| `chatHistory.conv_svc_insure[].senderId` | str | `system` |
| `chatHistory.conv_svc_insure[].type` | str | `system` |
| `chatHistory.conv_svc_insure[].content` | str | `理赔材料已收到，正在审核` |
| `chatHistory.conv_svc_insure[].timestamp` | int | `1775630797184` |
| `chatHistory.conv_p_8` | array&lt;object&gt; | (4 项) |
| `chatHistory.conv_p_8[].id` | str | `ch8_1` |
| `chatHistory.conv_p_8[].senderId` | str | `self` |
| `chatHistory.conv_p_8[].type` | str | `text` |
| `chatHistory.conv_p_8[].content` | str | `奶奶好` |
| `chatHistory.conv_p_8[].timestamp` | int | `1754020800000` |
| `chatHistory.conv_birthday` | array&lt;object&gt; | (1 项) |
| `chatHistory.conv_birthday[].id` | str | `chbirthday_1` |
| `chatHistory.conv_birthday[].senderId` | str | `system` |
| `chatHistory.conv_birthday[].type` | str | `system` |
| `chatHistory.conv_birthday[].content` | str | `本周有1个好友过生日，送上祝福吧` |
| `chatHistory.conv_birthday[].timestamp` | int | `1751212800000` |
| `chatHistory.conv_svc_kefu` | array&lt;object&gt; | (1 项) |
| `chatHistory.conv_svc_kefu[].id` | str | `chkefu_1` |
| `chatHistory.conv_svc_kefu[].senderId` | str | `system` |
| `chatHistory.conv_svc_kefu[].type` | str | `system` |
| `chatHistory.conv_svc_kefu[].content` | str | `您有积分将在6月过期，客服为您解读积分热` |
| `chatHistory.conv_svc_kefu[].timestamp` | int | `1655740800000` |
| `contacts` | array&lt;object&gt; | (30 项) |
| `contacts[].id` | str | `1` |
| `contacts[].name` | str | `浩杰(李浩杰)` |
| `contacts[].phone` | str | `13256784311` |
| `contacts[].account` | str | `13256784311` |
| `contacts[].info` | str | `李浩杰` |
| `contacts[].avatar` | str | `https://images.unsplash.com/photo-1599566150163...` |
| `contacts[].verified` | bool | `True` |
| `contacts[].gender` | str | `male` |
| `settings` | object |  |
| `settings.visualRefreshEnabled` | bool | `True` |
| `settings.payment` | object |  |
| `settings.payment.payOrder` | object |  |
| `settings.payment.payOrder.mode` | str | `system` |
| `settings.payment.payOrder.customOrderIds` | array&lt;str&gt; | (3 项) |
| `settings.payment.fastPay` | object |  |
| `settings.payment.fastPay.enabled` | bool | `False` |
| `settings.payment.fastPay.noPwdEnabled` | bool | `False` |
| `settings.payment.fastPay.easterEggEnabled` | bool | `True` |
| `settings.notifications` | object |  |
| `settings.notifications.tradeSecurity` | bool | `True` |
| `settings.notifications.service` | bool | `True` |
| `settings.notifications.activity` | bool | `True` |
| `settings.notifications.avCall` | bool | `False` |
| `settings.notifications.avCallPopup` | bool | `False` |
| `settings.notifications.friendReminder` | bool | `True` |
| `settings.notifications.friendDetail` | bool | `True` |
| `settings.notifications.sound` | bool | `True` |
| `settings.notifications.vibration` | bool | `True` |
| `settings.notifications.avCallRing` | bool | `False` |
| `settings.general` | object |  |
| `settings.general.refreshSoundEnabled` | bool | `False` |
| `settings.general.fontSizeLevel` | int | `2` |
| `settings.general.darkMode` | object |  |
| `settings.general.darkMode.followSystem` | bool | `False` |
| `settings.general.darkMode.mode` | str | `light` |
| `settings.general.speedModeEnabled` | bool | `False` |
| `settings.general.clipboardAllowRead` | bool | `True` |
| `settings.general.homeManage` | object |  |
| `settings.general.homeManage.searchBoxRecommendEnabled` | bool | `True` |
| `settings.general.homeManage.searchBoxAmbienceEnabled` | bool | `True` |
| `settings.general.homeManage.searchPreEnabled` | bool | `True` |
| `settings.general.homeManage.voiceFloatEnabled` | bool | `False` |
| `settings.general.homeManage.activityAmbienceEnabled` | bool | `True` |
| `settings.general.homeManage.appDynamicEnabled` | bool | `True` |
| `settings.general.homeManage.featureColumnEnabled` | bool | `True` |
| `settings.general.homeManage.smartSceneEnabled` | bool | `True` |
| `settings.general.myManage` | object |  |
| `settings.general.myManage.documents` | bool | `True` |
| `settings.general.myManage.yuebao` | bool | `True` |
| `settings.general.myManage.huabei` | bool | `True` |
| `settings.general.myManage.antInsure` | bool | `True` |
| `settings.general.myManage.sesame` | bool | `True` |
| `settings.general.myManage.yulibao` | bool | `True` |
| `settings.general.myManage.mybankLoan` | bool | `True` |
| `settings.general.myManage.mybank` | bool | `True` |
| `settings.general.myManage.civic` | bool | `True` |
| `settings.general.myManage.orders` | bool | `True` |
| `settings.general.myManage.moreServices` | bool | `True` |
| `bankCards` | array&lt;object&gt; | (8 项) |
| `bankCards[].id` | str | `ccb_5495` |
| `bankCards[].bankCode` | str | `ccb` |
| `bankCards[].bankName` | str | `建设银行储蓄卡` |
| `bankCards[].last4` | str | `5445` |
| `bankCards[].bound` | bool | `True` |
| `bankCards[].available` | int | `5000` |
| `subscriptions` | array | (0 项) |
| `lastPaymentHint` | NoneType |  |
| `rechargeCards` | array&lt;object&gt; | (2 项) |
| `rechargeCards[].id` | str | `rc-1` |
| `rechargeCards[].code` | str | `ALIPAY100` |
| `rechargeCards[].value` | int | `100` |
| `rechargeCards[].redeemed` | bool | `False` |
| `billSearchHistory` | array | (0 项) |
| `transferDraft` | NoneType |  |
| `transferReceipt` | NoneType |  |

### 哔哩哔哩 (`bilibili`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.bilibili;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `homeTabs` | array&lt;str&gt; | (6 项) |
| `recommendedUp` | array&lt;object&gt; | (2 项) |
| `recommendedUp[].id` | str | `800000064982` |
| `recommendedUp[].name` | str | `_拾光记录者_` |
| `shopItems` | array&lt;object&gt; | (4 项) |
| `shopItems[].title` | str | `手办雕像` |
| `shopItems[].icon` | str | `🎨` |
| `settings` | object |  |
| `settings.language` | str | `zh` |
| `settings.timer` | str | `off` |
| `settings.sleepReminder` | bool | `False` |
| `settings.recommend` | object |  |
| `settings.recommend.playMode` | str | `auto` |
| `settings.recommend.autoPlay` | str | `wifi` |
| `settings.recommend.bigCardSound` | str | `off` |
| `settings.recommend.refresh` | str | `on` |
| `settings.avatarEntry` | object |  |
| `settings.avatarEntry.watchVideo` | bool | `True` |
| `settings.avatarEntry.listenVideo` | bool | `True` |
| `settings.offline` | object |  |
| `settings.offline.autoDownload` | bool | `True` |
| `settings.chase` | object |  |
| `settings.chase.xianXiuMode` | bool | `False` |
| `settings.push` | object |  |
| `settings.push.like` | bool | `True` |
| `settings.push.comment` | bool | `True` |
| `settings.push.at` | bool | `True` |
| `settings.push.chat` | bool | `True` |
| `settings.push.followUp` | bool | `True` |
| `settings.push.recommend` | bool | `True` |
| `settings.push.hot` | bool | `True` |
| `settings.push.activity` | bool | `True` |
| `settings.push.chase` | bool | `True` |
| `settings.push.live` | bool | `True` |
| `settings.push.collection` | bool | `True` |
| `settings.push.search` | bool | `True` |
| `settings.push.otherSub` | bool | `True` |
| `settings.push.upload` | bool | `True` |
| `settings.push.logistics` | bool | `True` |
| `settings.push.value` | bool | `True` |
| `settings.push.security` | bool | `True` |
| `settings.push.other` | bool | `True` |
| `settings.push.banner` | bool | `True` |
| `settings.message` | object |  |
| `settings.message.notify` | bool | `True` |
| `settings.message.smartBlock` | bool | `True` |
| `settings.message.replyAt` | str | `all` |
| `settings.message.like` | str | `all` |
| `settings.message.fan` | str | `on` |
| `settings.message.support` | str | `on` |
| `settings.message.supportCollapse` | bool | `True` |
| `settings.message.unfollowCollapse` | bool | `False` |
| `settings.harass` | object |  |
| `settings.harass.oneKey` | bool | `False` |
| `settings.harass.comment` | str | `all` |
| `settings.harass.danmaku` | str | `all` |
| `settings.harass.pm` | str | `all` |
| `settings.other` | object |  |
| `settings.other.wifiPkg` | bool | `True` |
| `settings.other.clipboard` | bool | `True` |
| `settings.other.screenshotShare` | bool | `True` |
| `settings.other.watermark` | str | `off` |
| `settings.other.imageQuality` | str | `clear` |
| `settings.playback` | object |  |
| `settings.playback.dataAuto` | bool | `True` |
| `settings.playback.detailAuto` | bool | `True` |
| `settings.playback.detailFullscreen` | bool | `False` |
| `settings.playback.feedAuto` | str | `on` |
| `settings.playback.homeAuto` | str | `all` |
| `settings.playback.portraitFullscreen` | bool | `True` |
| `settings.playback.pipOut` | bool | `False` |
| `settings.playback.pipIn` | bool | `False` |
| `settings.playback.backgroundListen` | bool | `True` |
| `settings.playback.backgroundSeries` | bool | `True` |
| `settings.playback.danmakuMemory` | bool | `False` |
| `settings.playback.danmakuQuick` | bool | `True` |
| `settings.playback.subtitleFeedback` | bool | `False` |
| `settings.playback.subtitleDrag` | bool | `False` |
| `settings.playback.hdr` | bool | `False` |
| `settings.playback.fullscreenCount` | bool | `True` |
| `settings.playback.gravity` | bool | `True` |
| `settings.playback.volumeBalance` | str | `standard` |
| `settings.playback.eyeCare` | bool | `False` |
| `settings.playback.colorAid` | bool | `False` |
| `settings.playback.https` | bool | `False` |
| `user` | object |  |
| `user.name` | str | `xiaoming-ai` |
| `user.level` | int | `0` |
| `user.avatar` | str | `/cdn/bilibili/images/avatars/self.jpg` |
| `user.bCoins` | int | `0` |
| `user.coins` | int | `1240` |
| `user.following` | int | `2` |
| `user.followers` | int | `1` |
| `user.dynamic` | int | `0` |
| `user.isVip` | bool | `False` |
| `user.sex` | str | `保密` |
| `user.birthday` | str |  |
| `user.sign` | str | `这是我的签名` |
| `user.school` | str | `中国科学院大学` |
| `user.ipLocation` | str | `北京` |
| `user.uid` | str | `800000000000` |
| `user.followingList` | array&lt;object&gt; | (2 项) |
| `user.followingList[].mid` | str | `800000025938` |
| `user.followingList[].name` | str | `铁壁观察` |
| `user.followingList[].face` | str | `/cdn/bilibili/images/avatars/mid_800000025938.jpg` |
| `user.followingList[].sign` | str | `关注社会动态与历史人文，偶尔分享生活随想。` |
| `user.followersList` | array&lt;object&gt; | (1 项) |
| `user.followersList[].mid` | str | `800000000001` |
| `user.followersList[].name` | str | `星流笔记` |
| `user.followersList[].face` | str | `/cdn/bilibili/images/avatars/mid_800000000001.jpg` |
| `user.followersList[].sign` | str | `专注探索宇宙深处的未解之谜，分享硬核天文知识与浪漫星空摄影` |
| `user.followersList[].isVip` | bool | `False` |
| `user.likedVideoIds` | array&lt;str&gt; | (1 项) |
| `user.dislikedVideoIds` | array | (0 项) |
| `user.coinedVideoCoins` | object |  |
| `user.favoritesFolders` | array&lt;object&gt; | (4 项) |
| `user.favoritesFolders[].id` | str | `fav_default` |
| `user.favoritesFolders[].title` | str | `默认收藏夹` |
| `user.favoritesFolders[].isPublic` | bool | `False` |
| `user.favoritesFolders[].videoIds` | array&lt;str&gt; | (6 项) |
| `user.subscribedAnime` | array&lt;object&gt; | (2 项) |
| `user.subscribedAnime[].id` | str | `BVmg00000086` |
| `user.subscribedAnime[].title` | str | `凡人修仙传` |
| `user.subscribedDramas` | array | (0 项) |
| `user.searchHistory` | array&lt;str&gt; | (2 项) |
| `activeVideoId` | NoneType |  |

### ebay (`ebay`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.ebay;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `user` | object |  |
| `user.name` | str | `User` |
| `user.isLoggedIn` | bool | `False` |
| `recentSearches` | array&lt;object&gt; | (1 项) |
| `recentSearches[].id` | str | `1` |
| `recentSearches[].query` | str | `电风扇` |
| `savedItems` | array | (0 项) |
| `cartItems` | array | (0 项) |
| `homeProducts` | array&lt;object&gt; | (3 项) |
| `homeProducts[].id` | str | `1` |
| `homeProducts[].image` | str | `/cdn/ebay/images/unsplash/photo-1511707171634-5...` |
| `homeProducts[].title` | str | `Smartphone` |
| `messages` | array | (0 项) |
| `settings` | object |  |
| `settings.themeId` | str | `system` |
| `search` | object |  |
| `search.current` | object |  |
| `search.current.query` | str |  |
| `search.current.sortOption` | str | `bestMatch` |
| `search.current.buyingFormat` | str | `all` |
| `search.current.categoryId` | NoneType |  |
| `search.current.brand` | NoneType |  |
| `search.current.location` | NoneType |  |
| `search.current.freeShippingOnly` | bool | `False` |
| `search.current.conditions` | array | (0 项) |
| `search.current.priceMin` | str |  |
| `search.current.priceMax` | str |  |
| `search.current.resultsCount` | int | `0` |
| `search.current.firstTitle` | NoneType |  |
| `search.current.firstTotalCents` | NoneType |  |
| `search.history` | array | (0 项) |
| `search.lastCompare` | NoneType |  |

### 地图 (`map`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.map;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `user` | object |  |
| `user.id` | str | `u1` |
| `user.name` | str | `pure` |
| `user.level` | int | `1` |
| `user.levelTitle` | str | `本地向导` |
| `user.contributions` | object |  |
| `user.contributions.photos` | int | `0` |
| `user.contributions.reviews` | int | `0` |
| `user.contributions.questions` | int | `0` |
| `user.lists` | object |  |
| `user.lists.favorites` | object |  |
| `user.lists.favorites.count` | int | `0` |
| `user.lists.favorites.public` | bool | `False` |
| `user.lists.wantToGo` | object |  |
| `user.lists.wantToGo.count` | int | `0` |
| `user.lists.wantToGo.public` | bool | `False` |
| `user.lists.starred` | object |  |
| `user.lists.starred.count` | int | `0` |
| `user.lists.starred.public` | bool | `False` |
| `searchHistory` | array&lt;object&gt; | (2 项) |
| `searchHistory[].id` | str | `h1` |
| `searchHistory[].kind` | str | `place` |
| `searchHistory[].text` | str | `五道口购物中心` |
| `searchHistory[].placeId` | str | `ChIJd8tYDhBU8DURkwewhb8tMIM` |
| `searchHistory[].subtitle` | str | `北京市海淀区五道口成府路28号…` |
| `settings` | object |  |
| `settings.appDisplay` | object |  |
| `settings.appDisplay.wlanOnly` | bool | `False` |
| `settings.appDisplay.satelliteView` | bool | `False` |
| `settings.appDisplay.accessibility` | bool | `False` |
| `settings.appDisplay.shakeFeedback` | bool | `False` |
| `settings.appDisplay.language` | NoneType |  |
| `settings.appDisplay.theme` | str | `始终采用浅色主题` |
| `settings.appDisplay.distanceUnit` | str | `自动` |
| `settings.appDisplay.scaleBar` | str | `缩放时` |
| `settings.appDisplay.videoAutoplay` | str | `始终开启自动播放功能` |
| `settings.navigation` | object |  |
| `settings.navigation.muteState` | str | `unmuted` |
| `settings.navigation.voiceVolume` | str | `medium` |
| `settings.navigation.playVoiceOverBluetooth` | bool | `True` |
| `settings.navigation.playVoiceDuringCalls` | bool | `True` |
| `settings.navigation.playAudioCues` | bool | `True` |
| `settings.navigation.showMediaControls` | bool | `False` |
| `settings.navigation.trafficAlerts` | bool | `True` |
| `settings.navigation.avoidTolls` | bool | `False` |
| `settings.navigation.avoidHighways` | bool | `False` |
| `settings.navigation.avoidFerries` | bool | `False` |
| `settings.navigation.fuelEfficient` | bool | `True` |
| `settings.navigation.colorScheme` | str | `auto` |
| `settings.navigation.distanceUnits` | str | `auto` |
| `settings.navigation.keepMapNorthUp` | bool | `False` |
| `settings.navigation.showRoutePreview` | bool | `True` |
| `settings.navigation.speedometer` | bool | `True` |
| `settings.navigation.drivingNotifications` | bool | `False` |
| `settings.navigation.bluetoothTunnelBeacon` | bool | `False` |
| `settings.locationPrivacy` | object |  |
| `settings.locationPrivacy.saveRecentSearches` | bool | `True` |
| `settings.offlineMaps` | object |  |
| `settings.offlineMaps.autoUpdate` | bool | `True` |
| `settings.offlineMaps.autoDownloadRecommended` | bool | `True` |
| `settings.offlineMaps.downloadPreference` | str | `仅通过 WLAN 网络` |
| `settings.notifications` | object |  |
| `settings.notifications.traffic` | object |  |
| `settings.notifications.traffic.offlineMaps` | str | `开启` |
| `settings.notifications.traffic.nearbyTraffic` | str | `开启` |
| `settings.notifications.traffic.publicTransport` | str | `开启` |
| `settings.notifications.traffic.parkingLocation` | str | `开启` |
| `settings.notifications.traffic.desktopDirections` | str | `开启` |
| `settings.notifications.recommendations` | object |  |
| `settings.notifications.recommendations.nearbyPlaces` | str | `开启` |
| `settings.notifications.recommendations.newPlaces` | str | `开启` |
| `currentLocation` | object |  |
| `currentLocation.latitude` | float | `39.9794688` |
| `currentLocation.longitude` | float | `116.3323982` |
| `currentView` | object |  |
| `currentView.searchResults` | array | (0 项) |
| `currentView.poi` | NoneType |  |
| `currentView.route` | NoneType |  |
| `currentView.routeModes` | object |  |
| `currentView.autocomplete` | NoneType |  |
| `currentView.placeResultsSheetOpen` | bool | `False` |
| `currentView.routeSheetOpen` | bool | `False` |
| `currentView.routeSetupOpen` | bool | `False` |

### railway12306 (`railway12306`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.railway12306;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `from` | str | `上海` |
| `to` | str | `南京` |
| `date` | str | `2026-05-08` |
| `isStudent` | bool | `False` |
| `searchHistory` | array&lt;str&gt; | (2 项) |
| `stationSelectTarget` | str | `from` |
| `orders` | array&lt;object&gt; | (3 项) |
| `orders[].id` | str | `EK61728394` |
| `orders[].trainNo` | str | `G7536` |
| `orders[].fromStation` | str | `杭州东` |
| `orders[].toStation` | str | `上海虹桥` |
| `orders[].departTime` | str | `19:15` |
| `orders[].arriveTime` | str | `20:12` |
| `orders[].date` | str | `2026-02-09` |
| `orders[].tickets` | array&lt;object&gt; | (1 项) |
| `orders[].tickets[].passengerName` | str | `赵宇轩` |
| `orders[].tickets[].ticketType` | str | `学生票` |
| `orders[].tickets[].seatType` | str | `二等座` |
| `orders[].tickets[].seatNo` | str | `06车 15A号` |
| `orders[].tickets[].price` | int | `58` |
| `orders[].status` | str | `completed` |
| `orders[].createTime` | str | `2026-02-08T10:30:00` |
| `passengers` | array&lt;object&gt; | (9 项) |
| `passengers[].id` | str | `p1` |
| `passengers[].name` | str | `赵宇轩` |
| `passengers[].idType` | str | `身份证` |
| `passengers[].idNo` | str | `310101199501017821` |
| `passengers[].isDefault` | bool | `True` |
| `passengers[].ticketType` | str | `学生` |
| `settings` | object |  |
| `settings.fingerprint` | bool | `False` |
| `settings.notificationEnabled` | bool | `True` |
| `settings.notificationSound` | bool | `True` |
| `settings.notificationVibrate` | bool | `True` |
| `settings.fontSize` | str | `medium` |
| `settings.highContrast` | bool | `False` |
| `settings.version` | str | `standard` |
| `settings.paymentPassword` | bool | `False` |
| `settings.recentRecommend` | bool | `True` |
| `settings.adRecommend` | bool | `False` |
| `selectedTrain` | NoneType |  |
| `notificationsRead` | array | (0 项) |
| `lastQuerySummary` | NoneType |  |
| `invoiceHeaders` | array | (0 项) |
| `invoiceEmail` | str |  |
| `userProfile` | object |  |
| `userProfile.name` | str | `赵宇轩` |
| `userProfile.phone` | str | `13812348520` |
| `userProfile.phoneVerified` | bool | `True` |
| `userProfile.realNameVerified` | bool | `True` |
| `userProfile.memberLevel` | str | `二星会员` |
| `userProfile.points` | int | `12680` |
| `userProfile.diningPoints` | int | `0` |
| `userProfile.pointsExpireDate` | str | `2026年6月30日` |
| `userProfile.upgradeNeeded` | int | `37320` |
| `userProfile.avatar` | str |  |
| `isLoggedIn` | bool | `True` |
| `loginUser` | object |  |
| `loginUser.username` | str | `xuan123456` |
| `loginUser.password` | str | `Zhao@2026` |
| `loginUser.phone` | str | `13812348520` |
| `loginUser.email` | str | `zhaoyuxuan@example.com` |
| `auth` | object |  |
| `auth.accounts` | array&lt;object&gt; | (3 项) |
| `auth.accounts[].username` | str | `xuan123456` |
| `auth.accounts[].password` | str | `Zhao@2026` |
| `auth.accounts[].name` | str | `赵宇轩` |
| `auth.accounts[].idNo` | str | `310101199501017821` |
| `auth.accounts[].phone` | str | `13812348520` |
| `auth.accounts[].email` | str | `zhaoyuxuan@example.com` |
| `auth.loginAttempts` | array | (0 项) |
| `auth.lastLoginHint` | NoneType |  |
| `auth.resetVerification` | NoneType |  |
| `auth.resetVerificationAttempts` | array | (0 项) |
| `directTrains` | array | (0 项) |
| `transferPlans` | array | (0 项) |
| `_temp` | object |  |
| `_temp.queryLoading` | bool | `False` |
| `_temp.queryError` | NoneType |  |
| `searchForm` | object |  |
| `searchForm.from` | str | `上海` |
| `searchForm.to` | str | `南京` |
| `searchForm.date` | str | `2026-05-08` |
| `searchForm.isStudent` | bool | `False` |
| `user` | object |  |
| `user.name` | str | `赵宇轩` |
| `user.phone` | str | `13812348520` |
| `user.phoneVerified` | bool | `True` |
| `user.realNameVerified` | bool | `True` |
| `user.memberLevel` | str | `二星会员` |
| `user.points` | int | `12680` |
| `user.diningPoints` | int | `0` |
| `user.pointsExpireDate` | str | `2026年6月30日` |
| `user.upgradeNeeded` | int | `37320` |
| `user.avatar` | str |  |
| `notifications` | array&lt;object&gt; | (3 项) |
| `notifications[].id` | str | `n0` |
| `notifications[].type` | str | `trip` |
| `notifications[].date` | str | `2026-02-14` |
| `notifications[].time` | str | `09:00` |
| `notifications[].title` | str | `铁路行程提醒` |
| `notifications[].fromStation` | str | `上海虹桥` |
| `notifications[].toStation` | str | `南京南` |
| `notifications[].trainNo` | str | `G7002` |
| `notifications[].weather` | object |  |
| `notifications[].weather.from` | str | `2°C~8°C 晴` |
| `notifications[].weather.to` | str | `0°C~7°C 多云` |
| `notifications[].departTime` | str | `02月14日 08:30` |
| `notifications[].departTimestamp` | str | `2026-02-14T08:30:00` |
| `notifications[].gate` | str | `二层候车室B06检票口` |
| `notifications[].note` | str | `出行乘客较多，请您务必预留足够的安检、候车检票时间，尽量提前到站，以免耽误您的行程。` |
| `account` | object |  |
| `account.personalInfo` | object |  |
| `account.personalInfo.name` | str | `赵宇轩` |
| `account.personalInfo.username` | str | `xuan123456` |
| `account.personalInfo.status` | str | `已通过` |
| `account.studentQualification` | object |  |
| `account.studentQualification.desc` | str | `购票优惠，学生专享` |
| `account.phone` | object |  |
| `account.phone.number` | str | `13812348520` |
| `account.phone.status` | str | `已核验` |
| `account.email` | object |  |
| `account.email.address` | str | `zhaoyuxuan@example.com` |
| `account.email.status` | str | `未通过核验` |
| `studentVerify` | object |  |
| `studentVerify.year` | str | `2026学年` |
| `studentVerify.remaining` | int | `2` |
| `studentVerify.from` | str | `上海` |
| `studentVerify.to` | str | `成都` |
| `servicePhones` | array&lt;object&gt; | (18 项) |
| `servicePhones[].region` | str | `哈尔滨铁路客户服务中心` |
| `servicePhones[].areaCode` | str | `0451` |
| `servicePhones[].phone` | str | `12306` |
| `queryState` | object |  |
| `queryState.directTrains` | array | (0 项) |
| `queryState.transferPlans` | array | (0 项) |
| `queryState.loading` | bool | `False` |
| `queryState.error` | NoneType |  |
| `lastPickedTrain` | NoneType |  |
| `lastLoginHint` | NoneType |  |

### 小红书 (`redbook`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.redbook;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `user` | object |  |
| `user.id` | str | `xiaoming` |
| `user.name` | str | `小明` |
| `user.avatar` | str | `/@app-assets/RedBook/my/mine_def_touxiang_3x.png` |
| `user.userCover` | str | `/@app-assets/RedBook/my/mine_bg_3x.png` |
| `user.following` | int | `7` |
| `user.followers` | int | `108` |
| `user.likesAndCollections` | int | `326` |
| `user.intro` | str | `一只野生程序猿存档 🌟 喜欢摄影 \| 旅行 \| 美食 记录生活中的小美好 ✨` |
| `user.location` | str | `上海` |
| `user.address` | str | `上海` |
| `user.gender` | str | `Female` |
| `user.age` | str | `24` |
| `user.followings` | array&lt;str&gt; | (7 项) |
| `user.likedNotes` | array&lt;str&gt; | (2 项) |
| `user.collectedNotes` | array&lt;str&gt; | (2 项) |
| `user.likedCommentsByNote` | object |  |
| `user.likedCommentsByNote.2kvlyjk5h` | array&lt;str&gt; | (2 项) |
| `user.likedCommentsByNote.xpctqzmeh` | array&lt;str&gt; | (1 项) |
| `user.commentList` | array | (0 项) |
| `user.publishedNoteIds` | array&lt;str&gt; | (2 项) |
| `entities` | object |  |
| `entities.usersById` | object |  |
| `entities.notesById` | object |  |
| `feedIds` | array | (0 项) |
| `userIds` | array | (0 项) |
| `chats` | array | (0 项) |
| `notifications` | array&lt;object&gt; | (6 项) |
| `notifications[].id` | str | `n1` |
| `notifications[].type` | str | `like_note` |
| `notifications[].userId` | str | `x1dubbu13` |
| `notifications[].username` | str | `海边小橘子` |
| `notifications[].userAvatar` | str | `/cdn/redbook/images/avatars/x1dubbu13.jpg` |
| `notifications[].noteId` | str | `note_0` |
| `notifications[].noteCover` | str | `/cdn/redbook/images/posts/2kvlyjk5h/0.jpg` |
| `notifications[].timestamp` | int | `1778251297221` |
| `notifications[].isRead` | bool | `False` |
| `history` | array | (0 项) |
| `settings` | object |  |
| `settings.general` | object |  |
| `settings.general.useSystemFont` | bool | `False` |
| `settings.general.playAudio` | bool | `False` |
| `settings.general.autoRefresh` | bool | `True` |
| `settings.general.muteVideo` | bool | `False` |
| `settings.general.mobileDownload` | bool | `False` |
| `settings.general.videoHDR` | bool | `False` |
| `settings.general.imageHDR` | bool | `True` |
| `settings.general.mobileNetwork` | bool | `True` |
| `settings.general.history` | bool | `True` |
| `settings.general.videoInteraction` | bool | `True` |
| `settings.general.preUpload` | bool | `True` |
| `settings.general.teenMode` | bool | `False` |
| `settings.notification` | object |  |
| `settings.notification.receiveMsg` | bool | `False` |
| `settings.notification.likeCollect` | bool | `False` |
| `settings.notification.newFollow` | bool | `False` |
| `settings.notification.comment` | bool | `False` |
| `settings.notification.atMe` | bool | `False` |
| `settings.notification.storeNotif` | bool | `False` |
| `settings.notification.privateChat` | bool | `True` |
| `settings.notification.groupChat` | bool | `True` |
| `settings.notification.strangers` | bool | `True` |
| `settings.notification.authorUpdates` | str | `followingUnread` |
| `settings.notification.liveReminder` | str | `off` |
| `settings.notification.contentRecommend` | str | `off` |
| `settings.notification.userRecommend` | str | `off` |
| `settings.notification.otherNotif` | str | `receive` |
| `settings.notification.inAppBanner` | str | `off` |
| `settings.privacy` | object |  |
| `settings.privacy.oneClickProtect` | bool | `False` |
| `settings.privacy.showChatStatus` | bool | `True` |
| `settings.privacy.onlyFollowComment` | bool | `True` |
| `settings.privacy.onlyFollowDanmaku` | bool | `True` |
| `settings.privacy.onlyFollowAt` | bool | `True` |
| `settings.privacy.allowDownload` | bool | `True` |
| `settings.privacy.recommendPeople` | bool | `True` |
| `settings.privacy.onlineStatus` | str | `friends` |
| `settings.privacy.messagePermission` | str | `following` |
| `settings.privacy.collectVisibility` | str | `private` |
| `settings.privacy.commentVisibility` | str | `public` |
| `settings.language` | str | `zh-CN` |
| `storage` | object |  |
| `storage.cacheSizeBytes` | int | `5382144` |
| `homeState` | object |  |
| `homeState.activeCategory` | str | `recommend` |
| `homeState.citySubTab` | str | `recommend` |
| `homeState.displayCount` | int | `20` |
| `publishDraft` | object |  |
| `publishDraft.text` | str |  |
| `publishDraft.templateId` | str | `basic` |
| `publishDraft.title` | str |  |
| `publishDraft.images` | array | (0 项) |

### reddit (`reddit`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.reddit;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `user` | object |  |
| `user.username` | str | `Embarrassed_Fee8630` |
| `user.isOnline` | bool | `True` |
| `user.avatar` | str | `/apps/Reddit/assets/avatars/0042c9bad3f2bad01c8...` |
| `user.bio` | str |  |
| `user.bannerImage` | str |  |
| `communities` | array&lt;object&gt; | (6 项) |
| `communities[].id` | str | `com_superman` |
| `communities[].name` | str | `/@app-assets/Reddit/r/superman` |
| `communities[].members` | str | `274k` |
| `communities[].isSpotlight` | bool | `True` |
| `communities[].spotlightTitle` | str | `From Lex Luthor to Krypto the Superdog, share y...` |
| `communities[].spotlightImage` | str | `/@app-assets/Reddit/icons/001.png` |
| `communities[].icon` | str | `/apps/Reddit/assets/avatars/03ceaf617ca1bc5336b...` |
| `posts` | array&lt;object&gt; | (2999 项) |
| `posts[].id` | str | `my_post_1` |
| `posts[].subreddit` | str | `r/self` |
| `posts[].timeAgo` | str | `now` |
| `posts[].title` | str | `有没有人也会半夜突然想整理房间？` |
| `posts[].content` | str | `明明很困了，但一想到明天事情多，就忍不住开始收拾桌面、整理衣柜，结果越收拾越精神。你们会这样吗？` |
| `posts[].upvotes` | str | `1` |
| `posts[].comments` | str | `0` |
| `posts[].shares` | int | `0` |
| `posts[].isAd` | bool | `False` |
| `posts[].url` | str |  |
| `posts[].author` | str | `Embarrassed_Fee8630` |
| `posts[].image` | NoneType |  |
| `posts[].images` | NoneType |  |
| `posts[].subredditIcon` | NoneType |  |
| `posts[].authorAvatar` | str | `/apps/Reddit/assets/avatars/0042c9bad3f2bad01c8...` |
| `joinedCommunityIds` | array | (0 项) |
| `postVotes` | object |  |
| `commentVotes` | object |  |
| `chatThreadsByUsername` | object |  |
| `chatThreadsByUsername.Objective-Skill-2591` | array&lt;object&gt; | (2 项) |
| `chatThreadsByUsername.Objective-Skill-2591[].id` | str | `ct_obj_1` |
| `chatThreadsByUsername.Objective-Skill-2591[].from` | str | `them` |
| `chatThreadsByUsername.Objective-Skill-2591[].body` | str | `你上次推荐的那家店我去了，味道确实不错！` |
| `chatThreadsByUsername.Objective-Skill-2591[].created_utc` | int | `1710000001` |
| `chatThreadsByUsername.Intelligent_Drama_46` | array&lt;object&gt; | (2 项) |
| `chatThreadsByUsername.Intelligent_Drama_46[].id` | str | `ct_int_1` |
| `chatThreadsByUsername.Intelligent_Drama_46[].from` | str | `me` |
| `chatThreadsByUsername.Intelligent_Drama_46[].body` | str | `hello` |
| `chatThreadsByUsername.Intelligent_Drama_46[].created_utc` | int | `1710000100` |
| `chatThreadRepliesByKey` | object |  |
| `chatThreadRepliesByKey.Objective-Skill-2591:ct_obj_1` | array&lt;object&gt; | (1 项) |
| `chatThreadRepliesByKey.Objective-Skill-2591:ct_obj_1[].id` | str | `cr_obj_1` |
| `chatThreadRepliesByKey.Objective-Skill-2591:ct_obj_1[].from` | str | `me` |
| `chatThreadRepliesByKey.Objective-Skill-2591:ct_obj_1[].body` | str | `确实不错，下次我再去试试别的菜。` |
| `chatThreadRepliesByKey.Objective-Skill-2591:ct_obj_1[].created_utc` | int | `1710000004` |
| `userCommentsByPostId` | object |  |
| `userCommentsByPostId.sample_post_1` | array&lt;object&gt; | (2 项) |
| `userCommentsByPostId.sample_post_1[].id` | str | `uc_1` |
| `userCommentsByPostId.sample_post_1[].body` | str | `补充一点：晚上早点放下手机真的有用。` |
| `userCommentsByPostId.sample_post_1[].score` | int | `1` |
| `userCommentsByPostId.sample_post_1[].created_utc` | int | `1710000002` |
| `userCommentsByPostId.sample_post_1[].author` | str | `Embarrassed_Fee8630` |
| `userPosts` | array&lt;object&gt; | (1 项) |
| `userPosts[].id` | str | `my_post_1` |
| `userPosts[].subreddit` | str | `r/self` |
| `userPosts[].timeAgo` | str | `now` |
| `userPosts[].title` | str | `有没有人也会半夜突然想整理房间？` |
| `userPosts[].content` | str | `明明很困了，但一想到明天事情多，就忍不住开始收拾桌面、整理衣柜，结果越收拾越精神。你们会这样吗？` |
| `userPosts[].upvotes` | str | `1` |
| `userPosts[].comments` | str | `0` |
| `userPosts[].shares` | int | `0` |
| `userPosts[].isAd` | bool | `False` |
| `userPosts[].url` | str |  |
| `userPosts[].author` | str | `Embarrassed_Fee8630` |
| `userPosts[].image` | NoneType |  |
| `userPosts[].images` | NoneType |  |
| `userPosts[].subredditIcon` | NoneType |  |
| `userPosts[].authorAvatar` | str | `/apps/Reddit/assets/avatars/0042c9bad3f2bad01c8...` |
| `createDraft` | object |  |
| `createDraft.selectedCommunity` | NoneType |  |
| `createDraft.selectedFlairs` | array | (0 项) |
| `settings` | object |  |
| `settings.showNSFW` | bool | `False` |
| `settings.blurNSFW` | bool | `True` |
| `settings.showCommunityStyles` | bool | `True` |
| `settings.theme` | str | `auto` |
| `settings.autoplayVideo` | str | `wifi` |
| `settings.quietAudio` | bool | `False` |
| `settings.inboxNotifications` | bool | `True` |
| `settings.commentReplyNotifications` | bool | `True` |
| `settings.upvoteNotifications` | bool | `True` |
| `settings.mentionNotifications` | bool | `True` |
| `settings.chatMessageNotifications` | bool | `True` |
| `settings.communityAlerts` | bool | `True` |
| `settings.trendingNotifications` | bool | `True` |
| `settings.homeFeedRecommendations` | bool | `True` |
| `settings.allowCookies` | bool | `True` |
| `settings.personalizedAds` | bool | `True` |
| `settings.showOnlineStatus` | bool | `True` |
| `settings.defaultCommentSort` | str | `best` |
| `settings.rememberPerPostSort` | bool | `True` |
| `settings.textSize` | str | `default` |
| `settings.reduceAnimations` | bool | `False` |
| `settings.openLinksInApp` | bool | `True` |
| `settings.savedImageAttribution` | bool | `True` |
| `settings.defaultMarkdown` | bool | `False` |

### 腾讯会议 (`tencent_meeting`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.tencent_meeting;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `user` | object |  |
| `user.id` | str | `user_001` |
| `user.name` | str | `小明` |
| `user.avatar` | str |  |
| `user.type` | str | `free` |
| `user.meetingId` | str | `123 456 7890` |
| `user.phone` | str | `+86 17312341995` |
| `user.wechat` | str | `小明` |
| `personalRoom` | object |  |
| `personalRoom.meetingId` | str | `337 607 3736` |
| `personalRoom.link` | str | `meeting.tencent.com/p/3376073736` |
| `personalRoom.password` | str | `666348` |
| `personalRoom.waitingRoom` | bool | `False` |
| `personalRoom.allowBeforeHost` | bool | `False` |
| `personalRoom.watermark` | bool | `False` |
| `personalRoom.multiDevice` | bool | `False` |
| `personalRoom.muteOnJoin` | str | `auto_after_6` |
| `messages` | array&lt;object&gt; | (2 项) |
| `messages[].id` | str | `msg_1` |
| `messages[].type` | str | `system` |
| `messages[].title` | str | `系统消息` |
| `messages[].content` | str | `专业版新权益：会中展示认证身份` |
| `messages[].detail` | str | `开启展示后，可在身份名牌、参会成员列表、个人资料卡中外显认证身份，提升专业形象。` |
| `messages[].time` | str | `2025年12月04日 18:44` |
| `messages[].read` | bool | `False` |
| `otherDevices` | array&lt;object&gt; | (1 项) |
| `otherDevices[].id` | str | `device_mac` |
| `otherDevices[].deviceType` | str | `mac` |
| `otherDevices[].deviceName` | str | `Mac` |
| `otherDevices[].isLoggedIn` | bool | `True` |
| `otherDevices[].inMeeting` | bool | `False` |
| `ongoingMeetings` | array&lt;object&gt; | (3 项) |
| `ongoingMeetings[].meetingId` | str | `276760582` |
| `ongoingMeetings[].title` | str | `老王的快速会议` |
| `ongoingMeetings[].hostName` | str | `老王` |
| `ongoingMeetings[].hostId` | str | `host_laowang` |
| `ongoingMeetings[].duration` | int | `60` |
| `ongoingMeetings[].timezone` | str | `(GMT+08:00) 中国标准时间` |
| `ongoingMeetings[].startTime` | int | `1778250997184` |
| `history` | array&lt;object&gt; | (13 项) |
| `history[].id` | str | `test_001` |
| `history[].meetingId` | str | `111 222 333` |
| `history[].title` | str | `小明的快速会议` |
| `history[].duration` | int | `60` |
| `history[].timezone` | str | `(GMT+08:00) 中国标准时间` |
| `history[].hostId` | str | `user_001` |
| `history[].type` | str | `quick` |
| `history[].participants` | array&lt;object&gt; | (2 项) |
| `history[].participants[].id` | str | `user_001` |
| `history[].participants[].name` | str | `小明` |
| `history[].participants[].avatar` | str |  |
| `history[].startTime` | int | `1770170400000` |
| `history[].endTime` | int | `1770173100000` |
| `history[].participations` | array&lt;object&gt; | (1 项) |
| `history[].participations[].joinTime` | int | `1770170400000` |
| `history[].participations[].duration` | int | `2700000` |
| `contacts` | array&lt;object&gt; | (5 项) |
| `contacts[].id` | str | `user_zhangsan` |
| `contacts[].name` | str | `张三` |
| `scheduledMeetings` | array&lt;object&gt; | (2 项) |
| `scheduledMeetings[].id` | str | `sched_001` |
| `scheduledMeetings[].meetingId` | str | `836 291 475` |
| `scheduledMeetings[].title` | str | `项目例会` |
| `scheduledMeetings[].duration` | int | `60` |
| `scheduledMeetings[].timezone` | str | `(GMT+08:00) 中国标准时间` |
| `scheduledMeetings[].repeatType` | str | `weekly` |
| `scheduledMeetings[].hostId` | str | `user_001` |
| `scheduledMeetings[].invitees` | array&lt;object&gt; | (2 项) |
| `scheduledMeetings[].invitees[].id` | str | `user_zhangsan` |
| `scheduledMeetings[].invitees[].name` | str | `张三` |
| `scheduledMeetings[].settings` | object |  |
| `scheduledMeetings[].settings.calendar` | bool | `True` |
| `scheduledMeetings[].settings.waitingRoom` | bool | `False` |
| `scheduledMeetings[].settings.enableSignUp` | bool | `False` |
| `scheduledMeetings[].settings.allowBeforeHost` | bool | `True` |
| `scheduledMeetings[].settings.muteOnJoin` | str | `auto_after_6` |
| `scheduledMeetings[].settings.watermark` | bool | `False` |
| `scheduledMeetings[].settings.allowMultiDevice` | bool | `True` |
| `scheduledMeetings[].settings.forbidAddContact` | bool | `False` |
| `scheduledMeetings[].settings.autoCloudRecord` | bool | `False` |
| `scheduledMeetings[].settings.autoTranscribe` | bool | `False` |
| `scheduledMeetings[].settings.allowUploadDoc` | bool | `True` |
| `scheduledMeetings[].status` | str | `pending` |
| `scheduledMeetings[].startTime` | int | `1778258797184` |
| `scheduledMeetings[].createdAt` | int | `1778251597184` |
| `settings` | object |  |
| `settings.notifications` | bool | `True` |
| `settings.micOnJoin` | bool | `True` |
| `settings.speakerOnJoin` | bool | `True` |
| `settings.micFloating` | bool | `True` |
| `settings.micSound` | bool | `False` |
| `settings.cameraOnJoin` | bool | `False` |
| `settings.videoMirror` | bool | `True` |
| `settings.hideNonVideo` | bool | `False` |
| `settings.hideSelf` | bool | `False` |
| `settings.showPreview` | bool | `False` |
| `settings.danmu` | bool | `True` |
| `settings.showDuration` | bool | `True` |
| `settings.nearbyDiscovery` | bool | `False` |
| `settings.voiceExcitation` | bool | `True` |
| `settings.shortcutFloat` | bool | `False` |
| `settings.safeDrive` | bool | `True` |
| `settings.darkModeFollow` | bool | `True` |
| `settings.showIdentity` | bool | `False` |
| `activeMeeting` | NoneType |  |
| `pendingMeetingConfig` | NoneType |  |
| `currentScheduledMeeting` | NoneType |  |

### 微信 (`wechat`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.wechat;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `user` | object |  |
| `user.wxid` | str | `xiaoming001` |
| `user.name` | str | `小明` |
| `user.avatar` | str | `/@app-assets/Wechat/avatars/avatar_64.jpg` |
| `user.region` | str | `中国大陆 北京` |
| `user.currentLocation` | str | `中国大陆 北京` |
| `user.gender` | str | `男` |
| `user.phone` | str | `17366666695` |
| `user.signature` | str | `这是我的签名` |
| `user.pat` | str |  |
| `user.qqId` | str | `123456789` |
| `user.beans` | int | `0` |
| `user.steps` | int | `599` |
| `user.likes` | int | `0` |
| `user.addresses` | array | (0 项) |
| `user.invoices` | array | (0 项) |
| `auth` | object |  |
| `auth.accounts` | array&lt;object&gt; | (1 项) |
| `auth.accounts[].phone` | str | `17366666695` |
| `auth.accounts[].password` | str | `wechat_pwd_123` |
| `auth.accounts[].createdAt` | int | `0` |
| `auth.accounts[].activated` | bool | `True` |
| `auth.accounts[].realName` | str |  |
| `auth.accounts[].idNumber` | str |  |
| `auth.accounts[].failedAttempts` | int | `0` |
| `auth.accounts[].requireCaptcha` | bool | `False` |
| `auth.session` | object |  |
| `auth.session.loggedIn` | bool | `True` |
| `auth.session.phone` | str | `17366666695` |
| `auth.session.expiresAt` | NoneType |  |
| `auth.session.currentDeviceId` | str | `old_device_1` |
| `auth.trustedDevicesByPhone` | object |  |
| `auth.trustedDevicesByPhone.17366666695` | array&lt;object&gt; | (1 项) |
| `auth.trustedDevicesByPhone.17366666695[].deviceId` | str | `old_device_1` |
| `auth.trustedDevicesByPhone.17366666695[].deviceName` | str | `旧设备` |
| `auth.trustedDevicesByPhone.17366666695[].trustedAt` | int | `0` |
| `auth.verificationCodes` | array | (0 项) |
| `auth.verificationAttempts` | array | (0 项) |
| `auth.loginAttempts` | array | (0 项) |
| `auth.verificationCodeLength` | int | `6` |
| `auth.verificationCodeExpirySec` | int | `60` |
| `auth.captcha` | object |  |
| `auth.captcha.requiredAfterFailures` | int | `2` |
| `auth.nextVerificationCodeOverride` | NoneType |  |
| `auth.pendingTrustDevice` | NoneType |  |
| `chats` | array&lt;object&gt; | (4 项) |
| `chats[].id` | str | `wxid_blank_001` |
| `chats[].user` | object |  |
| `chats[].user.wxid` | str | `wxid_blank_001` |
| `chats[].user.name` | str | `blank.` |
| `chats[].user.avatar` | str | `/@app-assets/Wechat/avatars/avatar_65.jpg` |
| `chats[].isMuted` | bool | `False` |
| `chats[].isSticky` | bool | `False` |
| `chats[].isAlert` | bool | `False` |
| `chats[].messages` | array&lt;object&gt; | (4 项) |
| `chats[].messages[].id` | str | `m1` |
| `chats[].messages[].type` | str | `time` |
| `chats[].messages[].content` | str | `21:46` |
| `chats[].messages[].senderId` | str | `system` |
| `chats[].messages[].timestamp` | int | `1778247997184` |
| `contacts` | array&lt;object&gt; | (12 项) |
| `contacts[].wxid` | str | `wxid_blank_001` |
| `contacts[].name` | str | `blank.` |
| `contacts[].avatar` | str | `/@app-assets/Wechat/avatars/avatar_65.jpg` |
| `contacts[].category` | str | `B` |
| `contacts[].signature` | str | `学习使人快乐` |
| `contacts[].alias` | str | `blank.` |
| `contacts[].region` | str | `马达加斯加` |
| `contacts[].gender` | str | `男` |
| `contacts[].source` | str | `对方通过扫一扫添加` |
| `contacts[].addedTime` | str | `2025年12月` |
| `contacts[].commonGroups` | int | `0` |
| `contacts[].memo` | str |  |
| `contacts[].isBlacklisted` | bool | `False` |
| `contacts[].steps` | int | `6194` |
| `contacts[].likes` | int | `0` |
| `contacts[].permissionMode` | str | `all` |
| `contacts[].hideMyMoments` | bool | `False` |
| `contacts[].hideTheirMoments` | bool | `False` |
| `contacts[].aiConfig` | object |  |
| `contacts[].aiConfig.enabled` | bool | `True` |
| `contacts[].aiConfig.systemPrompt` | str | `热爱学习的程序员，性格开朗友善，喜欢聊技术话题，偶尔会用代码梗。` |
| `moments` | array&lt;object&gt; | (5 项) |
| `moments[].id` | str | `mo1` |
| `moments[].wxid` | str | `wxid_w5q69z0jbsuj22` |
| `moments[].userName` | str | `小明` |
| `moments[].userAvatar` | str | `/@app-assets/Wechat/avatars/avatar_64.jpg` |
| `moments[].content` | str | `你好` |
| `moments[].timestamp` | int | `1778251477184` |
| `authorizedApps` | array&lt;object&gt; | (3 项) |
| `authorizedApps[].id` | str | `meeting` |
| `authorizedApps[].name` | str | `腾讯会议` |
| `authorizedApps[].icon` | str | `/@app-assets/Wechat/icons/meeting.png` |
| `authorizedApps[].type` | str | `移动应用` |
| `authorizedApps[].permissions` | array&lt;str&gt; | (1 项) |
| `nearbyPeople` | array&lt;object&gt; | (10 项) |
| `nearbyPeople[].wxid` | str | `wxid_nearby_001` |
| `nearbyPeople[].name` | str | `懂得珍惜才配拥有` |
| `nearbyPeople[].avatar` | str | `/@app-assets/Wechat/avatars/nearby_01.jpg` |
| `nearbyPeople[].gender` | str | `男` |
| `nearbyPeople[].region` | str | `北京市朝阳区` |
| `nearbyPeople[].signature` | str | `我以为爱情可以填满人生遗憾` |
| `nearbyPeople[].distance` | str | `100米以内` |
| `momentDraft` | object |  |
| `momentDraft.content` | str |  |
| `momentDraft.location` | NoneType |  |
| `momentDraft.selectedImages` | array | (0 项) |
| `textMomentDraft` | object |  |
| `textMomentDraft.content` | str |  |
| `textMomentDraft.location` | NoneType |  |
| `settings` | object |  |
| `settings.security` | object |  |
| `settings.security.voiceprint` | bool | `False` |
| `settings.modes` | object |  |
| `settings.modes.care` | bool | `False` |
| `settings.modes.minor` | bool | `False` |
| `settings.notifications` | object |  |
| `settings.notifications.message` | bool | `True` |
| `settings.notifications.voiceVideo` | bool | `True` |
| `settings.notifications.displayMode` | str | `full` |
| `settings.notifications.notificationSound` | str | `跟随系统` |
| `settings.notifications.incomingRingtone` | str | `微信` |
| `settings.chat` | object |  |
| `settings.chat.speakerMode` | bool | `True` |
| `settings.chat.sendButton` | bool | `True` |
| `settings.general` | object |  |
| `settings.general.darkMode` | bool | `False` |
| `settings.general.followSystem` | bool | `True` |
| `settings.general.landscape` | bool | `False` |
| `settings.general.nfc` | bool | `True` |
| `settings.general.autoDownload` | str | `仅Wi-Fi网络` |
| `settings.general.translationLanguage` | str | `简体中文` |
| `settings.general.autoTranslate` | bool | `False` |
| `settings.general.mediaAutoDownload` | bool | `True` |
| `settings.general.savePhotos` | bool | `True` |
| `settings.general.saveVideos` | bool | `True` |
| `settings.general.imageSearch` | bool | `False` |
| `settings.general.keepOriginal` | bool | `False` |
| `settings.general.mobileAutoPlay` | bool | `True` |
| `settings.general.mobileVoiceQuality` | bool | `True` |
| `settings.general.personalizedAudio` | bool | `True` |
| `settings.general.losslessAudio` | bool | `False` |
| `settings.general.showAudioInRecent` | bool | `True` |
| `settings.privacy` | object |  |
| `settings.privacy.friendConfirmation` | bool | `True` |
| `settings.privacy.recommendAddressBook` | bool | `True` |
| `settings.privacy.addMeMethods` | object |  |
| `settings.privacy.addMeMethods.searchByWxid` | bool | `False` |
| `settings.privacy.addMeMethods.searchByPhone` | bool | `True` |
| `settings.privacy.addMeMethods.addByGroup` | bool | `True` |
| `settings.privacy.addMeMethods.addByQrCode` | bool | `True` |
| `settings.privacy.addMeMethods.addByCard` | bool | `True` |
| `settings.privacy.addMeMethods.addByOther` | bool | `True` |
| `settings.privacy.momentsStrangerTen` | bool | `True` |
| `settings.privacy.momentsRange` | str | `最近三天` |
| `settings.discover` | object |  |
| `settings.discover.moments` | object |  |
| `settings.discover.moments.visible` | bool | `True` |
| `settings.discover.moments.notify` | bool | `True` |
| `settings.discover.channels` | object |  |
| `settings.discover.channels.visible` | bool | `True` |
| `settings.discover.channels.notify` | bool | `True` |
| `settings.discover.live` | object |  |
| `settings.discover.live.visible` | bool | `True` |
| `settings.discover.live.notify` | bool | `True` |
| `settings.discover.scan` | object |  |
| `settings.discover.scan.visible` | bool | `True` |
| `settings.discover.listen` | object |  |
| `settings.discover.listen.visible` | bool | `True` |
| `settings.discover.listen.notify` | bool | `True` |
| `settings.discover.topStories` | object |  |
| `settings.discover.topStories.visible` | bool | `True` |
| `settings.discover.topStories.notify` | bool | `True` |
| `settings.discover.search` | object |  |
| `settings.discover.search.visible` | bool | `True` |
| `settings.discover.nearby` | object |  |
| `settings.discover.nearby.visible` | bool | `True` |
| `settings.discover.nearby.notify` | bool | `True` |
| `settings.discover.nearby.showNearbyPeople` | bool | `True` |
| `settings.discover.games` | object |  |
| `settings.discover.games.visible` | bool | `True` |
| `settings.discover.games.notify` | bool | `True` |
| `settings.accessibility` | object |  |
| `settings.accessibility.tencentNews` | object |  |
| `settings.accessibility.tencentNews.enabled` | bool | `True` |
| `settings.accessibility.tencentNews.sticky` | bool | `False` |
| `settings.accessibility.tencentNews.dnd` | bool | `False` |
| `settings.accessibility.broadcast` | object |  |
| `settings.accessibility.broadcast.enabled` | bool | `True` |
| `settings.accessibility.broadcast.sticky` | bool | `False` |
| `settings.accessibility.broadcast.dnd` | bool | `False` |
| `settings.accessibility.qqMail` | object |  |
| `settings.accessibility.qqMail.enabled` | bool | `False` |
| `settings.accessibility.wechatSports` | object |  |
| `settings.accessibility.wechatSports.enabled` | bool | `False` |
| `settings.accessibility.wechatSports.sticky` | bool | `False` |
| `settings.accessibility.wechatSports.dnd` | bool | `False` |
| `settings.accessibility.wechatSports.joinLeaderboard` | bool | `True` |
| `settings.accessibility.wechatSports.recvLeaderboardMsg` | bool | `True` |
| `settings.accessibility.wechatSports.recvLikeMsg` | bool | `True` |
| `settings.accessibility.wechatPay` | object |  |
| `settings.accessibility.wechatPay.enabled` | bool | `False` |
| `settings.accessibility.wechatGames` | object |  |
| `settings.accessibility.wechatGames.enabled` | bool | `False` |
| `subscriptions` | array | (0 项) |
| `_temp` | object |  |
| `_temp.rightAction` | NoneType |  |

### 微信读书 (`wechat_reading`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.wechat_reading;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `user` | object |  |
| `user.id` | str | `user_me` |
| `user.name` | str | `小明` |
| `user.avatar` | str |  |
| `user.gender` | str |  |
| `user.introduction` | str |  |
| `user.signature` | str |  |
| `user.readingTimeMinutes` | int | `120` |
| `user.coinBalance` | int | `50` |
| `user.membership` | bool | `False` |
| `user.registrationDate` | str | `2024-01-01` |
| `user.following` | array&lt;str&gt; | (1 项) |
| `user.isWechatFriend` | bool | `False` |
| `user.likesCount` | int | `0` |
| `user.followerCount` | int | `0` |
| `user.followingCount` | int | `1` |
| `user.badges` | array&lt;object&gt; | (2 项) |
| `user.badges[].id` | str | `b1` |
| `user.badges[].name` | str | `神作爱好者` |
| `user.badges[].type` | str | `神作爱好者` |
| `user.badges[].value` | str | `1` |
| `user.recentBooks` | array&lt;str&gt; | (4 项) |
| `shelf` | array&lt;object&gt; | (6 项) |
| `shelf[].bookId` | str | `60` |
| `shelf[].isPrivate` | bool | `True` |
| `shelf[].addedAt` | str | `2025-12-05T10:00:00` |
| `store` | array&lt;object&gt; | (67 项) |
| `store[].id` | str | `1` |
| `store[].title` | str | `纳瓦尔宝典` |
| `store[].author` | str | `埃里克·乔根森` |
| `store[].cover` | str |  |
| `store[].coverColor` | str | `bg-[#F2EFE9]` |
| `store[].category` | str | `商业` |
| `store[].totalWords` | int | `150000` |
| `store[].rating` | float | `9.2` |
| `store[].recommendedValue` | float | `92.5` |
| `bookProgress` | object |  |
| `bookProgress.1` | object |  |
| `bookProgress.1.bookId` | str | `1` |
| `bookProgress.1.charOffset` | int | `150000` |
| `bookProgress.1.lastReadAt` | str | `2025-12-28T21:00:00` |
| `bookProgress.4` | object |  |
| `bookProgress.4.bookId` | str | `4` |
| `bookProgress.4.charOffset` | int | `120000` |
| `bookProgress.4.lastReadAt` | str | `2025-12-26T20:00:00` |
| `bookProgress.30` | object |  |
| `bookProgress.30.bookId` | str | `30` |
| `bookProgress.30.charOffset` | int | `80000` |
| `bookProgress.30.lastReadAt` | str | `2025-12-24T19:30:00` |
| `bookProgress.58` | object |  |
| `bookProgress.58.bookId` | str | `58` |
| `bookProgress.58.charOffset` | int | `1200000` |
| `bookProgress.58.lastReadAt` | str | `2025-12-25T21:00:00` |
| `bookProgress.60` | object |  |
| `bookProgress.60.bookId` | str | `60` |
| `bookProgress.60.charOffset` | int | `50000` |
| `bookProgress.60.lastReadAt` | str | `2025-12-20T21:00:00` |
| `bookProgress.65` | object |  |
| `bookProgress.65.bookId` | str | `65` |
| `bookProgress.65.charOffset` | int | `200000` |
| `bookProgress.65.lastReadAt` | str | `2025-12-23T18:00:00` |
| `bookProgress.66` | object |  |
| `bookProgress.66.bookId` | str | `66` |
| `bookProgress.66.charOffset` | int | `50000` |
| `bookProgress.66.lastReadAt` | str | `2025-12-22T10:15:00` |
| `bookProgress.67` | object |  |
| `bookProgress.67.bookId` | str | `67` |
| `bookProgress.67.charOffset` | int | `30000` |
| `bookProgress.67.lastReadAt` | str | `2025-12-21T14:20:00` |
| `readingRecords` | array&lt;object&gt; | (263 项) |
| `readingRecords[].id` | str | `week_2` |
| `readingRecords[].key` | str | `week_2` |
| `readingRecords[].recordId` | str | `week_2` |
| `readingRecords[].bookId` | str | `3` |
| `readingRecords[].date` | str | `2026-05-08` |
| `readingRecords[].duration` | int | `30` |
| `readingRecords[].timestamp` | str | `2026-05-08T19:46:37` |
| `settings` | object |  |
| `settings.autoLock` | bool | `False` |
| `settings.allowLandscape` | bool | `True` |
| `settings.hideThought` | bool | `False` |
| `settings.showTimeBattery` | bool | `False` |
| `settings.volumeKeyTurn` | bool | `False` |
| `settings.firstLineIndent` | bool | `False` |
| `settings.clickLeftNext` | bool | `False` |
| `settings.blockWebNovels` | bool | `False` |
| `settings.mixAudio` | bool | `False` |
| `settings.pageTurnStyle` | str | `左右滑动` |
| `settings.darkMode` | str | `跟随系统` |
| `settings.privacy` | object |  |
| `settings.privacy.requireFollowRequest` | bool | `False` |
| `settings.privacy.hideVipGlobal` | bool | `False` |
| `settings.privacy.autoPrivateReading` | bool | `False` |
| `settings.privacy.shelfReplacement` | bool | `False` |
| `settings.privacy.rejectStrangerMsg` | bool | `False` |
| `settings.privacy.closePersonalizedRec` | bool | `False` |
| `settings.privacy.closeReadingRank` | bool | `False` |
| `settings.privacy.profile` | object |  |
| `settings.privacy.profile.showShelf` | bool | `True` |
| `settings.privacy.profile.showLiked` | bool | `False` |
| `settings.privacy.profile.showLists` | bool | `True` |
| `settings.privacy.profile.showBadge` | bool | `True` |
| `settings.privacy.profile.showThought` | bool | `True` |
| `settings.privacy.profile.visibility` | str | `关注我的人可见` |
| `settings.notifications` | object |  |
| `settings.notifications.newFollower` | bool | `True` |
| `settings.notifications.newWechatFriend` | bool | `True` |
| `settings.notifications.activityWelfare` | bool | `True` |
| `readerPrefs` | object |  |
| `readerPrefs.fontSize` | int | `22` |
| `readerPrefs.themeColor` | str | `white` |
| `readerPrefs.themeBg` | str | `matchTheme` |
| `readerPrefs.margin` | int | `3` |
| `readerPrefs.lineHeight` | int | `4` |
| `recommendedAudiobooks` | array&lt;str&gt; | (6 项) |
| `likedListBooks` | array | (0 项) |
| `likedListSyncToHome` | bool | `False` |
| `_temp` | object |  |
| `_temp.audioSubTab` | str | `audio` |
| `allProgressBookIds` | array&lt;str&gt; | (8 项) |
| `readingBookIds` | array&lt;str&gt; | (6 项) |
| `finishedBookIds` | array&lt;str&gt; | (2 项) |
| `homeFinishedBookIds` | array&lt;str&gt; | (2 项) |
| `hotSearch` | array&lt;object&gt; | (7 项) |
| `hotSearch[].id` | str | `h1` |
| `hotSearch[].rank` | int | `1` |
| `hotSearch[].title` | str | `亏成首富从游戏开始` |
| `hotSearch[].subtitle` | str | `#电视剧《年少有为》原著` |
| `hotSearch[].metric` | str | `推荐值 87.7%` |
| `hotSearch[].badge` | str | `好评如潮` |
| `hotSearch[].coverColor` | str | `bg-blue-200` |
| `audiobooks` | array&lt;object&gt; | (20 项) |
| `audiobooks[].id` | str | `audio_1` |
| `audiobooks[].title` | str | `沧浪之水（经典版）` |
| `audiobooks[].author` | str | `阎真` |
| `audiobooks[].coverColor` | str | `#E32D2D` |
| `audiobooks[].plays` | str | `10万` |
| `audiobooks[].rating` | str | `96.2%` |
| `users` | array&lt;object&gt; | (9 项) |
| `users[].id` | str | `user_508` |
| `users[].name` | str | `508` |
| `users[].avatar` | str | `https://api.dicebear.com/7.x/avataaars/svg?seed...` |
| `users[].gender` | str | `男` |
| `users[].introduction` | str | `这个人很懒，什么都没有留下` |
| `users[].signature` | str |  |
| `users[].readingTimeMinutes` | int | `62882` |
| `users[].coinBalance` | int | `0` |
| `users[].membership` | bool | `False` |
| `users[].isWechatFriend` | bool | `True` |
| `users[].likesCount` | int | `0` |
| `users[].followerCount` | int | `3` |
| `users[].followingCount` | int | `10` |
| `users[].badges` | array&lt;object&gt; | (4 项) |
| `users[].badges[].id` | str | `b1` |
| `users[].badges[].name` | str | `神作爱好者` |
| `users[].badges[].type` | str | `神作爱好者` |
| `users[].badges[].value` | str | `10` |
| `users[].recentBooks` | array&lt;str&gt; | (6 项) |

### X (Twitter) (`x`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.x;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `posts` | array | (0 项) |
| `conversations` | array&lt;object&gt; | (1 项) |
| `conversations[].id` | str | `c1` |
| `conversations[].participantId` | str | `u_waylybaye` |
| `conversations[].unreadCount` | int | `1` |
| `conversations[].lastMessageId` | str | `m2` |
| `conversations[].messages` | array&lt;object&gt; | (2 项) |
| `conversations[].messages[].id` | str | `m1` |
| `conversations[].messages[].senderId` | str | `u_xiaoming_dev` |
| `conversations[].messages[].receiverId` | str | `u_waylybaye` |
| `conversations[].messages[].content` | str | `Yo how is ServerCat doing?` |
| `conversations[].messages[].time` | str | `15m` |
| `conversations[].messages[].read` | bool | `True` |
| `followedUserIds` | array&lt;str&gt; | (3 项) |
| `likedPostIds` | array | (0 项) |
| `retweetedPostIds` | array | (0 项) |
| `bookmarkedPostIds` | array | (0 项) |
| `settings` | object |  |
| `settings.showInteractionCounts` | bool | `True` |
| `settings.enablePostSwipeGesture` | bool | `False` |
| `settings.showLocalContent` | bool | `True` |
| `settings.yourTrends` | bool | `True` |
| `settings.markSensitive` | bool | `False` |
| `settings.showListening` | bool | `False` |
| `settings.allowEmail` | bool | `True` |
| `settings.allowPhone` | bool | `True` |
| `settings.syncContacts` | bool | `False` |
| `settings.pushOnlyDm` | bool | `False` |
| `settings.dmRequestFrom` | str | `everyone` |
| `settings.enableAvCalls` | bool | `True` |
| `settings.allowCallFromFollowing` | bool | `True` |
| `settings.allowCallFromLogs` | bool | `False` |
| `settings.allowCallFromVerified` | bool | `False` |
| `settings.alwaysProxyCalls` | bool | `False` |
| `settings.filterLowQualityDMs` | bool | `True` |
| `settings.enableDebugLog` | bool | `False` |
| `settings.privatePosts` | bool | `False` |
| `settings.protectVideos` | bool | `False` |
| `settings.photoTagging` | bool | `True` |
| `settings.useRegion` | bool | `True` |
| `settings.prefRecommend` | bool | `True` |
| `settings.prefFollow` | bool | `True` |
| `settings.prefLiveSpace` | bool | `True` |
| `settings.prefNewsSports` | bool | `True` |
| `settings.fromXFollow` | bool | `True` |
| `settings.fromXNewsSports` | bool | `True` |
| `settings.fromXRecommend` | bool | `True` |
| `settings.fromXMoments` | bool | `True` |
| `settings.fromXLiveSpace` | bool | `True` |
| `settings.fromXOtherLive` | bool | `True` |
| `settings.fromXAlert` | bool | `True` |
| `settings.fromXNewFeatures` | bool | `True` |
| `settings.proNotify` | bool | `True` |
| `settings.onlyImportant` | bool | `False` |
| `settings.hideSuggestions` | bool | `False` |
| `currentSearchQuery` | str |  |
| `pendingQuotedPostId` | NoneType |  |
| `importedUsers` | object |  |
| `importedPosts` | array | (0 项) |
| `_temp` | object |  |
| `_temp.repliesLoaded` | bool | `False` |
| `_temp.repliesLoading` | bool | `False` |
| `user` | object |  |
| `user.id` | str | `u_xiaoming_dev` |
| `user.name` | str | `小明` |
| `user.handle` | str | `@xiaoming_dev` |
| `user.avatar` | str | `https://api.dicebear.com/7.x/avataaars/svg?seed...` |
| `user.banner` | str |  |
| `user.verified` | bool | `False` |
| `user.bio` | str | `独立开发者 \| 记录生活与代码 \| 偶尔摸鱼` |
| `user.location` | str | `北京` |
| `user.website` | str |  |
| `user.joinDate` | str | `Mon Mar 15 08:00:00 +0000 2021` |
| `user.following` | int | `3` |
| `user.followers` | int | `12` |
| `user.screenName` | str | `xiaoming_dev` |
| `users` | object |  |
| `followerUserIds` | array&lt;str&gt; | (12 项) |
| `trends` | array&lt;object&gt; | (13 项) |
| `trends[].id` | str | `t_promo_1` |
| `trends[].title` | str | `Fashion Weeks (Menswear FW26 & Haute Couture SS...` |
| `trends[].category` | str | `LIVE` |
| `trends[].image` | str | `https://pbs.twimg.com/media/GhV3RrObsAAEetk.jpg` |
| `trends[].type` | str | `promoted` |
| `notifications` | array&lt;object&gt; | (7 项) |
| `notifications[].id` | str | `n1` |
| `notifications[].type` | str | `like` |
| `notifications[].actorId` | str | `u_elonmusk` |
| `notifications[].time` | str | `6小时` |
| `notifications[].read` | bool | `False` |
| `notifications[].postId` | str | `p_1879267274185756896` |
| `notifications[].content` | str | `Recent post from Elon Musk Yes!` |
| `recentSearches` | array&lt;object&gt; | (1 项) |
| `recentSearches[].id` | str | `rs1` |
| `recentSearches[].type` | str | `user` |
| `recentSearches[].userId` | str | `u_xiaoming_dev` |

### answer_sheet (`answer_sheet`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.answer_sheet;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `question` | str | `北京和上海，明天哪个城市温差更大？一共有几场会议？哪几天有雨？` |
| `hint` | str | `请根据查询结果填写以下信息` |
| `fields` | array&lt;object&gt; | (3 项) |
| `fields[].type` | str | `choice` |
| `fields[].label` | str | `温差更大的城市` |
| `fields[].options` | array&lt;str&gt; | (3 项) |
| `answers` | object |  |
| `submitted` | bool | `False` |

### 浏览器 (`browser`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.browser;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `tabs` | array&lt;object&gt; | (1 项) |
| `tabs[].id` | str | `1` |
| `tabs[].url` | str |  |
| `tabs[].title` | str | `主页` |
| `activeTabId` | str | `1` |
| `visitedUrls` | array | (0 项) |

### calculator2 (`calculator2`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.calculator2;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `state` | str | `INPUT` |
| `formula` | str |  |
| `result` | str |  |

### calendar (`calendar`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.calendar;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `settings` | object |  |
| `settings.weekStartDay` | str | `monday` |
| `settings.showExtendMonth` | bool | `True` |
| `settings.showWeekNumber` | bool | `False` |
| `settings.showAlmanacYiJi` | bool | `False` |
| `settings.autoInsertAiEvent` | bool | `False` |
| `settings.defaultReminder` | str | `15_minutes_before` |
| `settings.defaultAllDayReminder` | str | `9_am_on_day` |
| `settings.defaultReminderLaterTime` | str | `10_minutes` |
| `settings.holidayReminder` | bool | `True` |
| `settings.showRejectAgenda` | bool | `False` |
| `settings.autoImportBirthday` | bool | `False` |
| `events` | array | (0 项) |
| `selectedDateTs` | int | `1778169600000` |

### compass (`compass`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.compass;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `headingDeg` | int | `256` |
| `levelAngleDeg` | int | `1` |
| `directionText` | str | `西` |
| `latitude` | NoneType |  |
| `longitude` | NoneType |  |

### contacts (`contacts`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.contacts;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `searchHistory` | array | (0 项) |
| `settings` | object |  |
| `settings.device_group` | str | `pref_key_pro_bt` |
| `settings.pref_key_dial_pad_touch_tone` | bool | `True` |
| `settings.pref_key_tone` | str | `-1` |
| `settings.pref_key_smart_group_company` | bool | `True` |
| `settings.pref_key_smart_group_location` | bool | `True` |
| `settings.pref_key_smart_group_frequency` | bool | `True` |
| `settings.pref_key_simple_mode` | bool | `False` |
| `settings.pref_key_word_photo` | bool | `False` |
| `settings.only_phones_v2` | bool | `True` |
| `settings.pref_key_display_sim_contacts` | bool | `True` |
| `settings.pref_key_show_firewall_calllog` | bool | `True` |
| `settings.pref_key_show_business_hall` | bool | `True` |
| `settings.button_turnover_mute` | bool | `False` |
| `settings.button_handon_ringer` | bool | `False` |
| `settings.button_crescendo_ringer` | bool | `True` |
| `settings.button_flash_when_ring` | bool | `False` |
| `settings.button_enable_proximity` | bool | `True` |
| `settings.button_auto_answer` | bool | `False` |
| `settings.button_auto_answer_delay` | str | `3` |
| `settings.button_autoip` | bool | `False` |
| `settings.button_autoip_support_local_numbers` | bool | `False` |
| `settings.button_autoip_add_zero_prefix` | bool | `False` |
| `settings.button_auto_redial` | bool | `False` |
| `settings.button_missed_call_notify_times` | str | `0` |
| `settings.button_connect_disconnect_vibrate` | str | `100` |
| `settings.button_call_waiting_tone` | str | `0` |
| `settings.pref_fold_answer_call` | bool | `False` |
| `settings.pref_unfold_turn_on_speaker` | bool | `False` |
| `settings.pref_unfold_close_camera` | bool | `False` |
| `settings.pref_unfold_show_incall_bubble` | bool | `False` |
| `settings.button_call_recording_notification` | bool | `True` |
| `settings.button_auto_record_call` | bool | `False` |
| `settings.button_auto_record_unknown` | bool | `False` |
| `settings.button_auto_record_yellowpage` | bool | `False` |
| `settings.button_enable_telocation` | bool | `True` |
| `settings.button_auto_country_code` | bool | `True` |
| `settings.perf_sensor_answer` | bool | `False` |
| `settings.button_incoming_call_report` | str | `2` |
| `settings.button_smart_call_forward` | bool | `False` |
| `settings.default_sms_key` | str | `0` |
| `settings.button_call_respond_via_sms` | bool | `True` |
| `settings.canned_response_pref_1` | str | `现在无法接听。有什么事吗？` |
| `settings.canned_response_pref_2` | str | `我马上会打给你。` |
| `settings.canned_response_pref_3` | str | `我稍后会再打给你。` |
| `settings.canned_response_pref_4` | str | `现在无法接听。能稍后再打给我吗？` |

### file_manager (`file_manager`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.file_manager;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `clipboardItems` | array | (0 项) |
| `clipboardOperation` | NoneType |  |

### gallery (`gallery`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.gallery;
```

> 该 App 当前无状态数据

### 备忘录 (`notes`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.notes;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `notes` | array&lt;object&gt; | (5 项) |
| `notes[].id` | str | `xn_1` |
| `notes[].title` | str | `购物清单` |
| `notes[].content` | str | `牛奶 鸡蛋 洗衣液` |
| `notes[].updatedAt` | int | `1770200700000` |
| `notes[].folderId` | str | `unfiled` |
| `todos` | array&lt;object&gt; | (5 项) |
| `todos[].id` | str | `xt_1` |
| `todos[].text` | str | `明天去车站` |
| `todos[].completed` | bool | `False` |
| `todos[].updatedAt` | int | `1770529800000` |
| `folders` | array&lt;object&gt; | (3 项) |
| `folders[].id` | str | `all` |
| `folders[].name` | str | `全部` |
| `folders[].system` | bool | `True` |
| `selectedFolderId` | str | `all` |
| `settings` | object |  |
| `settings.notesViewMode` | str | `grid` |
| `settings.showWordCount` | bool | `True` |

### settings (`settings`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.settings;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `preferences` | object |  |
| `wifi` | object |  |
| `wifi.savedNetworks` | array | (0 项) |
| `_temp` | object |  |
| `_temp.pagesData` | NoneType |  |
| `_temp.pagesLoading` | bool | `False` |
| `_temp.pagesError` | NoneType |  |

### sms (`sms`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.sms;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `settings` | object |  |
| `settings.free_sms_sim1` | bool | `True` |
| `settings.free_sms_sim2` | bool | `True` |
| `settings.5g_message` | bool | `True` |
| `settings.show_avatar` | bool | `True` |
| `settings.text_avatar` | bool | `True` |
| `settings.auto_convert_sms` | bool | `True` |
| `settings.auto_convert_mms` | bool | `False` |
| `settings.block_strangers` | bool | `True` |
| `settings.5g_auto_sms` | bool | `True` |
| `settings.5g_auto_mms` | bool | `False` |
| `settings.5g_read_report` | bool | `False` |
| `settings.wap_push` | bool | `False` |
| `settings.show_preview` | bool | `True` |
| `settings.delivery_report` | bool | `False` |
| `_temp` | object |  |
| `_temp.pendingTimers` | array | (0 项) |

## 使用示例

### JavaScript: 获取状态
```javascript
// 获取完整状态
const state = __SIM__.getState();

// 获取 OS 状态
console.log(state.os.activeAppId);       // 当前 App
console.log(state.os.runningApps);       // 运行中的 App

// 获取微信用户
console.log(state.apps.wechat.user.name);
console.log(state.apps.wechat.user.settings.privacy);
```

### Python (eval_state.py / judger.py)
```python
def check_task(input):
    # input 来自 _build_judge_input()
    route = input["route"]
    apps = input["apps"]
    os_state = input["os"]
    
    # 检查路由
    if route.get("path") != "/settings":
        return False
    
    # 检查微信用户设置
    wechat = apps.get("wechat", {})
    privacy = wechat.get("user", {}).get("settings", {}).get("privacy", {})
    return privacy.get("momentsRange") == "最近三天"
```
