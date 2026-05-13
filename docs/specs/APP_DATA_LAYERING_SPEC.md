# App 数据分层规范

> 本文规定 App 的服务端/公共世界数据、当前用户个人运行态数据、环境修改和读取口径的分层原则。

本文的核心目的：

```text
区分服务端/公共世界数据与当前用户个人运行态数据。
规定 bench/setup 修改环境数据时应写入哪里，以及 App/bench 应按什么口径读取。
```

本文规定的是横向数据分层原则，不规定每个 App 的具体业务 schema、数据库表结构或业务状态机。

## 一、核心结论

对于包含大量公共内容的 App，推荐把数据分成两层：

```text
静态世界数据 base dataset
  公共帖子、公共评论、公共用户、商品、视频、车站等
  体量大，通常只读
  放在 data/*.json、loader、未来的 /api/sim-data 或 SQLite 中

用户运行态 runtime state
  当前用户资料、设置、用户关系索引、聊天、草稿、runtime entity overlay 等
  体量小，可被 bench_env 读写和 diff
  放在 data/defaults.json，state.ts 从 defaults 初始化
```

`defaults.json` 的定位应更精确地定义为：

```text
defaults.json = reset 后需要持久存在、可初始化的 runtime truth
__SIM__.getState().apps.<app> = state.ts 当前 runtime state 经 registerStateAdapter 处理后的快照
```

但 `defaults.json` 不等于“App 能看到的全部世界数据”。大型公共内容库不属于 runtime state，不应为了 bench_env 访问而塞进 `getState()`。

对实体表字段而言，`defaults.<entities>` 的语义是 runtime overlay table，而不是“当前用户私有实体专用表”：

```text
defaults.posts / defaults.notes / defaults.comments
  reset 后的 runtime overlay 初始值
  可表达当前用户创建的完整实体
  可表达对 base entity 的完整覆盖 / tombstone
  可表达场景注入的少量 runtime 新实体
```

长期公共内容仍应放在 base dataset。`defaults.<entities>` 中的实体必须通过 `view_*` resolver 与 base dataset 聚合后使用；loader / base cache 不得为了展示方便把 `defaults.<entities>` 预先合并进去。

## 二、实体同构原则

静态数据和运行态数据可以使用同一套实体 schema，只是存储范围不同：

```text
basePosts[id]   公共世界里的帖子
state.posts[id] runtime overlay：创建、场景注入、覆盖或隐藏 base 帖子

baseComments[id]   公共世界里的评论
state.comments[id] runtime overlay：创建、场景注入、覆盖或隐藏 base 评论
```

前端展示时通过 resolver 聚合：

```ts
function resolvePost(id: string) {
  if (Object.prototype.hasOwnProperty.call(state.posts, id)) {
    const post = state.posts[id];
    if (post === null) return null;
    return post;
  }
  return basePosts[id] ?? null;
}

const myPosts = state.user.postIds.map(resolvePost).filter(Boolean);
const likedPosts = Object.entries(state.user.postVotes)
  .filter(([, vote]) => vote === 'up')
  .map(([id]) => resolvePost(id))
  .filter(Boolean);
```

Resolver 的优先级必须明确。

```text
state.posts[id] 是 object，且 basePosts[id] 存在 → 返回 state.posts[id]，表示对 base 实体的完整覆盖
state.posts[id] 是 object，且 basePosts[id] 不存在 → 返回 state.posts[id]，表示 runtime 新增实体
state.posts[id] 是 null → tombstone，表示该 base 实体被隐藏或删除
state.posts 不含的 id → 表示该 ID 没有 runtime 覆盖；view_post(id) 再去 basePosts[id] 读取该实体
```

Overlay 完整性要求：

```text
state.posts[id] 命中 basePosts[id]
  必须保存完整实体，表示对 base 实体的完整覆盖。
  不应把缺字段对象作为稳定 runtime overlay 格式，也不应依赖 view_post(id) 从 base 补齐缺失字段。

state.posts[id] 不命中 basePosts[id]
  表示 runtime 新增实体，同样必须保存完整实体字段，至少满足该实体类型 schema 的必填字段。

__SIM__.setState() patch
  是写入命令，不是长期数据格式。
  bench_env 默认以 deep=true 调用。
  支持 partial state patch 是必须能力，用于任务 setup 轻量修改环境。
  但 partial state patch 不等于 partial entity overlay。
```

当前 `__SIM__.setState(patch, { deep: true })` 的合并语义：

```text
object → 对同名对象递归 deep merge
undefined → no-op，保留原值
null → 显式写入 null，可作为 tombstone
array → 整体替换数组
primitive → 整体替换字段值
```

示例：

```json
{
  "apps": {
    "redbook": {
      "notes": {
        "base_note_1": {
          "title": "任务定制标题"
        }
      }
    }
  }
}
```

上面的 patch 只适合目标实体已经存在于 runtime state 且原值是完整实体的情况。`setState` 会把字段 deep merge 到现有 runtime 实体上，合并后仍保持完整实体。

如果 `base_note_1` 只存在于 base dataset、不存在于 runtime state，上面的 patch 会制造一个缺字段的 runtime overlay，这是不合法状态。正确做法是先通过 app accessor 读取完整的 `view_note("base_note_1")` / `base_note("base_note_1")`，修改字段后把完整实体写入 `state.notes.base_note_1`。

也就是说，`__SIM__.setState()` 支持 partial state patch；但 `state.<entities>[id]` 的稳定数据契约是完整实体或 `null` tombstone。App UI、bench query 和 sampler 返回候选都应读取 `view_*`，不能直接把 `state.<entities>[id]` 当作已聚合的完整世界视图使用。

实体是否“属于当前用户”不能从 `state.posts` / `state.notes` 是否存在推断。编辑、删除、个人主页统计这类所有权敏感逻辑必须同时验证：

```text
用户索引：user.postIds / user.commentIds / user.publishedNoteIds 等
实体作者：post.author / note.authorId / comment.userId 等与当前用户匹配
```

因此，`state.notes` 中可以少量存在非当前用户的 runtime overlay 实体，但它们不会因为出现在 `state.notes` 里就自动变成“我的笔记”。

这允许 bench setup 通过 `__SIM__.setState()` 修改环境数据：

```text
apps.reddit.posts.base_post_1 = {
  id: "base_post_1",
  subreddit: "r/self",
  author: "Embarrassed_Fee8630",
  title: "任务定制标题",
  ...RedditPost schema 要求的其他必填字段
}
```

若需要隐藏 base 实体，可使用 tombstone：

```json
{
  "apps": {
    "reddit": {
      "posts": {
        "base_post_1": null
      }
    }
  }
}
```

实现注意：`__SIM__.setState()` 的 deep merge 必须持续区分 `null` tombstone 与 `undefined` no-op；否则外部 patch 无法表达删除/隐藏 base 实体。

上述规则不限于帖子。凡是存在“公共世界数据 + 当前用户运行态”的实体类型，都应遵守同一套 base/state resolver 语义：

```text
posts / comments / users / notes / videos / products / songs / playlists / places 等
```

也就是说，`basePosts + state.posts` 只是示例；RedBook 的 `notes/users`、Bilibili 的 `videos/comments`、电商 App 的 `products/orders`、地图 App 的 `places/routes` 都应使用同一类分层判断。命名上，文档可称为“静态数据层”，但 App/bench accessor 不建议使用 `static_*`，统一使用 `base_*` 表示 base dataset。

这样可以同时满足：

- runtime state 轻量，`getState()` 不传大数据
- 当前用户创建内容有完整实体，可离线判定
- 公共实体详情仍由 base dataset 提供
- 将来从 JSON 切换到 `/api/sim-data` 或 SQLite 时，runtime schema 不需要大改

## 三、字段归属规则

### 3.1 引用公共实体，只存 ID 或关系状态

如果对象来自 base dataset，runtime state 中只保存当前用户和它的关系：

```json
{
  "user": {
    "savedPostIds": ["post_1"],
    "followedUserIds": ["user_1"],
    "joinedCommunityIds": ["com_games"]
  }
}
```

不推荐复制完整实体：

```json
{
  "user": {
    "likedPosts": [
      { "id": "post_1", "title": "...", "content": "..." }
    ]
  }
}
```

完整实体重复存储会导致同步问题：标题、计数、作者资料被修改后，多个副本谁是真相源会变得不清楚。

### 3.2 runtime 新增实体，存完整内容

如果对象是模拟器运行时创建或场景注入的，且 base dataset 中不存在，就应在 runtime state 中保存完整实体：

```json
{
  "user": {
    "postIds": ["my_post_1"],
    "commentIds": ["my_comment_1"]
  },
  "posts": {
    "my_post_1": {
      "id": "my_post_1",
      "subreddit": "r/self",
      "author": "Embarrassed_Fee8630",
      "title": "有没有人也会半夜突然想整理房间？",
      "content": "明明很困了，但一想到明天事情多，就忍不住开始收拾桌面。"
    }
  },
  "comments": {
    "my_comment_1": {
      "id": "my_comment_1",
      "postId": "post_1",
      "author": "Embarrassed_Fee8630",
      "body": "这个建议很有用。"
    }
  }
}
```

其中：

- `posts` / `comments` 是 runtime 实体表
- `user.postIds` / `user.commentIds` 是当前用户拥有内容的索引和展示顺序
- 用户索引字段统一只存实体 ID 数组，不复制实体内容字段。评论、笔记、帖子没有特殊例外：评论归属从 `comments[id].postId` / `comments[id].noteId` 读取。

常规 `defaults.json` 中，完整新增实体应优先用于当前用户可管理内容；少量非当前用户场景实体也可以放入 runtime overlay，但必须被当作“场景注入实体”，不能当作长期公共数据。长期公共内容应进入 base dataset。

### 3.3 二元关系使用 ID 数组

只表达“有/无”的关系，用 ID 数组：

```json
{
  "user": {
    "savedPostIds": ["post_1"],
    "followedUserIds": ["user_1"],
    "joinedCommunityIds": ["com_games"]
  }
}
```

适用场景：

- 收藏
- 关注
- 加入社区
- 订阅
- 保存到列表

关系 ID 列表是真值。由关系列表可计算出的数量字段不应作为独立数据源维护：

```text
user.followingIds / user.followedUserIds → 真值
display_following_count = user.followingIds.length

user.followerIds / user.followerUserIds → 真值
display_follower_count = user.followerIds.length
```

因此，关注/取关 action 只更新关系 ID 列表，不应同时写 `user.following`、`user.followers` 这类展示计数字段。若 UI 需要展示数量，应由 `view_user()` / selector 在读取时计算，不应写回 runtime state，也不应作为 raw `getState()` 字段暴露。

`*Ids` 与 `*Count` 的统一原则：

```text
实体类型可以定义 followerCount / followingCount 这类 summary count 字段。
base dataset 通常保存 *Count summary，不要求保存完整 *Ids 关系图。

runtime state 中，同一关系维度只能选择一种真值：
  有 followingIds / followerIds：
    *Ids 是真值。
    *Count 不进入 defaults.json，不由 action 写入，也不作为 raw getState 字段暴露。
    需要展示或回答数量时，由 view_user() / selector / bench accessor 用 *Ids.length 计算。

  没有 followingIds / followerIds：
    *Count 可以作为纯展示 summary。
    这表示 App 暂时不关心具体关系对象，不能支持“是否关注某人”这类精确判定。
```

对应地，bench setup 和 expected changes 也不应写或断言可由 ID 列表计算出的 count 字段：

```text
setup / operate 判定：
  关注某人 → 写入或检查 followingIds 包含目标 id
  取关某人 → 写入或检查 followingIds 不包含目标 id

query / answer：
  我的关注数 → len(followingIds)
```

推荐新字段使用明确命名：

```text
followingIds / followerIds     # 关系 ID 列表
followingCount / followerCount # 展示统计
isFollowing / isFollowed       # view_* 派生布尔展示态
```

### 3.4 多态互斥关系使用 Record

如果关系是多态且互斥，例如投票的 `up / down / none` 三态，使用 Record：

```json
{
  "user": {
    "postVotes": {
      "post_1": "up",
      "post_2": "down"
    },
    "commentVotes": {
      "comment_1": "up"
    }
  }
}
```

无投票就是 key 不存在。不要拆成两个数组：

```json
{
  "user": {
    "upvotedPostIds": ["post_1"],
    "downvotedPostIds": ["post_2"]
  }
}
```

拆数组会要求额外维护互斥约束，容易出现同一个 id 同时出现在两个集合中的非法状态。

推荐 action 语义：

```ts
function votePost(postId: string, dir: 'up' | 'down') {
  const current = state.user.postVotes[postId];
  const nextVotes = { ...state.user.postVotes };
  if (current === dir) delete nextVotes[postId];
  else nextVotes[postId] = dir;

  set({ user: { ...state.user, postVotes: nextVotes } });
}
```

## 四、顶层实体与 user 子对象边界

`user` 子对象不应该承载所有用户相关数据。推荐边界如下：

```text
user 下放：
  当前用户 profile
  当前用户关系索引
  当前用户对实体的关系状态
  强绑定用户的轻量统计或偏好

顶层放：
  当前 App 沙盒中的业务实体
  posts / comments / chats / messages / orders / playlists / drafts
```

例如聊天数据推荐保持顶层，而不是放进 `user.chatThreads`：

```json
{
  "user": {
    "username": "Embarrassed_Fee8630",
    "postVotes": {},
    "postIds": []
  },
  "chatThreads": {
    "Objective-Skill-2591": [
      { "id": "ct_1", "from": "them", "body": "你上次推荐的那家店我去了。", "created_utc": 1710000001 }
    ]
  },
  "chatReplies": {
    "Objective-Skill-2591:ct_1": [
      { "id": "cr_1", "from": "me", "body": "确实不错。", "created_utc": 1710000004 }
    ]
  }
}
```

原因：

- 聊天是 App 的业务实体，不是用户 profile 字段
- bench_env 判断发消息时读顶层会话自然清晰
- 避免 `user` 变成包含所有业务数据的大杂烩

如果未来需要更规整，可演进为：

```json
{
  "chatThreads": {
    "thread_1": {
      "id": "thread_1",
      "participantUsername": "Objective-Skill-2591",
      "messageIds": ["m1", "m2"]
    }
  },
  "messages": {
    "m1": {
      "id": "m1",
      "threadId": "thread_1",
      "from": "them",
      "body": "..."
    }
  }
}
```

但这不是 Reddit 当前迁移的必要前置条件。

## 五、当前用户可管理数据规则

为了保持 judge 简单且避免 base 与 runtime 的所有权混淆，第一阶段规定：

```text
当前用户可管理的一切内容必须能由 defaults/runtime state 判定。
完整实体存在 state.<entities> 中。
归属和顺序存在 user.<entityIds> / user.publishedNoteIds 等 ID 数组索引中。
实体作者字段必须与当前用户匹配。
base dataset 中的内容视为公共世界数据，不作为当前用户可编辑/删除的私有数据。
```

例如 Reddit：

- 当前用户自己的帖子必须存在 `state.posts + user.postIds`
- 当前用户自己的评论必须存在 `state.comments + user.commentIds`
- base comments 一律视为公共评论，不作为“我的评论”编辑或删除
- 如果任务 setup 需要一条可删除的我的评论，应写入 runtime state，而不是依赖 base comments
- `state.posts` / `state.comments` 可以包含非当前用户的完整覆盖实体、tombstone 或少量场景实体；判定“我的内容”时不能只看实体表
- 不使用 `user.commentList` 这类含内容副本的结构；统一使用 `user.commentIds`，评论内容、时间、父实体归属等字段只存在 `state.comments[id]` / `view_comment(id)` 中

因此，删除自己的帖子或评论时只需要修改 runtime state：

```text
删除帖子：
  从 user.postIds 移除
  删除 state.posts[id]，或设置 tombstone

删除评论：
  从 user.commentIds 移除
  删除 state.comments[id]，或设置 tombstone
```

这也意味着 Reddit 当前不需要支持“删除别人的帖子”，也不需要从 base dataset 中按 author 反查当前用户可管理内容。

## 六、`createdPosts` 与 `user.postIds + posts` 的取舍

有两种可选结构。

方案 A：直接存 `createdPosts` 数组：

```json
{
  "createdPosts": [
    { "id": "my_post_1", "title": "...", "content": "..." }
  ]
}
```

优点：

- 直观
- 短期实现简单
- bench 判断可直接遍历

缺点：

- 实体存储和用户关系混在一起
- 多个视图引用同一实体时容易出现重复查找和同步问题
- 会产生 `createdPosts`、`createdComments`、`createdPlaylists` 等很多特例字段

方案 B：实体表 + 用户索引：

```json
{
  "user": {
    "postIds": ["my_post_1"]
  },
  "posts": {
    "my_post_1": { "id": "my_post_1", "title": "...", "content": "..." }
  }
}
```

优点：

- 与 base dataset 同构，聚合简单
- 查、改、删都可以按 id 处理
- 多个视图可复用同一个 resolver
- 更适合作为跨 App 规范

缺点：

- 创建实体时要同时写 `posts[id]` 和 `user.postIds`
- action 必须避免 dangling id

推荐选择方案 B。对于 Reddit 这类内容 App，`posts` 表示 runtime overlay 实体表，`user.postIds` 表示当前用户拥有和展示的帖子顺序。大多数情况下 `posts` 保存当前用户创建的完整实体或对 base 实体的完整覆盖；少量非当前用户场景实体可以存在，但不能参与“我的帖子”判定，除非同时满足用户索引和作者校验。

## 七、聚合计数与判定规则

公共实体上的聚合计数字段，如 `upvotes`、`comments`、`likes`，不应因为当前用户操作而直接修改 base dataset。UI 展示应实时派生：

```ts
const displayVote = state.user.postVotes[postId] ?? null;
const displayCommentCount =
  baseCommentCount(postId) + runtimeCommentsForPost(postId).length;
```

对于点赞、收藏、评论数这类聚合计数，可以用统一公式表达：

```text
base_likes(id) 表示不包含当前模拟用户 runtime 关系贡献的公共计数。

display_likes(id) =
  base_likes(id) + (current_user_likes 包含 id ? 1 : 0)

display_retweets(id) =
  base_retweets(id) + (current_user_retweets 包含 id ? 1 : 0)

display_comments(id) =
  base_comment_count(id) + runtime_comments_for_entity(id).length
```

也就是说，`init_user_likes` 不参与 `view_*` 的展示计数公式。`init` 只用于 operate 判定，例如判断“新增点赞”或“取消点赞”。如果数据作者希望初始 UI 显示 `N` 且当前用户初始已点赞，则 base count 应填写 `N - 1`，再由 `user.likedPostIds` 贡献当前用户这一票。

```text
base likes = 100，current_user_likes 不含 id → display likes = 100
base likes = 100，current_user_likes 包含 id → display likes = 101
```

RedBook、Bilibili、X 这类内容 App 若需要展示“我操作后的总赞数”，应在 `view_*` 中按 `base count + 当前用户关系变化` 派生。点赞、收藏、转发、关注等关系操作只更新 `user.*Ids` / `user.*ings` 等关系 ID 列表；新增评论只写 runtime 评论实体和用户评论索引。不要为了聚合计数变化，把 base 实体复制到 `state.posts` / `state.notes` 后覆盖 `likes`、`comments` 等字段，也不要在 action 中同时维护 `user.followings` 和 `user.following` 这类关系列表 + 展示数量双写。

Operate 类任务不能用 base 聚合计数判断用户操作是否成功。例如点赞任务应判断：

```python
state["user"]["postVotes"].get(post_id) == "up"
```

不应判断：

```python
base_post["upvotes"] 增加了 1
```

原因：

- base dataset 是公共世界数据，不应被单个用户操作改写
- 聚合计数可能是字符串、缩写或异步派生展示值
- 用户操作的稳定证据是 runtime relationship，而不是 base summary

如确实需要展示或查询“操作后的计数”，应在 App accessor 中按同一规则派生，而不是写回 base。

## 八、bench_env 访问规则

bench_env 的任务判断优先读 runtime state，不直接读静态大文件。

Operate 类任务：

```text
优先读取 __SIM__.getState().apps.<app>.user.*
以及小型 runtime 实体表，如 posts、comments、chatThreads
```

例如：

```python
# 点赞帖子
state["user"]["postVotes"].get(post_id) == "up"

# 发帖
post_id in state["user"]["postIds"]
post = state["posts"][post_id]

# 删除自己的帖子
post_id not in state["user"]["postIds"]

# 加入社区
community_id in state["user"]["joinedCommunityIds"]
```

`view_*` 是模拟器前端和 bench_env 共同遵守的展示口径，不是只属于某一侧：

```text
模拟器 / App 前端
  通过 resolver / selector 生成 view entity，供 UI 展示使用。

bench_env/task/<app>/app.py
  提供同语义的 view_* accessor，供 sampler、answer、judge 使用。
```

两侧的 `view_*` 必须遵守同一套 `base fallback + runtime override/tombstone` 规则。bench 侧默认读取口径是 `view_*`，不是 `base_*`，也不是直接访问 `state.<entities>[id]`。

```text
view_*        任务查询、答案、采样的默认口径，表示用户/Agent 在某份 state 下能看到什么
state_user()  操作判定的默认口径，表示当前用户做了什么
state_*       runtime 实体表 accessor，只用于新增、覆盖、tombstone 等实体级判定
base_*        accessor 内部只读数据源，不作为 task.py / defs.py 的常规接口
```

App accessor 可保留三层命名，但对外推荐优先暴露 `view_*` 和 `state_user()`：

```python
view_post(id)     # 按 base fallback + runtime override/tombstone 解析后的展示口径，等价于前端/Agent 看到的实体
state_user()      # 当前用户 runtime 状态，如 likedPostIds / postIds
state_post(id)    # runtime 实体表中的新增、覆盖或 tombstone；只在需要实体级判定时使用
base_post(id)     # 内部 helper：只读 base dataset 中的原始实体，不建议 task.py 直接调用
```

泛化到其他实体：

```python
view_note(id)
state_note(id)
base_note(id)

view_user(id)
state_user()
base_user(id)

view_product(id)
state_product(id)
base_product(id)
```

任务语义对应的读取规则：

```text
纯 query / answer
  读 init.view_*。答案应等价于任务开始时用户能看到的内容。

操作后 answer
  读 current.view_*。例如“点赞后告诉我多少赞”应读操作后的 view_post。

operate 判定
  读 current state_user() / user.*，必要时对比 init state_user()。

runtime 实体创建、编辑、删除判定
  读 state_* 或专门 check helper，例如 state_post(id)、check_post_deleted(id)。
```

例如 RedBook 的“点赞后告诉我总赞数”：

```python
note = redbook_current.view_note(note_id)
answer = note["likes"]
passed = note_id in redbook_current.state_user()["likedNotes"]
```

Sampler 也应默认使用 `init.view_*` 语义。大型 base dataset 的扫描、索引、过滤可以在 `bench_env/task/<app>/app.py` 内部用 `base_*` 实现，但 accessor 对外返回的候选应是 view 口径实体或 view 口径字段：

```python
# ✅ sampler 调用 view 口径 accessor
candidates = x_init.search_view_posts(keyword)

# ✅ search_view_posts 内部可用 base index 加速，但返回 view_post(id)
def search_view_posts(self, keyword):
    ids = self._base_post_index.search(keyword)
    return [self.view_post(id) for id in ids]

# ❌ task.py / defs.py 直接读 base entity 后拿它当答案
post = x.base_post(post_id)
```

base dataset 访问规则：

```text
允许 app.py 内部读取 base dataset 来构建 view_* 或搜索索引
禁止 task.py 直接读取 apps/<App>/data/*.json
不建议 task.py / defs.py 直接调用 base_*，除非该 helper 返回前再次转成 view 口径
```

短期可以由 `bench_env/task/<app>/app.py` 读取 JSON 文件。未来可以替换为 `/api/sim-data` 或 SQLite 查询，task 代码不应感知底层来源变化。

`app.py` 读取 base JSON 的路径与缓存命名建议：

```python
_REPO_ROOT = Path(__file__).resolve().parents[3]
_X_DATA_DIR = _REPO_ROOT / "apps" / "X" / "data"

_X_USERS_JSON_PATH = _X_DATA_DIR / "users.json"
_X_POSTS_JSON_PATH = _X_DATA_DIR / "posts.json"
_X_REPLIES_JSON_PATH = _X_DATA_DIR / "replies.json"

_X_USERS_JSON_CACHE: dict[str, dict[str, Any]] | None = None
_X_POSTS_JSON_CACHE: list[dict[str, Any]] | None = None
_X_POSTS_BY_ID_CACHE: dict[str, dict[str, Any]] | None = None
```

命名规则：

```text
路径常量统一放在文件顶部，避免每个 loader 重复拼 Path(__file__).resolve().parents[3]
公共 JSON 缓存用 *_JSON_CACHE / *_BY_ID_CACHE，明确表示来源是 apps/<App>/data/*.json
loader 使用 _load_users_json() / _load_posts_json() / _load_posts_by_id() 这类名字
不要用 *_DEFAULT_* / _load_default_* 表示公共 JSON；default/defaults 只表示 runtime 初始状态
不要从 defaults.json fallback 读取公共 base 表；缺少 base JSON 应显式返回空表或报错，由调用方决定如何处理
```

示例：

```python
# ✅ app.py 统一返回 view 口径候选，再用 runtime state 判定操作
post = reddit_init.find_view_post_by_title(title)
check = reddit_current.check_post_vote(post["id"], expected="up")

# ❌ task.py 直接读 apps/Reddit/data/posts.json
```

当 app.py 需要返回实体详情时，必须遵守 resolver 优先级：

```text
state.posts[id] object，且 basePosts[id] 存在 → 返回 state.posts[id]，表示对 base 实体的完整覆盖
state.posts[id] object，且 basePosts[id] 不存在 → 返回 state.posts[id]，表示 runtime 新增实体
state.posts[id] null → 返回 None / 不存在
state.posts 不含 id → 表示该 ID 没有 runtime 覆盖；view_post(id) 再去 basePosts[id] 读取该实体
```

## 九、defaults 与 getState 的职责边界

原则：

```text
defaults.json 应定义 reset 后需要持久存在、可初始化的 runtime truth。
__SIM__.getState().apps.<app> 的对外结构由 App 的 state.ts 负责定义。
如需裁剪内部字段或补充少量对外兼容字段，应在 state.ts 中通过 registerStateAdapter 实现。
getState 以 runtime truth 为主，不返回完整 view state。
```

getState 可包含的非 defaults 字段：

```text
对外兼容字段
  可由 registerStateAdapter 添加，但 bench 不应 setState 写这些字段。
  App action 不应同时维护兼容字段和真值字段。
  operate 判定不得依赖兼容字段，应读取关系 ID 列表等 runtime truth。

关系 count 字段
  如果 runtime truth 已有 followingIds / followerIds 等 ID 列表，
  followingCount / followerCount / user.following / user.followers 这类数量不应作为 raw getState 字段暴露。
  query / answer 需要数量时，由 view_user() / bench accessor / selector 读取 ID 列表后计算。

临时 UI/运行字段
  如 _temp、loading、toast、SDK 对象、currentView。
  可存在于 state.ts，但不作为外部可写契约。

运行后产生的查询结果
  如 railway directTrains、map searchResults。
  属于运行时结果，不要求出现在 defaults.json 中。
  若需要初始原始数据，应定义原始数据源，而不是在 defaults 中预填操作结果。
  操作后可由 action 写入 state.ts 管理的运行时字段。
  如果 bench 需要判定，字段必须稳定出现在 getState 中。
```

避免重复真相源：

```text
同一份业务实体不应在 getState 中额外暴露多套并行路径。

推荐结构：
  user.postIds / user.publishedNoteIds
    只表示当前用户拥有的实体 ID 和展示顺序。

  posts[id] / notes[id]
    保存 runtime 实体内容、base 完整覆盖或 tombstone。

  view_post(id) / view_note(id)
    表示模拟器前端 resolver/selector 与 bench accessor 共同遵守的展示口径，按 base fallback + runtime override/tombstone 返回完整展示实体。

不推荐再额外暴露：
  user.posts
  createdPosts
  myPosts
  其他与 posts[id] + user.postIds 表达同一事实的并行字段
```

也就是说，`defaults.posts → state.posts → getState.posts` 同名是合理的；问题在于同时再维护 `user.posts` / `createdPosts` 等第二份实体列表。用户索引只保存 ID，实体内容只保存在实体表或 view resolver 中。

## 十、多用户范围

第一阶段默认单当前用户沙盒。多用户不是另一套数据分层模型，只是在 runtime state 中引入多份用户配置和当前用户指针：

```json
{
  "currentUserId": "u1",
  "users": {
    "u1": {
      "id": "u1",
      "publishedNoteIds": ["note_u1_1"],
      "likedNoteIds": ["base_note_1"]
    },
    "u2": {
      "id": "u2",
      "publishedNoteIds": ["note_u2_1"],
      "likedNoteIds": []
    }
  },
  "notes": {
    "note_u1_1": { "id": "note_u1_1", "authorId": "u1", "title": "u1 的笔记" },
    "note_u2_1": { "id": "note_u2_1", "authorId": "u2", "title": "u2 的笔记" }
  }
}
```

原则：

```text
单用户时，user 可以直接表示当前用户。
多用户时，可扩展为 currentUserId + users[userId]。
posts / notes / comments 等 overlay 表仍是 App runtime 级实体表，可以保存多个用户的 runtime 实体。
实体是否属于某个用户，仍必须同时看用户索引和实体作者字段。
view_* 以 currentUserId 对应的用户关系作为展示上下文。
```

如果只是切换测试账号，也可以通过多份 `defaults.json` / 场景配置切换当前用户。

## 十一、持久化规则

如果 runtime state 中保存当前用户创建内容，就必须纳入持久化和 `getState()` 契约。

例如 Reddit 目标结构中应持久化：

```text
user
posts
comments
chatThreads
chatReplies
settings
```

不应持久化：

```text
createDraft
loader base data
UI 临时状态
SDK / DOM / 异步 loading 状态
```

如果 `state.posts` 存用户创建帖子，却在 `partialize` 中排除 `posts`，刷新后用户发帖会丢失，bench 初末状态也会不稳定。

## 十二、静态数据接口的后续演进

短期 workaround：

```text
defaults.json 存完整 runtime state schema
大 JSON 继续由 loader 和 bench app.py accessor 读取
bench operate 任务尽量只读 runtime state
```

中期目标：

```text
/api/sim-data/<app>/...
  提供 base dataset 查询和聚合视图

bench_env DataClient
  统一读取静态数据，不再直接读 apps/<App>/data/*.json
```

长期可选：

```text
大型 App 使用 SQLite 或独立 backend 管理 base dataset
runtime state 仍保持小而清晰
```

不建议第一阶段就让 `/api/sim-data` 取代 `getState()`。`getState()` 仍负责当前浏览器 page 的真实 runtime state；静态接口负责大数据查询。bench_env 可以在 Python 侧提供统一方法，把两者组合成一个任务友好的状态视图。

## 十三、Reddit 目标结构示例

目标 `defaults.json` 形态示例：

```json
{
  "user": {
    "username": "Embarrassed_Fee8630",
    "isOnline": true,
    "postIds": ["my_post_1"],
    "commentIds": ["uc_1", "uc_2"],
    "postVotes": {
      "public_post_7": "up"
    },
    "commentVotes": {},
    "joinedCommunityIds": ["com_games"],
    "savedPostIds": [],
    "followedUserIds": []
  },
  "posts": {
    "my_post_1": {
      "id": "my_post_1",
      "subreddit": "r/self",
      "author": "Embarrassed_Fee8630",
      "title": "有没有人也会半夜突然想整理房间？",
      "content": "明明很困了，但一想到明天事情多，就忍不住开始收拾桌面。",
      "upvotes": "1",
      "comments": "0",
      "shares": 0,
      "isAd": false,
      "url": ""
    }
  },
  "comments": {
    "uc_1": {
      "id": "uc_1",
      "postId": "sample_post_1",
      "author": "Embarrassed_Fee8630",
      "body": "补充一点：晚上早点放下手机真的有用。",
      "score": 1,
      "created_utc": 1710000002
    }
  },
  "chatThreads": {},
  "chatReplies": {},
  "settings": {}
}
```

展示聚合：

```ts
const homeFeed = [
  ...state.user.postIds.map(resolvePost),
  ...baseHomeFeed,
];

const myPosts = state.user.postIds.map(resolvePost).filter(Boolean);

const commentsForPost = [
  ...baseCommentsByPostId[postId],
  ...state.user.commentIds
    .map(id => state.comments[id])
    .filter(comment => comment?.postId === postId),
];
```

## 十四、现有 App 粗略归类

已较接近该方向：

- `Bilibili`：`defaults.user` 中已有 `likedVideoIds`、`followingList`、`favoritesFolders` 等用户关系数据，大视频数据外置。
- `X`：大数据外置，运行态有 `likedPostIds`、`retweetedPostIds`、`bookmarkedPostIds` 等关系索引，但目前位于顶层而非 `user` 下。
- `RedBook`：`defaults.user` 中已有 `likedNotes`、`collectedNotes`、`followingIds`、`publishedNoteIds` 等关系索引；但 loader 会 hydrate 大 `entities` 到 store，需要控制 `getState()` 输出大小。

需要优先调整：

- `Reddit`：Phase 1 后用户帖子和评论收口到顶层 `posts`、`comments`，由 `user.postIds`、`user.commentIds` 维护当前用户索引；后续仍需避免 loader 大帖子进入 runtime store。
- `Spotify`：`likedSongs` 存完整 track 对象，建议改为 `likedSongIds`，用户创建的 playlist 再存完整实体。
- `WechatReading`：`defaults.json` 包含较多公共内容数据，若继续增长，应拆分 base dataset 与 runtime state。

不急需调整：

- `Alipay`、`Wechat`、`TencentMeeting`、系统小工具等：数据量较小，`defaults.json` 作为完整 runtime state 基本可接受。

## 十五、迁移建议

以 Reddit 为第一优先级：

1. 将 `defaults.user` 扩展为用户关系索引容器：
   - `postIds`
   - `commentIds`
   - `postVotes`
   - `commentVotes`
   - `joinedCommunityIds`
   - `savedPostIds`
   - `followedUserIds`
2. 使用顶层 `posts: Record<string, RedditPost | null>` 表示 runtime 帖子覆盖和 tombstone。
3. 使用顶层 `comments: Record<string, Comment | null>` 表示 runtime 评论覆盖和 tombstone。
4. 保持聊天为顶层业务实体。
5. 避免把 `posts.json` 的全量帖子并入 runtime store。
6. UI 使用 `base posts + state.posts` 聚合展示，且遵守 state 优先和 tombstone 语义。
7. bench_env 的 Reddit accessor 默认返回 `view_*` 口径；operate 判定读 `user.*` 和 runtime 实体表；base 数据只在 accessor 内部用于构建 view 和搜索索引。
8. 修改 `partialize`，确保 `user`、`posts`、`comments`、聊天、settings 等 runtime 数据持久化。
9. 检查 `__SIM__.setState()` 的 deep merge 是否支持 `null` tombstone。
