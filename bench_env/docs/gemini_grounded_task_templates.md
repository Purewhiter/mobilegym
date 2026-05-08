# Gemini grounded cross-app task templates

本文档记录一批基于 `runs/gemini_grounded_loop_detect_10_1/20260415_103348` 真实失败轨迹归纳出的跨 APP 任务模板。这里的重点不是把任务写复杂，而是复用 Gemini 已经暴露出的稳定错误模式：截断标题直接搬运、封面/标题层级混淆、长列表不完整遍历、列表摘要字段误当详情字段、同名入口混淆、条件边界误判、动作完成后不验证。

使用约定：

- `Template` 是实际给 agent 的用户指令模板，不应加入“不要看首页”“不要按封面”“不要复制省略号”这类提示。
- `Params` 是任务类可采样的参数。
- `Design note` 只用于 fixture / judge 设计，不进入 prompt。
- 下表是设计池，不代表全部都应一次性实现。优先实现 Redbook、TencentMeeting、SMS、Alipay、Bilibili 里 judge 证据最干净的一批。

## Redbook

| ID | ClassName | Template | Params | Design note |
|---:|---|---|---|---|
| 1 | `RedbookSearchTitleToWechat` | 在小红书搜索“{query}”，把第 {rank} 篇笔记的标题发给微信联系人“{contact}”。 | `query`, `rank`, `contact` | 目标标题在列表页截断或含特殊符号，judge 按详情页标题判。 |
| 2 | `RedbookSearchTitleToNotes` | 在小红书搜索“{query}”，把第 {rank} 篇笔记的标题写到备忘录。 | `query`, `rank` | 同上，验证 notes 内容。 |
| 3 | `RedbookTopLikedTitlesToNotes` | 在小红书搜索“{query}”，按最多点赞排序，把前 {count} 篇笔记的标题写到备忘录。 | `query`, `count` | 列表标题可见但不完整，要求多项信息迁移。 |
| 4 | `RedbookUserNoteCountToWechat` | 查看小红书用户“{user}”发布了多少篇笔记，把数量发给微信联系人“{contact}”。 | `user`, `contact` | 用户主页需要滚动计数；避免 UI 里直接有可靠总数时过浅。 |
| 5 | `RedbookUserLatestTitleToSms` | 查看小红书用户“{user}”最新发布的笔记，把标题短信发给“{contact}”。 | `user`, `contact` | 最新笔记标题在卡片上截断。 |
| 6 | `RedbookUserTopLikedToWechat` | 查看小红书用户“{user}”点赞数最高的笔记，把标题和点赞数发给微信联系人“{contact}”。 | `user`, `contact` | 需要完整遍历用户主页并比较点赞数。 |
| 7 | `RedbookSearchAuthorToWechat` | 在小红书搜索“{query}”，把第 {rank} 篇笔记的作者名发给微信联系人“{contact}”。 | `query`, `rank`, `contact` | 干扰项作者/标题位置相近，检查是否点进目标卡片。 |
| 8 | `RedbookSearchCollectAndReport` | 在小红书搜索“{query}”，收藏第 {rank} 篇笔记，并把作者名发给微信联系人“{contact}”。 | `query`, `rank`, `contact` | 操作 + 汇报双证据，防止只发消息未收藏。 |
| 9 | `RedbookSearchCommentThenSms` | 在小红书搜索“{query}”，给第 {rank} 篇笔记评论“{comment}”，然后短信告诉“{contact}”这篇笔记的作者名。 | `query`, `rank`, `comment`, `contact` | 评论目标和汇报作者必须来自同一篇笔记。 |
| 10 | `RedbookKeywordTitleToWechat` | 在小红书搜索“{query}”，找到标题里包含“{keyword}”的笔记，把作者名发给微信联系人“{contact}”。 | `query`, `keyword`, `contact` | 数据里放封面含 keyword 但标题不含的干扰项。 |
| 11 | `RedbookKeywordTitleCollectToNotes` | 在小红书搜索“{query}”，收藏标题里包含“{keyword}”的笔记，并把标题写到备忘录。 | `query`, `keyword` | 同时验证收藏 note id 和 notes 标题。 |
| 12 | `RedbookFollowingUserCountToSms` | 在小红书关注列表里找到“{user}”，查看他发布的笔记数量，并短信发给“{contact}”。 | `user`, `contact` | 关注列表定位 + 用户主页计数。 |
| 13 | `RedbookFollowingUserTopLikedToWechat` | 在小红书关注列表里找到“{user}”，把他点赞最多的笔记标题发给微信联系人“{contact}”。 | `user`, `contact` | 主页内比较点赞数，最高赞放在非首屏。 |
| 14 | `RedbookSearchTwoTitlesToWechat` | 在小红书搜索“{query}”，把第 {rank_a} 篇和第 {rank_b} 篇笔记标题发给微信联系人“{contact}”。 | `query`, `rank_a`, `rank_b`, `contact` | 多项标题迁移，至少一项截断。 |
| 15 | `RedbookSearchTitleAndLikesToNotes` | 在小红书搜索“{query}”，把第 {rank} 篇笔记的标题和点赞数写到备忘录。 | `query`, `rank` | 标题和点赞数来自不同视觉区域，容易漏项。 |

## Spotify

| ID | ClassName | Template | Params | Design note |
|---:|---|---|---|---|
| 16 | `SpotifyRecentArtistSongToWechat` | 在 Spotify 最近播放里找歌手“{artist}”的歌，把歌名发给微信联系人“{contact}”。 | `artist`, `contact` | 首页推荐区不要包含该歌手，最近播放里包含。 |
| 17 | `SpotifyRecentNthToRedbook` | 把 Spotify 最近播放里第 {rank} 首歌的歌名和歌手发布到小红书。 | `rank` | 明确数据层的 rank 语义，fixture 中保持 UI 顺序可判定。 |
| 18 | `SpotifyRecentNthToNotes` | 把 Spotify 最近播放里第 {rank} 首歌的歌名、歌手和专辑写到备忘录。 | `rank` | 需要打开详情或更多信息获取专辑。 |
| 19 | `SpotifyRecentArtistAllToWechat` | 把 Spotify 最近播放里所有“{artist}”的歌名发给微信联系人“{contact}”。 | `artist`, `contact` | 同一歌手多首，至少一首在非首屏。 |
| 20 | `SpotifyPlaylistArtistMoveReport` | 把 Spotify 歌单“{source_playlist}”里歌手“{artist}”的歌移动到新歌单“{target_playlist}”，并微信告诉“{contact}”移动了几首。 | `source_playlist`, `artist`, `target_playlist`, `contact` | judge 检查目标歌单新增和源歌单移除。 |
| 21 | `SpotifyLikedArtistMoveToNotes` | 把 Spotify 已点赞歌曲里歌手“{artist}”的歌移动到歌单“{target_playlist}”，并把移动的歌名写到备忘录。 | `artist`, `target_playlist` | 移动不是复制；检查 liked 中已移除。 |
| 22 | `SpotifyPlaylistNthSongToSms` | 打开 Spotify 歌单“{playlist}”，把第 {rank} 首歌的歌名短信发给“{contact}”。 | `playlist`, `rank`, `contact` | rank 放在需要滚动的位置。 |
| 23 | `SpotifyArtistTopSongsToRedbook` | 搜索 Spotify 歌手“{artist}”，把前 {count} 首热门歌曲发布到小红书。 | `artist`, `count` | 搜索作者而非歌名，验证热门歌曲列表。 |
| 24 | `SpotifySongAlbumToWechat` | 在 Spotify 找到歌曲“{song}”，把它的专辑名发给微信联系人“{contact}”。 | `song`, `contact` | 列表页通常没有专辑字段。 |

## Tencent Meeting

| ID | ClassName | Template | Params | Design note |
|---:|---|---|---|---|
| 25 | `TencentMeetingLongestToWechat` | 在腾讯会议历史会议里找时长最长的会议，把会议名称和时长发给微信联系人“{contact}”。 | `contact` | 最长会议放在非首屏。 |
| 26 | `TencentMeetingParticipantsToNotes` | 打开腾讯会议历史会议“{meeting}”，把参会人数写到备忘录。 | `meeting` | 人数以详情页为准，避免凭列表记忆。 |
| 27 | `TencentMeetingDateLongestToSms` | 在腾讯会议 {date} 的历史会议里找时长最长的会议，把会议名称短信发给“{contact}”。 | `date`, `contact` | 日期过滤 + 滚动比较。 |
| 28 | `TencentMeetingHostToWechat` | 打开腾讯会议历史会议“{meeting}”，把主持人名字发给微信联系人“{contact}”。 | `meeting`, `contact` | 主持人在详情页，不在列表摘要。 |
| 29 | `TencentMeetingCountByKeywordToNotes` | 统计腾讯会议历史记录里名称包含“{keyword}”的会议数量，写到备忘录。 | `keyword` | 需要遍历历史记录，多个同系列会议分布在不同位置。 |

## SMS

| ID | ClassName | Template | Params | Design note |
|---:|---|---|---|---|
| 30 | `SmsConversationCountToWechat` | 比较短信里“{sender_a}”和“{sender_b}”两个会话的消息条数，把消息更多的发送方发给微信联系人“{contact}”。 | `sender_a`, `sender_b`, `contact` | 未读角标与会话消息总数故意不同。 |
| 31 | `SmsUnreadCountToNotes` | 统计短信里未读会话数量，并写到备忘录。 | none | 未读会话分布在列表非首屏。 |
| 32 | `SmsLatestContentToWechat` | 把短信里来自“{sender}”的最新一条消息内容发给微信联系人“{contact}”。 | `sender`, `contact` | 需要进入会话确认最新完整内容。 |
| 33 | `SmsKeywordSenderToWechat` | 在短信里找到包含“{keyword}”的最新消息，把发送方和内容发给微信联系人“{contact}”。 | `keyword`, `contact` | 多个会话含 keyword，取最新。 |
| 34 | `SmsConversationLastTwoToNotes` | 把短信会话“{sender}”里最新两条消息内容写到备忘录。 | `sender` | 需要区分自己发送和对方发送的消息顺序。 |

## Alipay

| ID | ClassName | Template | Params | Design note |
|---:|---|---|---|---|
| 35 | `AlipayTransferCountToWechat` | 在支付宝账单里统计“转账”记录数量，把数量发给微信联系人“{contact}”。 | `contact` | 转账记录超过首屏，需要滚到底并去重。 |
| 36 | `AlipayLargestCounterpartyToNotes` | 在支付宝账单里找累计金额最大的交易对象，把对象名和金额写到备忘录。 | none | 累计最大不等于单笔最大，也不等于当前页排行第一。 |
| 37 | `AlipayMonthExpenseCompareToWechat` | 比较支付宝 {month_a} 和 {month_b} 的支出金额，把较高的月份和金额发给微信联系人“{contact}”。 | `month_a`, `month_b`, `contact` | 月份选择器需要确认落点。 |
| 38 | `AlipayKeywordBillCountToSms` | 在支付宝账单里搜索“{keyword}”，统计记录数量，短信发给“{contact}”。 | `keyword`, `contact` | 搜索结果多页，容易提前停止。 |
| 39 | `AlipayCategoryTotalToNotes` | 统计支付宝账单里“{category}”分类的总金额，写到备忘录。 | `category` | 分类累计，需要跨多条账单求和。 |
| 40 | `AlipayUnreadFriendMessagesToWechat` | 统计支付宝消息里好友未读消息总数，把数量发给微信联系人“{contact}”。 | `contact` | 首屏未读数不是总数。 |

## Bilibili

| ID | ClassName | Template | Params | Design note |
|---:|---|---|---|---|
| 41 | `BilibiliRankingCategoryTopToWechat` | 打开 B 站排行榜“{category}”分区，把第 {rank} 名标题发给微信联系人“{contact}”。 | `category`, `rank`, `contact` | 首页/追番等区域放同名榜单干扰。 |
| 42 | `BilibiliRankingTitleToNotes` | 打开 B 站排行榜“{category}”分区，把第 {rank} 名视频标题写到备忘录。 | `category`, `rank` | 标题可能在列表截断。 |
| 43 | `BilibiliTripleActionToMoments` | 在 B 站找到视频“{video}”，完成点赞、投币、收藏，然后发朋友圈“{message}”。 | `video`, `message` | judge 分别检查 liked/coined/favored。 |
| 44 | `BilibiliFavCountToWechat` | 收藏 B 站排行榜“{category}”第 {rank} 名视频后，把默认收藏夹内容数量发给微信联系人“{contact}”。 | `category`, `rank`, `contact` | 收藏操作后读收藏夹数量。 |
| 45 | `BilibiliVideoAuthorToSms` | 打开 B 站视频“{video}”，把作者名短信发给“{contact}”。 | `video`, `contact` | 列表中标题/作者区域相邻。 |
| 46 | `BilibiliSearchTitleToWechat` | 在 B 站搜索“{query}”，把第 {rank} 个视频的标题发给微信联系人“{contact}”。 | `query`, `rank`, `contact` | 详情页标题为准，列表可截断。 |
| 47 | `BilibiliFollowUpAndReport` | 在 B 站推荐 UP 里关注“{up_name}”，然后微信告诉“{contact}”已关注。 | `up_name`, `contact` | 推荐 UP 区和视频作者区做干扰。 |
| 48 | `BilibiliAnimeSubscribeToNotes` | 在 B 站追番“{anime}”，并把番剧名写到备忘录。 | `anime` | judge 检查追番状态，避免只写 notes。 |

## Map

| ID | ClassName | Template | Params | Design note |
|---:|---|---|---|---|
| 49 | `MapDrivingCostToNotes` | 用地图查从当前位置开车到“{place}”的距离，按每公里 {rate} 元计算费用，把地点和费用写到备忘录。 | `place`, `rate` | judge 使用路线页驾车距离；POI 卡片距离作为干扰。 |
| 50 | `MapBestRatedPlaceToWechat` | 用地图在“{query}”结果里找评分最高的地点，把地点名和评分发给微信联系人“{contact}”。 | `query`, `contact` | 首屏可见结果不是全局最高评分。 |
| 51 | `MapPlaceAddressToSms` | 用地图搜索“{place}”，把它的完整地址短信发给“{contact}”。 | `place`, `contact` | 需要进入目标详情页，列表标题可能是泛名。 |
| 52 | `MapRouteSummaryToNotes` | 用地图规划到“{place}”的驾车路线，把预计距离和时间写到备忘录。 | `place` | 路线概览字段和地点卡片字段不同。 |

## Railway 12306

| ID | ClassName | Template | Params | Design note |
|---:|---|---|---|---|
| 53 | `RailwayGTrainToWechat` | 在铁路 12306 查询 {from_city} 到 {to_city} 的 {date} 车票，把最早一趟 G 字头车次发给微信联系人“{contact}”。 | `from_city`, `to_city`, `date`, `contact` | 明确 G 字头，避免 C/D 车作为高铁语义争议。 |
| 54 | `RailwaySeatAvailableToSms` | 在铁路 12306 查询 {date} 从 {from_city} 到 {to_city} 的 G 字头车，把最晚一趟有“{seat_type}”的车次短信发给“{contact}”。 | `from_city`, `to_city`, `date`, `seat_type`, `contact` | 席别筛选 + G 字头 + 最晚。 |
| 55 | `RailwayAccountToNotes` | 打开铁路 12306 账号信息，把账号 ID 写到备忘录。 | none | 显示名和账号 ID 故意不同。 |

## Calendar / Weather / Reading

| ID | ClassName | Template | Params | Design note |
|---:|---|---|---|---|
| 56 | `CalendarMakeupDayToWechat` | 在日历里查看 {month} 是否有补班日，如果有，把补班日期发给微信联系人“{contact}”。 | `month`, `contact` | 补班标记需要视觉确认；judge 检查消息日期。 |
| 57 | `CalendarKeywordDeleteReport` | 在日历里搜索“{keyword}”，删除所有相关日程，并把删除数量发给微信联系人“{contact}”。 | `keyword`, `contact` | 搜索命中的相关日程不一定标题直接含 keyword。 |
| 58 | `CalendarFreeDayWeatherToWechat` | 在日历里找 {date_range} 内没有安排的一天，再查天气，把日期和天气发给微信联系人“{contact}”。 | `date_range`, `contact` | 日历空闲日 + 天气跨 APP 整合。 |
| 59 | `WeatherFirstSunnyCalendarSms` | 查询 {city} 未来 {days} 天天气，找到第一个晴天，在日历创建“{event_title}”，并短信通知“{contact}”。 | `city`, `days`, `event_title`, `contact` | 需要明确定义 days 是否含今天，任务实现时固定到数据层。 |
| 60 | `WechatReadingHotSearchToRedbook` | 打开微信读书热搜榜，把第 {rank} 名书名发布到小红书。 | `rank` | 热搜榜文本可见，历史轨迹中出现过读错并传播。 |

## Recommended first batch

优先实现下面 20 个，原因是它们和已观察失败最贴近，且 judge 容易写成强 state 判定：

`RedbookSearchTitleToWechat`, `RedbookTopLikedTitlesToNotes`, `RedbookUserNoteCountToWechat`, `RedbookUserTopLikedToWechat`, `RedbookKeywordTitleToWechat`, `RedbookKeywordTitleCollectToNotes`, `RedbookFollowingUserTopLikedToWechat`, `SpotifyRecentArtistSongToWechat`, `TencentMeetingLongestToWechat`, `TencentMeetingParticipantsToNotes`, `SmsConversationCountToWechat`, `SmsKeywordSenderToWechat`, `AlipayTransferCountToWechat`, `AlipayLargestCounterpartyToNotes`, `AlipayMonthExpenseCompareToWechat`, `BilibiliRankingCategoryTopToWechat`, `BilibiliTripleActionToMoments`, `BilibiliFavCountToWechat`, `MapDrivingCostToNotes`, `WechatReadingHotSearchToRedbook`.

## Design review and judge plan

本节按 `designing-bench-task` / `TASK_DESIGN_GUIDE.md` 的设计门槛审阅。每条记录覆盖判定预演的四类问题：正确完成时的最终证据、常见错误是否会误判通过、合理替代路径是否会误判失败、以及参数/fixture 的边界条件。`推荐` 表示可进入实现；`需修改` 表示模板可保留但必须先收紧参数、口径或 fixture；`暂缓` 表示当前状态面或 UI 证据不足，不建议直接实现。

### Redbook

| ID | Verdict | Design considerations | Judge plan | Risks / fixes |
|---:|---|---|---|---|
| 1 | 推荐 | 指令自然；`rank` 是默认搜索结果 1-indexed；重点测列表截断标题。 | 由 Redbook 搜索结果第 `rank` 篇取详情页完整标题；判微信给 `contact` 的新增消息归一化包含标题。 | `query` 至少 3 个且结果数覆盖最大 `rank`；只判新增消息，避免旧聊天误过。 |
| 2 | 推荐 | 与 1 同源，但落点是备忘录；允许写在标题或正文。 | 取同一完整标题；判 Notes 最新/新增笔记全文包含标题。 | 不要只判任意旧笔记；标题需做标点/空白归一化。 |
| 3 | 需修改 | “最多点赞排序”客观；`count` 建议 2-3；多标题迁移有区分度。 | 按点赞降序取前 `count` 篇完整标题；判最新/新增笔记包含全部标题，必要时检查顺序。 | fixture 必须保证点赞数无并列、结果数足够、每个 `query` 有 >=3 变体。 |
| 4 | 需修改 | 用户主页计数客观，但不能依赖页面上已有总数；应让 agent 遍历主页。 | 由目标用户 authorId 统计 `notesById` 中笔记数；判微信新增消息包含数量。 | 只采样 >=3 个有多篇且 UI 可遍历的用户；避免 0/1 篇过浅。 |
| 5 | 暂缓 | “最新发布”当前 UI 排序口径不够明确。 | 若保留，定义 latest 为该作者 `createdAt` 最大笔记；判短信新增消息包含标题。 | 建议改成“主页最前面的笔记标题”，或先保证作者页按发布时间倒序。 |
| 6 | 推荐 | 用户内最高赞笔记客观；标题+点赞数双槽位可防漏项。 | 目标用户全部笔记中取唯一最高点赞；判微信新增消息包含完整标题和点赞数。 | 每个用户至少 3 篇且最高赞唯一；最高赞最好不在首屏。 |
| 7 | 推荐 | 作者名是稳定字段；难度偏 L2，但能测卡片定位。 | 搜索第 `rank` 篇 note 的 authorId -> 用户名；判微信新增消息包含作者名。 | `rank` 参数需有 >=3 变体；不要把标题中的人名当作者。 |
| 8 | 推荐 | 操作+汇报双证据，能防只发消息不收藏。 | 判目标 note id 新增到 `user.collectedNotes`，并判微信新增消息包含同一 note 的作者名。 | 目标不能初始已收藏；收藏与作者必须来自同一篇笔记。 |
| 9 | 推荐 | 评论+短信跨 App，目标明确；一致性是核心。 | 判目标 note 有当前用户新增评论 `comment`；判短信给 `contact` 的新增 outgoing 内容包含同一 note 作者名。 | 排除初始已有同评论；`comment` 至少 3 个中文自然变体。 |
| 10 | 需修改 | “标题里包含 keyword”必须唯一，否则答案不唯一。 | 在搜索结果中筛 `keyword in title` 得唯一目标；判微信新增消息包含作者名。 | fixture 保证每组 `{query, keyword}` 恰好一个标题命中，并加入封面/正文含 keyword 的干扰项。 |
| 11 | 需修改 | 与 10 同样需要唯一目标；收藏+备忘录可形成强证据。 | 唯一标题命中 note：判收藏新增 note id，且 Notes 最新/新增笔记包含完整标题。 | 排除初始已收藏；`query` 与 `keyword` 应绑定采样，不做任意笛卡尔积。 |
| 12 | 需修改 | 关注列表定位+主页计数可测；现有关注用户参数少于 3。 | 统计目标关注用户 authorId 的笔记数；判短信新增消息包含数量。 | 扩充 >=3 个已关注且笔记数不同的用户；明确计数口径为所有该作者笔记。 |
| 13 | 需修改 | 高价值任务，但默认关注用户可比较样本不足。 | 对目标关注用户全部笔记按点赞取唯一最高；判微信新增消息包含标题。 | 每个候选用户至少 3 篇、最高赞唯一，且最高赞放非首屏。 |
| 14 | 推荐 | 两个 rank 的标题迁移能测长列表和截断；rank 必须不同。 | 分别取 `rank_a`、`rank_b` 的详情页完整标题；判微信新增消息同时包含两者。 | 两个 rank 都在范围内，至少一个列表标题截断；限制目标不要过深。 |
| 15 | 推荐 | 标题和点赞数来自不同区域，客观可判。 | 取搜索第 `rank` 篇完整标题和点赞数；判 Notes 最新/新增笔记同时包含两项。 | 点赞数允许原始“万”格式或等价数字；只判新增/最新笔记。 |

### Spotify / Tencent Meeting / SMS

| ID | Verdict | Design considerations | Judge plan | Risks / fixes |
|---:|---|---|---|---|
| 16 | 需修改 | “某歌手的歌”在同一艺人多首时不唯一；artist 不能用通用参数裸采。 | 从 `recentPlays` 中按 artist 找目标歌曲；判微信新增消息包含歌名。 | 改成“最近一首/第一首”，或 fixture 保证每个 artist 仅一首且有 >=3 个有效 artist。 |
| 17 | 推荐 | 发布到小红书有强状态证据；rank 应为最近播放页视觉顺序。 | `recentPlays[rank-1]` 取歌名+歌手；判 Redbook 新发布笔记标题/正文包含两者。 | 不要使用旧的 `nth_today_play()` 反向语义；rank 至少 3 个值。 |
| 18 | 暂缓 | 最近播放项缺 album 字段，专辑真值不稳定。 | 只有补充 track -> album 静态映射后，才能判 Notes 包含歌名、歌手、专辑。 | 先补 fixture/accessor；否则 judge 会依赖不可观测 UI 详情。 |
| 19 | 需修改 | “所有某歌手歌曲”能测完整遍历，但默认只有少数 artist 多首。 | 取 `recentPlays` 中该 artist 全部标题；判微信新增消息包含全部标题。 | 需要 >=3 个 artist 且每个至少 2 首，至少一首在非首屏。 |
| 20 | 暂缓 | “移动”需要源移除+目标新增；默认 `customPlaylists` 为空。 | fixture 创建可编辑源歌单；判目标歌单新增该 artist 全部歌、源歌单移除，并判微信消息包含数量。 | 实现前确认 UI 支持从源歌单移除；target 初始不存在或为空。 |
| 21 | 需修改 | 当前 UI 更像“添加到歌单并取消喜欢”，不是原生 move。 | 判目标歌单包含初始 liked 中该 artist 全部歌、likedSongs 中该 artist 清零；判 Notes 新笔记包含全部歌名。 | 模板建议改为“添加到歌单并取消喜欢”；target 初始为空，Notes 只判新内容。 |
| 22 | 推荐 | 歌单第 N 首目标明确；短信落点强。 | 由 playlist 静态曲目顺序取第 `rank` 首标题；判 SMS 新增 outgoing 给 `contact` 且包含歌名。 | 建立 playlist 名称到 id 的稳定映射；同名歌最好同时要求 artist。 |
| 23 | 需修改 | “热门歌曲”需固定为艺人页排序前 N；`count` 建议 2-3。 | 从 `artistTracks`/艺人页热门列表取前 `count` 首；判 Redbook 新发布笔记包含全部歌名。 | 不要混用搜索排序；必须判发布结果，而非 Spotify 内部访问痕迹。 |
| 24 | 需修改 | 需求自然，但默认歌曲数据不都含 album。 | 采样自有 album 字段的歌曲；判微信新增消息包含专辑名。 | 补静态 album resolver；至少 3 首有专辑的歌曲。 |
| 25 | 推荐 | 历史会议最长时长客观；适合长列表比较。 | `history` 中取唯一 `duration` 最大会议；判微信新增消息包含会议名称和时长。 | 确认最长唯一；时长匹配接受分钟数或中文时长。 |
| 26 | 推荐 | 参会人数是详情页字段；`meeting` 可从历史会议采样。 | 找历史会议并统计 participants 数量；判 Notes 最新/新增笔记包含人数。 | 优先采样主持人会议或确保详情页可见参会人；会议 title 要唯一。 |
| 27 | 推荐但需补数据 | 日期过滤+最长比较客观；现有日期参数只有 2 个。 | 指定日期内取唯一最长会议；判 SMS 新增 outgoing 包含会议名。 | 若参数化 `date`，补第三个日期且每日期至少 2 场、最长唯一；模板可改“这天”。 |
| 28 | 推荐 | 主持人来自详情页 participants/hostId，客观可判。 | 根据 meeting 找 hostId 对应 participant name；判微信新增消息包含主持人名。 | 排除重复 title，或采样时用唯一会议标题。 |
| 29 | 需修改 | “名称包含 keyword”应只按 title 计数，不按主持人/会议号。 | 统计历史会议 title 中包含 keyword 的数量；判 Notes 最新/新增笔记包含数量。 | 补 >=3 个 keyword；加入主持人/会议号命中干扰，避免 UI 搜索口径漂移。 |
| 30 | 推荐 | 两会话消息条数比较客观；已有 3 组参数。 | 以 `messagesByConversationId[id]` 实际长度比较，判微信新增消息包含消息更多的发送方。 | 不要用 `conversation.messageCount` 字段；排除条数相等样本。 |
| 31 | 推荐 | 无参数但目标明确；未读会话可遍历。 | 用初始 SMS provider 统计 `isUnread` 会话数；判 Notes 最新/新增笔记包含数字。 | 必须判新笔记/变化笔记，避免旧内容数字误过。 |
| 32 | 推荐 | 最新一条内容需要进入会话确认完整文本。 | 取目标 sender 最新 incoming 消息内容；判微信新增消息包含原文。 | 长短信允许子串/归一化，但必须是新增微信消息。 |
| 33 | 暂缓 | “包含 keyword 的最新消息”跨会话全局时间口径不稳。 | 若实现，需 fixture 注入可解析 timestamp，并按明确排序取最新；判微信消息含 sender+content。 | 现有展示时间如“昨天 19:35”不适合直接全局排序。 |
| 34 | 推荐 | 最新两条内容和顺序都客观；能测自己/对方消息区分。 | 取会话最后两条消息 content；判 Notes 最新/新增笔记按顺序包含两条。 | 不要只判任意一条；sender 至少 3 个有效会话。 |

### Alipay / Bilibili

| ID | Verdict | Design considerations | Judge plan | Risks / fixes |
|---:|---|---|---|---|
| 35 | 需修改 | “转账记录”可能指搜索词或 quickFilter，必须统一口径。 | 建议按账单搜索“转账”计数，或新增 quickFilter=transfer accessor；判微信新增消息包含数量。 | 模板可改成“搜索‘转账’后统计记录数量”，避免语义分叉。 |
| 36 | 需修改 | “累计金额最大”需明确支出、收入或绝对值合计。 | 建议按支出累计聚合 counterparty，判 Notes 新笔记包含对象名和金额。 | 与现有类似任务口径统一；金额需容差匹配。 |
| 37 | 需修改 | 月份比较可判；需 >=3 对非平局月份组合。 | `monthly_expense(month)` 比较；判微信新增消息包含支出更高月份和金额。 | 现有任务若只答月份不够；采样排除相等和无数据月份。 |
| 38 | 推荐 | 账单关键词搜索计数自然；短信落点强。 | `count_bill_search_results(keyword)` 取数量；判 SMS 新增 outgoing 给 `contact` 包含数字。 | 初始化清空筛选；judge 按全量搜索结果，不按当前月。 |
| 39 | 需修改 | “分类总金额”需明确支出总额/收入总额/绝对值。 | 建议按全量账单该 category 的支出绝对值求和；判 Notes 新笔记含分类名和总额。 | `category` 从多条记录分类中采样 >=3 个；模板可写“所有账单里该分类支出总额”。 |
| 40 | 需修改 | “好友未读消息”不能混入服务会话。 | 新增 friend unread accessor：只统计 person 会话中未读好友消息；判微信新增消息含数字。 | 若沿用 `total_unread`，模板改成“支付宝消息未读总数”。 |
| 41 | 推荐 | 排行榜分区+rank 客观；标题以详情页完整标题为准。 | `ranking_title(category, rank)`；判微信新增消息归一化包含完整标题。 | `rank` 限制到可稳定滚动范围；不要判截断标题。 |
| 42 | 推荐 | 与 41 同源，落点 Notes；可保留但注意同质化占比。 | 取排行榜完整标题；判 Notes 最新/新增笔记包含标题。 | 只判新/最新笔记，避免初始内容误过。 |
| 43 | 需修改 | 三连+朋友圈强证据，但初始互动状态可能已满足。 | 解析 video -> bvid；判 liked、coined、favored 都为 true，并判微信新朋友圈包含 `message`。 | 参数池只选初始未赞/未投币/未收藏视频，至少 3 个。 |
| 44 | 需修改 | 收藏后再读收藏夹数量有因果依赖；需指定默认收藏夹。 | 选未收藏排行榜视频；判默认收藏夹包含该视频，并判微信消息包含收藏夹新数量。 | 模板建议写“收藏到默认收藏夹”；排除初始已收藏视频。 |
| 45 | 需修改 | 作者名可判，但当前 accessor 缺直接 title -> author helper。 | 补 `video_author(title)` 或用详情数据解析 author；判 SMS 新增 outgoing 包含作者名。 | 参数必须来自唯一可解析且有 author 字段的 >=3 个视频。 |
| 46 | 推荐但需补 accessor | 搜索第 N 个标题迁移贴合失败模式。 | 补与 SearchPage 一致的 `search_video_title(query, rank)`；判微信新增消息包含详情页完整标题。 | `query` 至少 3 个，每个结果数覆盖 rank；列表标题设置截断干扰。 |
| 47 | 需修改 | “已关注”报告过弱，必须绑定目标 UP。 | `resolve_mid_by_name(up_name)` 后判 following；微信新增消息需含 `up_name` 和关注语义。 | 只采样推荐 UP 且初始未关注者；至少 3 个。 |
| 48 | 需修改 | 追番状态证据干净，但初始已有追番。 | 判 `subscribedAnime/subscribedDramas` 新增目标 anime；判 Notes 最新/新增笔记含番剧名。 | 参数排除初始已追；确保可追番候选 >=3。 |

### Map / Railway / Calendar / Weather / Reading

| ID | Verdict | Design considerations | Judge plan | Risks / fixes |
|---:|---|---|---|---|
| 49 | 需修改 | 费用计算客观，但必须固定舍入口径。 | 以驾车路线距离计算 `distance_km * rate`；判 Notes 最新/新增笔记包含地点和费用，允许小容差。 | `place` 只采有 current -> place 驾车路线的 >=3 地点；不要用 POI 卡片距离。 |
| 50 | 推荐 | 评分最高地点客观；可测首屏非全局最高。 | 全量 `geo_search(query)` 后按评分取最高，同分按距离等固定规则；判微信消息含地点名和评分。 | 明确是全量结果而非首屏结果；UI 必须可加载到最高项。 |
| 51 | 推荐 | 完整地址需进详情页；短信落点强。 | `resolve_places(place)` 得完整地址；判 SMS 新增 outgoing 给 `contact` 包含归一化地址。 | 地址归一化应去邮编/标点；只判新增短信。 |
| 52 | 推荐 | 路线距离+时间客观；适合区分 POI 卡片字段。 | 取当前位置到 `place` 的 DRIVING route 距离和时长；判 Notes 最新/新增笔记包含两者。 | `place` 用有离线路线白名单；不要采缺 route 的地点。 |
| 53 | 需修改 | G 字头和最早口径清晰；date 必须可查且有 G 车。 | 按 route/date 过滤 `trainNo.startswith("G")`，取出发最早；判微信新增消息含车次。 | 采样排除无 G 车和并列最早；不要把 C/D 算作 G。 |
| 54 | 需修改 | 席别+最晚可判，但余票由模拟日期生成。 | 过滤 G 字头且目标席别有票，按出发时间取最晚；判 SMS 新增消息含车次和席别。 | `date` 只用 sampler 生成有效可售日期；排除并列最晚。 |
| 55 | 推荐 | 账号 ID 与显示名/实名干扰明确；无需参数化。 | 取铁路账号 username/account id；判 Notes 最新/新增笔记包含账号 ID。 | 只接受账号 ID，不接受显示名、姓名或手机号。 |
| 56 | 需修改 | `{month}` 需固定为 2026 年月份；有/无补班都要定义输出。 | 用 Calendar 静态 2026 调休数据推补班日；有则判微信消息含日期，无则判消息说明无补班。 | 需定义“补班日”是否含假期前调休；或改成“某假期结束后补班日”。 |
| 57 | 推荐但需补数据 | 搜索删除自然；“相关”口径需和 UI 一致。 | 初始按 title/description 或明确字段取命中日程数；最终无命中日程，且微信消息含删除数量。 | `CALENDAR_SEARCH_KEYWORDS` 目前只有 2 个；补 >=3 个或固定 keyword。 |
| 58 | 暂缓 | 缺城市/地点，“空闲一天”也可能多解。 | 若保留，定义为 date_range 内最早空闲日 + 指定 `{city}` 天气；判微信消息含日期和天气。 | 需新增 `{city}`，并保证天气覆盖和最早空闲日唯一。 |
| 59 | 需修改 | 有清晰因果链；必须定义 days 是否含今天。 | 建议“从今天起未来 N 天”找第一个晴天；判 Calendar 新增 `event_title` 在该日，且 SMS 新消息含日期/天气。 | 定义“晴”的匹配集合；采样保证范围内存在晴天且 event_title 初始不存在。 |
| 60 | 推荐 | 热搜榜 rank 稳定，发布到小红书证据强。 | `hotSearch[rank-1].title` 为真值；判 Redbook 新发布笔记标题/正文包含书名。 | 如果 agent 点进搜索结果，仍按榜单 rank 判；发布内容可在标题或正文。 |
