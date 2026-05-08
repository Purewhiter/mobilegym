# App State API 文档

> 自动生成于 2026-01-18，从运行中的服务直接获取 `__SIM__.getState()`

本文档描述 `__SIM__.getState()` 返回的**真实**数据结构。

## OS 状态

```javascript
const os = __SIM__.getState().os;
```

| 路径 | 类型 | 示例 |
|------|------|------|
| `os.activeAppId` | NoneType |  |
| `os.runningApps` | array | (0 项) |
| `os.isLauncherVisible` | bool | `True` |
| `os.isRecentsVisible` | bool | `False` |
| `os.brightness` | int | `80` |
| `os.volume` | int | `50` |
| `os.time` | object |  |
| `os.time.mode` | str | `real` |
| `os.time.timestamp` | int | `1768733194379` |
| `os.time.formatted` | str | `18:46` |
| `os.time.date` | str | `1月18日` |
| `os.time.dayOfWeek` | str | `周日` |
| `os.location` | object |  |
| `os.location.mode` | str | `simulated` |
| `os.location.coords` | object |  |
| `os.location.coords.latitude` | float | `39.9042` |
| `os.location.coords.longitude` | float | `116.4074` |
| `os.location.coords.accuracy` | int | `100` |
| `os.installedApps` | array&lt;object&gt; | (16 项) |
| `os.installedApps[].id` | str | `settings` |
| `os.installedApps[].name` | str | `设置` |
| `os.installedApps[].type` | str | `system` |

## Apps 概览

```javascript
const apps = __SIM__.getState().apps;
```

| App ID | 名称 | 顶层字段 |
|--------|------|----------|
| `notes` | 备忘录 | `notes` |
| `wechat_reading` | 微信读书 | `user, shelf, store, settings` |
| `wechat` | 微信 | `user, contacts, chats, moments, authorizedApps` |
| `x` | X (Twitter) | `user, users, posts, quotedPosts, trends, notifications, conversations, recentSearches` |
| `map` | 地图 | `user, searchHistory` |
| `bilibili` | 哔哩哔哩 | `user` |
| `tencent_meeting` | 腾讯会议 | `user, history, settings` |
| `qqmusic` | QQ音乐 | `currentSong, isPlaying, playList, likedSongs, recentPlays` |
| `redbook` | 小红书 | `user, feed` |

## 各 App 状态字段详情

### 备忘录 (`notes`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.notes;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `notes` | array&lt;object&gt; | (2 项) |
| `notes[].id` | str | `sample_note_1` |
| `notes[].title` | str | `欢迎使用备忘录` |
| `notes[].content` | str | `这是一个简洁的备忘录应用。 您可以： • 创建新笔记 • 编辑和删除笔记 • 查看字数统计 所...` |
| `notes[].updatedAt` | int | `1735005600000` |
| `notes[].wordCount` | int | `0` |

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
| `user.coinBalance` | int | `0` |
| `user.membership` | bool | `False` |
| `user.registrationDate` | str | `2025-12-04` |
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
| `user.badges[].color` | str | `bg-amber-100 text-amber-600` |
| `user.recentBooks` | array&lt;str&gt; | (2 项) |
| `shelf` | array&lt;object&gt; | (4 项) |
| `shelf[].bookId` | str | `60` |
| `shelf[].isPrivate` | bool | `True` |
| `shelf[].addedAt` | str | `2025-12-05T10:00:00` |
| `store` | array&lt;object&gt; | (64 项) |
| `store[].id` | str | `1` |
| `store[].title` | str | `纳瓦尔宝典` |
| `store[].author` | str | `埃里克·乔根森` |
| `store[].cover` | str |  |
| `store[].coverColor` | str | `bg-[#F2EFE9]` |
| `store[].category` | str | `商业` |
| `store[].totalWords` | int | `150000` |
| `store[].rating` | float | `9.2` |
| `store[].recommendedValue` | float | `92.5` |
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
| `settings.requireFollowRequest` | bool | `False` |
| `settings.hideVipGlobal` | bool | `False` |
| `settings.autoPrivateReading` | bool | `False` |
| `settings.shelfReplacement` | bool | `False` |
| `settings.rejectStrangerMsg` | bool | `False` |
| `settings.closePersonalizedRec` | bool | `False` |
| `settings.closeReadingRank` | bool | `False` |
| `settings.profileShowShelf` | bool | `True` |
| `settings.profileShowLiked` | bool | `False` |
| `settings.profileShowLists` | bool | `True` |
| `settings.profileShowBadge` | bool | `True` |
| `settings.profileShowThought` | bool | `True` |
| `settings.profileVisibility` | str | `关注我的人可见` |
| `settings.notifyNewFollower` | bool | `True` |
| `settings.notifyNewWechatFriend` | bool | `True` |
| `settings.notifyActivityWelfare` | bool | `True` |

### 微信 (`wechat`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.wechat;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `user` | object |  |
| `user.wxid` | str | `wxid_w5q69z0jbsuj22` |
| `user.name` | str | `小明` |
| `user.avatar` | str | `/wechat/avatars/avatar_64.jpg` |
| `user.region` | str | `中国大陆 北京` |
| `user.currentLocation` | str | `中国大陆 北京` |
| `user.gender` | str | `男` |
| `user.phone` | str | `17366666695` |
| `user.signature` | str | `这是我的签名` |
| `user.pat` | str |  |
| `user.beans` | int | `0` |
| `user.steps` | int | `599` |
| `user.likes` | int | `0` |
| `user.addresses` | array | (0 项) |
| `user.invoices` | array | (0 项) |
| `user.settings` | object |  |
| `user.settings.security` | object |  |
| `user.settings.security.voiceprint` | bool | `False` |
| `user.settings.modes` | object |  |
| `user.settings.modes.care` | bool | `False` |
| `user.settings.modes.minor` | bool | `False` |
| `user.settings.notifications` | object |  |
| `user.settings.notifications.message` | bool | `True` |
| `user.settings.notifications.voiceVideo` | bool | `True` |
| `user.settings.notifications.displayMode` | str | `full` |
| `user.settings.notifications.notificationSound` | str | `跟随系统` |
| `user.settings.notifications.incomingRingtone` | str | `微信` |
| `user.settings.chat` | object |  |
| `user.settings.chat.speakerMode` | bool | `True` |
| `user.settings.chat.sendButton` | bool | `True` |
| `user.settings.general` | object |  |
| `user.settings.general.darkMode` | bool | `False` |
| `user.settings.general.followSystem` | bool | `True` |
| `user.settings.general.landscape` | bool | `False` |
| `user.settings.general.nfc` | bool | `True` |
| `user.settings.general.autoDownload` | str | `仅Wi-Fi网络` |
| `user.settings.general.translationLanguage` | str | `简体中文` |
| `user.settings.general.autoTranslate` | bool | `False` |
| `user.settings.general.mediaAutoDownload` | bool | `True` |
| `user.settings.general.savePhotos` | bool | `True` |
| `user.settings.general.saveVideos` | bool | `True` |
| `user.settings.general.imageSearch` | bool | `False` |
| `user.settings.general.keepOriginal` | bool | `False` |
| `user.settings.general.mobileAutoPlay` | bool | `True` |
| `user.settings.general.mobileVoiceQuality` | bool | `True` |
| `user.settings.general.personalizedAudio` | bool | `True` |
| `user.settings.general.losslessAudio` | bool | `False` |
| `user.settings.general.showAudioInRecent` | bool | `True` |
| `user.settings.privacy` | object |  |
| `user.settings.privacy.friendConfirmation` | bool | `True` |
| `user.settings.privacy.recommendAddressBook` | bool | `True` |
| `user.settings.privacy.addMeMethods` | object |  |
| `user.settings.privacy.addMeMethods.searchByWxid` | bool | `False` |
| `user.settings.privacy.addMeMethods.searchByPhone` | bool | `True` |
| `user.settings.privacy.addMeMethods.addByGroup` | bool | `True` |
| `user.settings.privacy.addMeMethods.addByQrCode` | bool | `True` |
| `user.settings.privacy.addMeMethods.addByCard` | bool | `True` |
| `user.settings.privacy.addMeMethods.addByOther` | bool | `True` |
| `user.settings.privacy.momentsStrangerTen` | bool | `False` |
| `user.settings.privacy.momentsRange` | str | `最近三天` |
| `user.settings.discover` | object |  |
| `user.settings.discover.moments` | object |  |
| `user.settings.discover.moments.visible` | bool | `True` |
| `user.settings.discover.moments.notify` | bool | `True` |
| `user.settings.discover.channels` | object |  |
| `user.settings.discover.channels.visible` | bool | `True` |
| `user.settings.discover.channels.notify` | bool | `True` |
| `user.settings.discover.live` | object |  |
| `user.settings.discover.live.visible` | bool | `True` |
| `user.settings.discover.live.notify` | bool | `True` |
| `user.settings.discover.scan` | object |  |
| `user.settings.discover.scan.visible` | bool | `True` |
| `user.settings.discover.listen` | object |  |
| `user.settings.discover.listen.visible` | bool | `True` |
| `user.settings.discover.listen.notify` | bool | `True` |
| `user.settings.discover.topStories` | object |  |
| `user.settings.discover.topStories.visible` | bool | `True` |
| `user.settings.discover.topStories.notify` | bool | `True` |
| `user.settings.discover.search` | object |  |
| `user.settings.discover.search.visible` | bool | `True` |
| `user.settings.discover.nearby` | object |  |
| `user.settings.discover.nearby.visible` | bool | `True` |
| `user.settings.discover.nearby.notify` | bool | `True` |
| `user.settings.discover.nearby.showNearbyPeople` | bool | `True` |
| `user.settings.discover.games` | object |  |
| `user.settings.discover.games.visible` | bool | `True` |
| `user.settings.discover.games.notify` | bool | `True` |
| `user.settings.accessibility` | object |  |
| `user.settings.accessibility.tencentNews` | object |  |
| `user.settings.accessibility.tencentNews.enabled` | bool | `True` |
| `user.settings.accessibility.tencentNews.sticky` | bool | `False` |
| `user.settings.accessibility.tencentNews.dnd` | bool | `False` |
| `user.settings.accessibility.broadcast` | object |  |
| `user.settings.accessibility.broadcast.enabled` | bool | `True` |
| `user.settings.accessibility.broadcast.sticky` | bool | `False` |
| `user.settings.accessibility.broadcast.dnd` | bool | `False` |
| `user.settings.accessibility.qqMail` | object |  |
| `user.settings.accessibility.qqMail.enabled` | bool | `False` |
| `user.settings.accessibility.wechatSports` | object |  |
| `user.settings.accessibility.wechatSports.enabled` | bool | `True` |
| `user.settings.accessibility.wechatSports.sticky` | bool | `False` |
| `user.settings.accessibility.wechatSports.dnd` | bool | `False` |
| `user.settings.accessibility.wechatSports.joinLeaderboard` | bool | `True` |
| `user.settings.accessibility.wechatSports.recvLeaderboardMsg` | bool | `True` |
| `user.settings.accessibility.wechatSports.recvLikeMsg` | bool | `True` |
| `user.settings.accessibility.wechatPay` | object |  |
| `user.settings.accessibility.wechatPay.enabled` | bool | `False` |
| `user.settings.accessibility.wechatGames` | object |  |
| `user.settings.accessibility.wechatGames.enabled` | bool | `False` |
| `contacts` | array&lt;object&gt; | (11 项) |
| `contacts[].wxid` | str | `wxid_blank_001` |
| `contacts[].name` | str | `blank.` |
| `contacts[].avatar` | str | `/wechat/avatars/avatar_65.jpg` |
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
| `chats` | array&lt;object&gt; | (3 项) |
| `chats[].id` | str | `wxid_blank_001` |
| `chats[].user` | object |  |
| `chats[].user.wxid` | str | `wxid_blank_001` |
| `chats[].user.name` | str | `blank.` |
| `chats[].user.avatar` | str | `/wechat/avatars/avatar_65.jpg` |
| `chats[].isMuted` | bool | `False` |
| `chats[].isSticky` | bool | `False` |
| `chats[].isAlert` | bool | `False` |
| `chats[].messages` | array&lt;object&gt; | (4 项) |
| `chats[].messages[].id` | str | `m1` |
| `chats[].messages[].type` | str | `time` |
| `chats[].messages[].content` | str | `17:46` |
| `chats[].messages[].senderId` | str | `system` |
| `chats[].messages[].timestamp` | int | `1768729594254` |
| `moments` | array&lt;object&gt; | (4 项) |
| `moments[].id` | str | `mo1` |
| `moments[].wxid` | str | `wxid_w5q69z0jbsuj22` |
| `moments[].userName` | str | `小明` |
| `moments[].userAvatar` | str | `/wechat/avatars/avatar_64.jpg` |
| `moments[].content` | str | `你好` |
| `moments[].timestamp` | int | `1768733074254` |
| `authorizedApps` | array&lt;object&gt; | (3 项) |
| `authorizedApps[].id` | str | `meeting` |
| `authorizedApps[].name` | str | `腾讯会议` |
| `authorizedApps[].icon` | str | `/wechat/icons/meeting.png` |
| `authorizedApps[].type` | str | `移动应用` |
| `authorizedApps[].permissions` | array&lt;str&gt; | (1 项) |

### X (Twitter) (`x`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.x;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `user` | object |  |
| `user.id` | str | `u_me` |
| `user.name` | str | `yihong0618` |
| `user.handle` | str | `@yihong0618` |
| `user.avatar` | str | `https://pbs.twimg.com/profile_images/1209446924...` |
| `user.banner` | str | `https://pbs.twimg.com/profile_banners/101764862...` |
| `user.verified` | bool | `False` |
| `user.bio` | str | `喜欢王小波，大概我们能成为朋友。` |
| `user.location` | str | `Internet` |
| `user.joinDate` | str | `2018年7月` |
| `user.following` | int | `3284` |
| `user.followers` | int | `70328` |
| `users` | object |  |
| `users.u_me` | object |  |
| `users.u_me.id` | str | `u_me` |
| `users.u_me.name` | str | `yihong0618` |
| `users.u_me.handle` | str | `@yihong0618` |
| `users.u_me.avatar` | str | `https://pbs.twimg.com/profile_images/1209446924...` |
| `users.u_me.banner` | str | `https://pbs.twimg.com/profile_banners/101764862...` |
| `users.u_me.verified` | bool | `False` |
| `users.u_me.bio` | str | `喜欢王小波，大概我们能成为朋友。` |
| `users.u_me.location` | str | `Internet` |
| `users.u_me.joinDate` | str | `2018年7月` |
| `users.u_me.following` | int | `3284` |
| `users.u_me.followers` | int | `70328` |
| `users.u_openai` | object |  |
| `users.u_openai.id` | str | `u_openai` |
| `users.u_openai.name` | str | `OpenAI` |
| `users.u_openai.handle` | str | `@OpenAI` |
| `users.u_openai.avatar` | str | `https://pbs.twimg.com/profile_images/1634058036...` |
| `users.u_openai.verified` | bool | `True` |
| `users.u_openai.bio` | str | `AI research and deployment company.` |
| `users.u_openai.following` | int | `12` |
| `users.u_openai.followers` | int | `18900000` |
| `users.u_elon` | object |  |
| `users.u_elon.id` | str | `u_elon` |
| `users.u_elon.name` | str | `Elon Musk` |
| `users.u_elon.handle` | str | `@elonmusk` |
| `users.u_elon.avatar` | str | `https://pbs.twimg.com/profile_images/1870511184...` |
| `users.u_elon.verified` | bool | `True` |
| `users.u_elon.bio` | str |  |
| `users.u_elon.following` | int | `567` |
| `users.u_elon.followers` | int | `172000000` |
| `users.u_maimai` | object |  |
| `users.u_maimai.id` | str | `u_maimai` |
| `users.u_maimai.name` | str | `李麦麦` |
| `users.u_maimai.handle` | str | `@MaimaiLee123` |
| `users.u_maimai.avatar` | str | `https://pbs.twimg.com/profile_images/1863951770...` |
| `users.u_maimai.verified` | bool | `False` |
| `users.u_maimai.following` | int | `120` |
| `users.u_maimai.followers` | int | `5430` |
| `users.u_wang` | object |  |
| `users.u_wang.id` | str | `u_wang` |
| `users.u_wang.name` | str | `金融汪` |
| `users.u_wang.handle` | str | `@yuyy614893671` |
| `users.u_wang.avatar` | str | `https://pbs.twimg.com/profile_images/1832901799...` |
| `users.u_wang.verified` | bool | `True` |
| `users.u_wang.following` | int | `450` |
| `users.u_wang.followers` | int | `89000` |
| `users.u_xiong` | object |  |
| `users.u_xiong.id` | str | `u_xiong` |
| `users.u_xiong.name` | str | `Spring Xiong 熊春` |
| `users.u_xiong.handle` | str | `@xiongchun007` |
| `users.u_xiong.avatar` | str | `https://pbs.twimg.com/profile_images/1850515744...` |
| `users.u_xiong.verified` | bool | `False` |
| `users.u_xiong.following` | int | `340` |
| `users.u_xiong.followers` | int | `12000` |
| `users.u_skywind` | object |  |
| `users.u_skywind.id` | str | `u_skywind` |
| `users.u_skywind.name` | str | `LIN WEI` |
| `users.u_skywind.handle` | str | `@skywind3000` |
| `users.u_skywind.avatar` | str | `https://pbs.twimg.com/profile_images/7864857884...` |
| `users.u_skywind.verified` | bool | `False` |
| `users.u_skywind.following` | int | `120` |
| `users.u_skywind.followers` | int | `34000` |
| `users.u_baye` | object |  |
| `users.u_baye.id` | str | `u_baye` |
| `users.u_baye.name` | str | `Baye` |
| `users.u_baye.handle` | str | `@waylybaye` |
| `users.u_baye.avatar` | str | `https://pbs.twimg.com/profile_images/1807439424...` |
| `users.u_baye.verified` | bool | `True` |
| `users.u_baye.bio` | str | `Independent Developer. Creator of ServerCat.` |
| `users.u_baye.following` | int | `450` |
| `users.u_baye.followers` | int | `56000` |
| `users.u_yihui` | object |  |
| `users.u_yihui.id` | str | `u_yihui` |
| `users.u_yihui.name` | str | `熠辉 Indie` |
| `users.u_yihui.handle` | str | `@yihui_indie` |
| `users.u_yihui.avatar` | str | `https://pbs.twimg.com/profile_images/1804848821...` |
| `users.u_yihui.verified` | bool | `False` |
| `users.u_yihui.following` | int | `230` |
| `users.u_yihui.followers` | int | `8900` |
| `users.u_plusyip` | object |  |
| `users.u_plusyip.id` | str | `u_plusyip` |
| `users.u_plusyip.name` | str | `Plusye` |
| `users.u_plusyip.handle` | str | `@plusyip` |
| `users.u_plusyip.avatar` | str | `https://pbs.twimg.com/profile_images/1718597108...` |
| `users.u_plusyip.verified` | bool | `False` |
| `users.u_plusyip.following` | int | `120` |
| `users.u_plusyip.followers` | int | `3400` |
| `users.u_nate` | object |  |
| `users.u_nate.id` | str | `u_nate` |
| `users.u_nate.name` | str | `李自然 Nate Lee` |
| `users.u_nate.handle` | str | `@nateleex` |
| `users.u_nate.avatar` | str | `https://pbs.twimg.com/profile_images/1727019827...` |
| `users.u_nate.verified` | bool | `True` |
| `users.u_nate.following` | int | `560` |
| `users.u_nate.followers` | int | `120000` |
| `users.u_doge` | object |  |
| `users.u_doge.id` | str | `u_doge` |
| `users.u_doge.name` | str | `DogeDesigner` |
| `users.u_doge.handle` | str | `@cb_doge` |
| `users.u_doge.avatar` | str | `https://pbs.twimg.com/profile_images/1718597108...` |
| `users.u_doge.verified` | bool | `True` |
| `users.u_doge.following` | int | `120` |
| `users.u_doge.followers` | int | `890000` |
| `users.u_william` | object |  |
| `users.u_william.id` | str | `u_william` |
| `users.u_william.name` | str | `William Meijer` |
| `users.u_william.handle` | str | `@williameijer` |
| `users.u_william.avatar` | str |  |
| `users.u_william.verified` | bool | `True` |
| `users.u_william.following` | int | `100` |
| `users.u_william.followers` | int | `2000` |
| `users.u_ian` | object |  |
| `users.u_ian.id` | str | `u_ian` |
| `users.u_ian.name` | str | `Ian Miles Cheong` |
| `users.u_ian.handle` | str | `@stillgray` |
| `users.u_ian.avatar` | str | `https://api.dicebear.com/7.x/avataaars/svg?seed...` |
| `users.u_ian.verified` | bool | `True` |
| `users.u_ian.following` | int | `120` |
| `users.u_ian.followers` | int | `560000` |
| `users.u_lidang` | object |  |
| `users.u_lidang.id` | str | `u_lidang` |
| `users.u_lidang.name` | str | `lidang 立党` |
| `users.u_lidang.handle` | str | `@lidangzzz` |
| `users.u_lidang.avatar` | str | `https://api.dicebear.com/7.x/avataaars/svg?seed...` |
| `users.u_lidang.verified` | bool | `True` |
| `users.u_lidang.following` | int | `450` |
| `users.u_lidang.followers` | int | `340000` |
| `users.u_slatt` | object |  |
| `users.u_slatt.id` | str | `u_slatt` |
| `users.u_slatt.name` | str | `Slatt` |
| `users.u_slatt.handle` | str | `@slatt` |
| `users.u_slatt.avatar` | str | `https://pbs.twimg.com/profile_images/1727019827...` |
| `users.u_slatt.verified` | bool | `False` |
| `users.u_slatt.following` | int | `120` |
| `users.u_slatt.followers` | int | `3400` |
| `users.u_pleb` | object |  |
| `users.u_pleb.id` | str | `u_pleb` |
| `users.u_pleb.name` | str | `Pleb` |
| `users.u_pleb.handle` | str | `@pleb` |
| `users.u_pleb.avatar` | str | `https://pbs.twimg.com/profile_images/1718597108...` |
| `users.u_pleb.verified` | bool | `False` |
| `users.u_pleb.following` | int | `120` |
| `users.u_pleb.followers` | int | `3400` |
| `users.u_viking` | object |  |
| `users.u_viking.id` | str | `u_viking` |
| `users.u_viking.name` | str | `Viking` |
| `users.u_viking.handle` | str | `@vikingmute` |
| `users.u_viking.avatar` | str | `https://pbs.twimg.com/profile_images/7251792085...` |
| `users.u_viking.verified` | bool | `False` |
| `users.u_viking.following` | int | `230` |
| `users.u_viking.followers` | int | `8900` |
| `users.u_turingou` | object |  |
| `users.u_turingou.id` | str | `u_turingou` |
| `users.u_turingou.name` | str | `郭宇 guoyu.eth` |
| `users.u_turingou.handle` | str | `@turingou` |
| `users.u_turingou.avatar` | str | `https://pbs.twimg.com/profile_images/1870511184...` |
| `users.u_turingou.verified` | bool | `False` |
| `users.u_turingou.following` | int | `450` |
| `users.u_turingou.followers` | int | `56000` |
| `posts` | array&lt;object&gt; | (16 项) |
| `posts[].id` | str | `p_openai` |
| `posts[].authorId` | str | `u_openai` |
| `posts[].content` | str | `Today we’re rolling out a beta version of tasks...` |
| `posts[].time` | str | `1h` |
| `posts[].image` | str | `https://pbs.twimg.com/media/GhV3RrObsAAEetk.jpg` |
| `posts[].stats` | object |  |
| `posts[].stats.comments` | int | `542` |
| `posts[].stats.retweets` | int | `1200` |
| `posts[].stats.likes` | int | `8500` |
| `posts[].stats.views` | int | `500000` |
| `quotedPosts` | object |  |
| `quotedPosts.p_william_quote` | object |  |
| `quotedPosts.p_william_quote.id` | str | `p_william_quote` |
| `quotedPosts.p_william_quote.authorId` | str | `u_william` |
| `quotedPosts.p_william_quote.content` | str | `Open borders would mean the end of the West bec...` |
| `quotedPosts.p_william_quote.time` | str | `1d` |
| `quotedPosts.p_william_quote.stats` | object |  |
| `quotedPosts.p_william_quote.stats.comments` | int | `0` |
| `quotedPosts.p_william_quote.stats.retweets` | int | `0` |
| `quotedPosts.p_william_quote.stats.likes` | int | `0` |
| `quotedPosts.p_william_quote.stats.views` | int | `0` |
| `trends` | array&lt;object&gt; | (13 项) |
| `trends[].id` | str | `t_promo_1` |
| `trends[].title` | str | `Fashion Weeks (Menswear FW26 & Haute Couture SS...` |
| `trends[].category` | str | `LIVE` |
| `trends[].image` | str | `https://pbs.twimg.com/media/GhV3RrObsAAEetk.jpg` |
| `trends[].type` | str | `promoted` |
| `notifications` | array&lt;object&gt; | (7 项) |
| `notifications[].id` | str | `n1` |
| `notifications[].type` | str | `like` |
| `notifications[].actorId` | str | `u_elon` |
| `notifications[].time` | str | `6小时` |
| `notifications[].read` | bool | `False` |
| `notifications[].postId` | str | `p_openai` |
| `notifications[].content` | str | `Recent post from Elon Musk Yes!` |
| `conversations` | array&lt;object&gt; | (1 项) |
| `conversations[].id` | str | `c1` |
| `conversations[].participantId` | str | `u_baye` |
| `conversations[].unreadCount` | int | `1` |
| `conversations[].lastMessageId` | str | `m2` |
| `conversations[].messages` | array&lt;object&gt; | (2 项) |
| `conversations[].messages[].id` | str | `m1` |
| `conversations[].messages[].senderId` | str | `u_me` |
| `conversations[].messages[].receiverId` | str | `u_baye` |
| `conversations[].messages[].content` | str | `Yo how is ServerCat doing?` |
| `conversations[].messages[].time` | str | `15m` |
| `conversations[].messages[].read` | bool | `True` |
| `recentSearches` | array&lt;object&gt; | (1 项) |
| `recentSearches[].id` | str | `rs1` |
| `recentSearches[].type` | str | `user` |
| `recentSearches[].userId` | str | `u_me` |

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
| `searchHistory[].text` | str | `故宫` |

### 哔哩哔哩 (`bilibili`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.bilibili;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `user` | object |  |
| `user.name` | str | `xiaoming-ai` |
| `user.level` | int | `0` |
| `user.avatar` | str | `https://api.dicebear.com/7.x/avataaars/svg?seed...` |
| `user.bCoins` | int | `0` |
| `user.coins` | int | `1240` |
| `user.following` | int | `0` |
| `user.followers` | int | `0` |
| `user.dynamic` | int | `0` |
| `user.isVip` | bool | `True` |
| `user.sex` | str | `保密` |
| `user.birthday` | str |  |
| `user.sign` | str | `这是我的签名` |
| `user.school` | str | `中国科学院大学` |
| `user.ipLocation` | str | `北京` |
| `user.uid` | str | `3690981958355888` |
| `user.followingIds` | array | (0 项) |
| `user.followingList` | array&lt;object&gt; | (2 项) |
| `user.followingList[].mid` | str | `316568752` |
| `user.followingList[].name` | str | `马督工` |
| `user.followersList` | array&lt;object&gt; | (1 项) |
| `user.followersList[].mid` | str | `10001` |
| `user.followersList[].name` | str | `小粉丝A` |
| `user.followersList[].face` | str | `https://api.dicebear.com/7.x/avataaars/svg?seed...` |
| `user.followersList[].sign` | str | `求互粉` |
| `user.followersList[].isVip` | bool | `False` |
| `user.likedVideoIds` | array&lt;str&gt; | (1 项) |
| `user.dislikedVideoIds` | array | (0 项) |
| `user.coinedVideoIds` | array | (0 项) |
| `user.favoritesFolders` | array&lt;object&gt; | (2 项) |
| `user.favoritesFolders[].id` | str | `fav_default` |
| `user.favoritesFolders[].title` | str | `默认收藏夹` |
| `user.favoritesFolders[].isPublic` | bool | `True` |
| `user.favoritesFolders[].videoIds` | array&lt;str&gt; | (1 项) |
| `user.subscribedAnime` | array&lt;object&gt; | (2 项) |
| `user.subscribedAnime[].id` | str | `28747` |
| `user.subscribedAnime[].title` | str | `凡人修仙传` |
| `user.subscribedDramas` | array | (0 项) |
| `user.searchHistory` | array&lt;str&gt; | (2 项) |

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
| `history` | array | (0 项) |
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

### QQ音乐 (`qqmusic`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.qqmusic;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `currentSong` | NoneType |  |
| `isPlaying` | bool | `False` |
| `playList` | array | (0 项) |
| `likedSongs` | array | (0 项) |
| `recentPlays` | array | (0 项) |

### 小红书 (`redbook`)

**访问方式**:
```javascript
const state = __SIM__.getState().apps.redbook;
```

**字段结构**:

| 路径 | 类型 | 示例/数量 |
|------|------|----------|
| `user` | object |  |
| `user.id` | str | `user_001` |
| `user.name` | str | `小红薯9393685` |
| `user.avatar` | str | `/apps/RedBook/assets/my/mine_def_touxiang_3x.png` |
| `user.userCover` | str | `/apps/RedBook/assets/my/mine_bg_3x.png` |
| `user.following` | int | `4` |
| `user.followers` | int | `108` |
| `user.likesAndCollections` | int | `326` |
| `user.intro` | str | `一只野生程序猿存档 🌟 喜欢摄影 \| 旅行 \| 美食 记录生活中的小美好 ✨` |
| `user.location` | str | `上海` |
| `user.address` | str | `上海` |
| `user.gender` | str | `Female` |
| `user.age` | str | `24` |
| `user.isFollowed` | bool | `False` |
| `feed` | array&lt;object&gt; | (8 项) |
| `feed[].id` | str | `note_0` |
| `feed[].title` | str | `今天的穿搭分享 ✨` |
| `feed[].content` | str | `这套黑色系真的太爱了！简约大气又显瘦，姐妹们可以试试看～ 上衣：H&M 基础款 裤子：Zara...` |
| `feed[].author` | object |  |
| `feed[].author.id` | str | `user_001` |
| `feed[].author.name` | str | `小红薯9393685` |
| `feed[].author.avatar` | str | `/apps/RedBook/assets/my/mine_def_touxiang_3x.png` |
| `feed[].images` | array&lt;str&gt; | (2 项) |
| `feed[].likes` | int | `0` |
| `feed[].isLiked` | bool | `False` |
| `feed[].collections` | int | `0` |
| `feed[].isCollected` | bool | `False` |
| `feed[].comments` | int | `0` |
| `feed[].commentList` | array | (0 项) |
| `feed[].createdAt` | int | `1703844000000` |
| `feed[].category` | str | `穿搭` |

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
