import { NavigationDeclaration, ScrollContainerDeclaration } from './navigation.types';

const MAIN_SCROLL: ScrollContainerDeclaration[] = [
  { name: 'main', direction: 'vertical', description: '页面内容' },
];

const NO_SCROLL: ScrollContainerDeclaration[] = [];

export const NAVIGATION_DECLARATION = {
  app: 'bilibili',

  routes: [
    // =========================
    // 主 Tab 页面
    // =========================
    {
      path: '/',
      component: 'HomePage',
      params: {},
      entryPoint: 'home',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        { id: 'home.recommend', search: { tab: 'recommend' }, description: '推荐 Tab' },
        { id: 'home.live', search: { tab: 'live' }, description: '直播 Tab' },
        { id: 'home.hot', search: { tab: 'hot' }, description: '热门 Tab' },
        { id: 'home.anime', search: { tab: 'anime' }, description: '动画 Tab' },
        { id: 'home.anime.bangumiRanking', search: { tab: 'anime', animeRank: 'bangumi' }, description: '动画 Tab-番剧榜' },
        { id: 'home.anime.guochuangRanking', search: { tab: 'anime', animeRank: 'guochuang' }, description: '动画 Tab-国创榜' },
        { id: 'home.movie', search: { tab: 'movie' }, description: '影视 Tab' },
      ],
      queryParams: {},
      description: 'B站首页',
    },
    {
      path: '/following',
      component: 'FollowingPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        {
          id: 'following.tab.all',
          search: { tab: 'all' },
          description: '关注-全部',
          actions: [
            {
              id: 'following.recommendUp.follow.toggle',
              label: '关注-推荐UP：关注开关',
              behavior: 'toggle',
              scope: 'item',
              paramsSchema: { mid: 'string' },
            },
          ],
        },
        { id: 'following.tab.video', search: { tab: 'video' }, description: '关注-视频' },
      ],
      queryParams: {},
      description: '关注',
    },
    {
      path: '/shop',
      component: 'ShopPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'shop.base', search: {}, description: '会员购' }],
      queryParams: {},
      description: '会员购',
    },
    {
      path: '/me',
      component: 'MePage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'me.base', search: {}, description: '我的页面' }],
      queryParams: {},
      description: '我的',
    },

    // =========================
    // 视频详情页
    // =========================
    {
      path: '/video/:bvid',
      component: 'VideoDetailPage',
      params: { bvid: 'string' },
      entryPoint: 'deepLink',
      scrollContainers: [
        { name: 'main', direction: 'vertical', description: '主内容区' },
        { name: 'related', direction: 'horizontal', description: '相关推荐' },
      ],
      uiStates: [
        {
          id: 'video.intro',
          search: { tab: 'intro' },
          description: '简介 Tab',
          actions: [
            { id: 'video.intro.like.toggle', label: '视频-点赞：开关', behavior: 'toggle' },
            { id: 'video.intro.dislike.toggle', label: '视频-不喜欢：开关', behavior: 'toggle' },
            { id: 'video.intro.coin.open', label: '视频-投币弹窗：打开', behavior: 'other' },
            { id: 'video.intro.fav.toggle', label: '视频-收藏：开关', behavior: 'toggle' },
            { id: 'video.intro.fav.longPress', label: '视频-收藏：长按打开收藏夹', behavior: 'other' },
            // “关注”本身是原地动作；推荐面板是其 UI 子效应（不进入 URL，不形成图节点）
            {
              id: 'video.intro.follow.submit',
              label: '视频-关注：提交',
              behavior: 'submit',
              effects: [{ kind: 'localState.open', id: 'video.intro.suggestionsPanel' }],
            },
            {
              id: 'video.intro.suggestions.close',
              label: '视频-推荐面板：关闭',
              behavior: 'other',
              effects: [{ kind: 'localState.close', id: 'video.intro.suggestionsPanel' }],
            },
          ],
          localStates: [
            {
              id: 'video.intro.suggestionsPanel',
              description: '关注成功后出现的“你可能感兴趣”面板（不阻塞，可继续点击其它按钮）',
              blocking: false,
              // 与 history entry 绑定：push/back 仍保留；entry 被 pop 后（返回上一页再重新进）消失
              persistence: 'routeEntry',
              enterBy: [{ kind: 'action', id: 'video.intro.follow.submit' }],
              exitBy: [{ kind: 'action', id: 'video.intro.suggestions.close' }],
              notes:
                '只允许点击面板右侧 X 关闭；返回键应直接退出视频页；切换 Tab/进入用户主页/打开其它视频再返回仍保持（同一 entry）。',
            },
          ],
        },
        {
          id: 'video.comment',
          search: { tab: 'comment' },
          description: '评论 Tab',
          actions: [
            { id: 'video.comment.sort.toggle', label: '评论-排序：开关', behavior: 'toggle' },
          ],
        },
        { id: 'video.intro.menu', search: { tab: 'intro', menu: 'true' }, description: '简介 Tab + 用户菜单' },
        {
          id: 'video.intro.coinDialog',
          search: { tab: 'intro', coinDialog: 'open' },
          description: '投币弹窗',
          actions: [
            { id: 'video.intro.coinDialog.submit', label: '视频-投币弹窗：投币', behavior: 'submit' },
          ],
        },
      ],
      // 该页面当前不需要任何动态 query 参数：
      // - menu 的显示由 ?menu=true 控制
      // - 推荐面板属于本地子状态（localStates），不进入 URL
      // - 建议不要把 mid 写入 URL（避免图中出现大量 mid=:mid 的“可选维度”节点）
      queryParams: {},
      description: '视频详情',
    },

    // =========================
    // 用户空间
    // =========================
    {
      path: '/user/:mid',
      component: 'UserProfilePage',
      params: { mid: 'string' },
      entryPoint: 'deepLink',
      scrollContainers: MAIN_SCROLL,
      // 用户空间页的 Tab 状态是离散有限集合，必须写入 URL 并枚举
      // 说明：
      // - tab: 主页/动态/投稿/小店
      // - menu=true: 关注菜单（可回退关闭；为避免与 tab/suggestions 产生组合爆炸，menu 打开时会清除 tab/suggestions）
      uiStates: [
        {
          id: 'user.tab.home',
          search: { tab: 'home' },
          description: '用户空间-主页',
          actions: [
            // “关注”本身是原地动作；“你可能感兴趣”面板是其 UI 子效应（不进入 URL，不形成图节点）
            {
              id: 'user.home.follow.submit',
              label: '用户空间-关注：提交',
              behavior: 'submit',
              effects: [{ kind: 'localState.open', id: 'user.suggestionsPanel' }],
            },
            {
              id: 'user.home.suggestions.close',
              label: '用户空间-推荐面板：关闭',
              behavior: 'other',
              effects: [{ kind: 'localState.close', id: 'user.suggestionsPanel' }],
            },
          ],
          localStates: [
            {
              id: 'user.suggestionsPanel',
              description: '关注成功后出现的“你可能感兴趣”面板（不阻塞，可继续点击其它按钮）',
              blocking: false,
              persistence: 'routeEntry',
              enterBy: [
                { kind: 'action', id: 'user.home.follow.submit' },
                { kind: 'action', id: 'user.dynamic.follow.submit' },
                { kind: 'action', id: 'user.works.follow.submit' },
                { kind: 'action', id: 'user.shop.follow.submit' },
              ],
              exitBy: [
                { kind: 'action', id: 'user.home.suggestions.close' },
                { kind: 'action', id: 'user.dynamic.suggestions.close' },
                { kind: 'action', id: 'user.works.suggestions.close' },
                { kind: 'action', id: 'user.shop.suggestions.close' },
              ],
              notes: '只允许点击按钮关闭；返回键应直接退出用户空间；切换 Tab/打开其它页面再返回仍保持（同一 entry）。',
            },
          ],
        },
        {
          id: 'user.tab.dynamic',
          search: { tab: 'dynamic' },
          description: '用户空间-动态',
          actions: [
            {
              id: 'user.dynamic.follow.submit',
              label: '用户空间-关注：提交',
              behavior: 'submit',
              effects: [{ kind: 'localState.open', id: 'user.suggestionsPanel' }],
            },
            {
              id: 'user.dynamic.suggestions.close',
              label: '用户空间-推荐面板：关闭',
              behavior: 'other',
              effects: [{ kind: 'localState.close', id: 'user.suggestionsPanel' }],
            },
            { id: 'user.dynamic.like.toggle', label: '用户空间-动态点赞：开关', behavior: 'toggle' },
          ],
        },
        {
          id: 'user.tab.works',
          search: { tab: 'works' },
          description: '用户空间-投稿',
          actions: [
            {
              id: 'user.works.follow.submit',
              label: '用户空间-关注：提交',
              behavior: 'submit',
              effects: [{ kind: 'localState.open', id: 'user.suggestionsPanel' }],
            },
            {
              id: 'user.works.suggestions.close',
              label: '用户空间-推荐面板：关闭',
              behavior: 'other',
              effects: [{ kind: 'localState.close', id: 'user.suggestionsPanel' }],
            },
          ],
        },
        {
          id: 'user.tab.shop',
          search: { tab: 'shop' },
          description: '用户空间-小店',
          actions: [
            {
              id: 'user.shop.follow.submit',
              label: '用户空间-关注：提交',
              behavior: 'submit',
              effects: [{ kind: 'localState.open', id: 'user.suggestionsPanel' }],
            },
            {
              id: 'user.shop.suggestions.close',
              label: '用户空间-推荐面板：关闭',
              behavior: 'other',
              effects: [{ kind: 'localState.close', id: 'user.suggestionsPanel' }],
            },
          ],
        },

        { id: 'user.menu', search: { menu: 'true' }, description: '用户空间（关注菜单）' },
      ],
      queryParams: {},
      description: '用户空间',
    },
    {
      path: '/space',
      component: 'SpacePage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        { id: 'space.tab.home', search: { tab: 'home' }, description: '个人空间-主页' },
        { id: 'space.tab.videos', search: { tab: 'videos' }, description: '个人空间-投稿' },
        { id: 'space.tab.fav', search: { tab: 'fav' }, description: '个人空间-收藏' },
        { id: 'space.tab.anime', search: { tab: 'anime' }, description: '个人空间-追番' },
      ],
      queryParams: {},
      description: '个人空间（我的）',
    },

    // =========================
    // 搜索页
    // =========================
    {
      path: '/search',
      component: 'SearchPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      // 搜索首页：只有搜索框 + 热搜/历史/发现，不存在 Tab
      uiStates: [{ id: 'search.base', search: {}, description: '搜索首页' }],
      queryParams: {},
      description: '搜索（首页）',
    },
    {
      path: '/search/results',
      component: 'SearchPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      // 搜索结果页：出现 Tab，且必须带 q
      uiStates: [
        { id: 'searchResults.tab.comprehensive', search: { tab: 'comprehensive' }, description: '搜索结果-综合' },
        {
          id: 'searchResults.tab.anime',
          search: { tab: 'anime' },
          description: '搜索结果-番剧',
          actions: [
            {
              id: 'search.media.subscribe.toggle',
              label: '搜索-追番/追剧：开关',
              behavior: 'toggle',
              scope: 'item',
              paramsSchema: { id: 'string', type: 'string' },
            },
          ],
        },
        { id: 'searchResults.tab.live', search: { tab: 'live' }, description: '搜索结果-直播' },
        {
          id: 'searchResults.tab.user',
          search: { tab: 'user' },
          description: '搜索结果-用户',
          actions: [
            {
              id: 'search.user.follow.toggle',
              label: '搜索-用户关注：开关',
              behavior: 'toggle',
              scope: 'item',
              paramsSchema: { mid: 'string' },
            },
            { id: 'search.user.menu.open', label: '搜索-已关注菜单：打开', behavior: 'other' },
            { id: 'search.user.menu.close', label: '搜索-已关注菜单：关闭', behavior: 'other' },
          ],
        },
        { id: 'searchResults.tab.movie', search: { tab: 'movie' }, description: '搜索结果-影视' },
        { id: 'searchResults.tab.article', search: { tab: 'article' }, description: '搜索结果-图文' },
      ],
      queryParams: { q: 'string' },
      description: '搜索（结果页）',
    },

    // =========================
    // 分区页面
    // =========================
    {
      path: '/partitions',
      component: 'PartitionsPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'partitions.base', search: {}, description: '全部分区' }],
      queryParams: {},
      description: '全部分区',
    },
    {
      path: '/partitions/:label',
      component: 'PartitionDetailPage',
      params: { label: 'string' },
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'partition.base', search: {}, description: '分区详情' }],
      queryParams: {},
      description: '分区详情',
    },

    // =========================
    // 排行榜
    // =========================
    {
      path: '/ranking',
      component: 'RankingPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        { id: 'ranking.tab.all', search: { tab: '全站' }, description: '排行榜-全站' },
        { id: 'ranking.tab.bangumi', search: { tab: '番剧' }, description: '排行榜-番剧' },
        { id: 'ranking.tab.guochuang', search: { tab: '国创' }, description: '排行榜-国创' },
        { id: 'ranking.tab.documentary', search: { tab: '纪录片' }, description: '排行榜-纪录片' },
        { id: 'ranking.tab.movie', search: { tab: '电影' }, description: '排行榜-电影' },
        { id: 'ranking.tab.tv', search: { tab: '电视剧' }, description: '排行榜-电视剧' },
        { id: 'ranking.tab.animation', search: { tab: '动画' }, description: '排行榜-动画' },
        { id: 'ranking.tab.game', search: { tab: '游戏' }, description: '排行榜-游戏' },
        { id: 'ranking.tab.kichiku', search: { tab: '鬼畜' }, description: '排行榜-鬼畜' },
        { id: 'ranking.tab.music', search: { tab: '音乐' }, description: '排行榜-音乐' },
        { id: 'ranking.tab.dance', search: { tab: '舞蹈' }, description: '排行榜-舞蹈' },
        { id: 'ranking.tab.film', search: { tab: '影视' }, description: '排行榜-影视' },
        { id: 'ranking.tab.entertainment', search: { tab: '娱乐' }, description: '排行榜-娱乐' },
        { id: 'ranking.tab.knowledge', search: { tab: '知识' }, description: '排行榜-知识' },
        { id: 'ranking.tab.tech', search: { tab: '科技数码' }, description: '排行榜-科技数码' },
        { id: 'ranking.tab.food', search: { tab: '美食' }, description: '排行榜-美食' },
        { id: 'ranking.tab.car', search: { tab: '汽车' }, description: '排行榜-汽车' },
        { id: 'ranking.tab.fashion', search: { tab: '时尚美妆' }, description: '排行榜-时尚美妆' },
        { id: 'ranking.tab.sports', search: { tab: '体育运动' }, description: '排行榜-体育运动' },
        { id: 'ranking.tab.animal', search: { tab: '动物' }, description: '排行榜-动物' },
      ],
      queryParams: {},
      description: '排行榜',
    },

    // =========================
    // 个人资料编辑
    // =========================
    {
      path: '/profile/edit',
      component: 'ProfileEditPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'profileEdit.base', search: {}, description: '编辑资料' }],
      queryParams: {},
      description: '编辑资料',
    },
    {
      path: '/profile/edit/name',
      component: 'ProfileEditNamePage',
      params: {},
      entryPoint: 'none',
      scrollContainers: NO_SCROLL,
      uiStates: [{ id: 'profileEditName.base', search: {}, description: '编辑昵称' }],
      queryParams: {},
      description: '编辑昵称',
    },
    {
      path: '/profile/edit/sign',
      component: 'ProfileEditSignPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: NO_SCROLL,
      uiStates: [{ id: 'profileEditSign.base', search: {}, description: '编辑签名' }],
      queryParams: {},
      description: '编辑签名',
    },
    {
      path: '/profile/school',
      component: 'SchoolInfoPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'schoolInfo.base', search: {}, description: '学校信息' }],
      queryParams: {},
      description: '学校信息',
    },

    // =========================
    // 用户关系页面
    // =========================
    {
      path: '/profile/following',
      component: 'UserRelationPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      // “我的好友”页：关注/粉丝 Tab 是离散有限集合，必须写入 URL 并枚举
      // menu=true：操作菜单（可回退关闭；为避免组合爆炸，menu 打开时会清除 tab）
      uiStates: [
        { id: 'userRelation.tab.follow', search: { tab: 'follow' }, description: '我的好友-关注' },
        { id: 'userRelation.tab.fans', search: { tab: 'fans' }, description: '我的好友-粉丝' },
        { id: 'userRelation.menu', search: { menu: 'true' }, description: '我的好友（操作菜单）' },
      ],
      queryParams: {},
      description: '关注/粉丝列表',
    },
    {
      path: '/profile/likes',
      component: 'RecentLikesPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'recentLikes.base', search: {}, description: '最近点赞' }],
      queryParams: {},
      description: '最近点赞',
    },
    {
      path: '/favorites',
      component: 'FavoritesPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        { id: 'favorites.tab.folders', search: { tab: 'folders' }, description: '收藏-收藏夹' },
        { id: 'favorites.tab.all', search: { tab: 'all' }, description: '收藏-全部' },
        { id: 'favorites.tab.video', search: { tab: 'video' }, description: '收藏-视频' },
        { id: 'favorites.tab.article', search: { tab: 'article' }, description: '收藏-图文' },
      ],
      queryParams: {},
      description: '我的收藏',
    },
    {
      path: '/favorites/folder/:folderId',
      component: 'FavFolderDetailPage',
      params: { folderId: 'string' },
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'favFolderDetail.base', search: {}, description: '收藏夹详情（收藏页入口）' }],
      queryParams: {},
      description: '收藏夹详情（收藏页入口）',
    },
    {
      path: '/profile/fav/:folderId',
      component: 'FavoritesDetailPage',
      params: { folderId: 'string' },
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'favoritesDetail.base', search: {}, description: '收藏夹详情' }],
      queryParams: {},
      description: '收藏夹详情',
    },
    {
      path: '/fav/create',
      component: 'CreateFavFolderPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: NO_SCROLL,
      uiStates: [{ id: 'favCreate.base', search: {}, description: '新建收藏夹' }],
      queryParams: {},
      description: '新建收藏夹',
    },
    {
      path: '/vip',
      component: 'VipPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'vip.base', search: {}, description: '会员中心' }],
      queryParams: {},
      description: '会员中心',
    },
    {
      path: '/settings',
      component: 'SettingsPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'settings.base', search: {}, description: '设置' }],
      queryParams: {},
      description: '设置',
    },
    { path: '/settings/recommend', component: 'SettingsRecommendPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.recommend.base', search: {}, description: '首页推荐设置' }], queryParams: {}, description: '首页推荐设置' },
    { path: '/settings/language', component: 'SettingsLanguagePage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.language.base', search: {}, description: '语言' }], queryParams: {}, description: '语言' },
    { path: '/settings/avatar-entry', component: 'SettingsAvatarEntryPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.avatarEntry.base', search: {}, description: '首页头像入口设置' }], queryParams: {}, description: '首页头像入口设置' },
    { path: '/settings/playback', component: 'SettingsPlaybackPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.playback.base', search: {}, description: '播放设置' }], queryParams: {}, description: '播放设置' },
    { path: '/settings/playback/autoplay', component: 'SettingsPlaybackAutoplayPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.playback.autoplay.base', search: {}, description: '自动播放设置' }], queryParams: {}, description: '自动播放设置' },
    { path: '/settings/playback/autoplay-feed', component: 'SettingsPlaybackAutoplayFeedPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.playback.autoplayFeed.base', search: {}, description: '动态/活动页单列视频是否自动播放' }], queryParams: {}, description: '动态/活动页单列视频是否自动播放' },
    { path: '/settings/playback/autoplay-home', component: 'SettingsPlaybackAutoplayHomePage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.playback.autoplayHome.base', search: {}, description: '首页自动播放' }], queryParams: {}, description: '首页自动播放' },
    { path: '/settings/playback/portrait', component: 'SettingsPlaybackPortraitPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.playback.portrait.base', search: {}, description: '竖屏模式设置' }], queryParams: {}, description: '竖屏模式设置' },
    { path: '/settings/playback/pip', component: 'SettingsPlaybackPipPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.playback.pip.base', search: {}, description: '小窗播放/后台听视频设置' }], queryParams: {}, description: '小窗播放/后台听视频设置' },
    { path: '/settings/playback/danmaku', component: 'SettingsPlaybackDanmakuPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.playback.danmaku.base', search: {}, description: '弹幕/字幕设置' }], queryParams: {}, description: '弹幕/字幕设置' },
    { path: '/settings/playback/quality', component: 'SettingsPlaybackQualityPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.playback.quality.base', search: {}, description: '清晰度设置' }], queryParams: {}, description: '清晰度设置' },
    { path: '/settings/playback/other', component: 'SettingsPlaybackOtherPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.playback.other.base', search: {}, description: '其他设置(播放下)' }], queryParams: {}, description: '其他设置(播放下)' },
    { path: '/settings/offline', component: 'SettingsOfflinePage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.offline.base', search: {}, description: '离线设置' }], queryParams: {}, description: '离线设置' },
    { path: '/settings/chase', component: 'SettingsChasePage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.chase.base', search: {}, description: '追番/追剧设置' }], queryParams: {}, description: '追番/追剧设置' },
    { path: '/settings/push', component: 'SettingsPushPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.push.base', search: {}, description: '推送设置' }], queryParams: {}, description: '推送设置' },
    { path: '/settings/message', component: 'SettingsMessagePage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.message.base', search: {}, description: '消息设置' }], queryParams: {}, description: '消息设置' },
    { path: '/settings/message/reply-at', component: 'SettingsMessageReplyAtPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.message.replyAt.base', search: {}, description: '回复与@消息提醒' }], queryParams: {}, description: '回复与@消息提醒' },
    { path: '/settings/message/like', component: 'SettingsMessageLikePage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.message.like.base', search: {}, description: '收到喜欢消息提醒' }], queryParams: {}, description: '收到喜欢消息提醒' },
    { path: '/settings/message/fan', component: 'SettingsMessageFanPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.message.fan.base', search: {}, description: '新增粉丝消息提醒' }], queryParams: {}, description: '新增粉丝消息提醒' },
    { path: '/settings/message/support', component: 'SettingsSupportPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.message.support.base', search: {}, description: '应援团' }], queryParams: {}, description: '应援团' },
    { path: '/settings/message/unfollow', component: 'SettingsUnfollowPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.message.unfollow.base', search: {}, description: '未关注人消息' }], queryParams: {}, description: '未关注人消息' },
    { path: '/settings/harass', component: 'SettingsHarassPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.harass.base', search: {}, description: '防骚扰和互动人群设置' }], queryParams: {}, description: '防骚扰和互动人群设置' },
    { path: '/settings/storage', component: 'SettingsStoragePage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.storage.base', search: {}, description: '清理存储空间' }], queryParams: {}, description: '清理存储空间' },
    { path: '/settings/other', component: 'SettingsOtherPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.other.base', search: {}, description: '其他设置(主)' }], queryParams: {}, description: '其他设置(主)' },
    { path: '/settings/other/watermark', component: 'SettingsWatermarkPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.other.watermark.base', search: {}, description: '图片水印设置' }], queryParams: {}, description: '图片水印设置' },
    { path: '/settings/other/image-quality', component: 'SettingsImageQualityPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.other.imageQuality.base', search: {}, description: '默认图片质量' }], queryParams: {}, description: '默认图片质量' },
    { path: '/settings/timer', component: 'SettingsTimerPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.timer.base', search: {}, description: '定时关闭' }], queryParams: {}, description: '定时关闭' },
    { path: '/settings/sleep', component: 'SettingsSleepPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL, uiStates: [{ id: 'settings.sleep.base', search: {}, description: '睡眠提醒' }], queryParams: {}, description: '睡眠提醒' },
  ],

  transitions: [
    // =========================
    // 会员中心
    // =========================
    {
      id: 'vip.open',
      from: '/me',
      to: '/vip',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开会员中心',
      ui: { placement: 'content', icon: 'vip', gesture: 'tap' },
    },
    {
      id: 'vip.pay.confirm',
      from: '/vip',
      to: '/vip',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '会员中心-确认协议并支付',
      ui: { placement: 'content', icon: 'vip_pay', gesture: 'tap' },
    },
    {
      id: 'vip.pay.submit',
      from: '/vip',
      to: '/vip',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '会员中心-支付并开通',
      ui: { placement: 'content', icon: 'vip_pay_submit', gesture: 'tap' },
    },
    // =========================
    // 底部 Tab 切换
    // =========================
    {
      id: 'tab.home',
      from: [{ path: '/following', search: { tab: '*' } }, '/shop', '/me'],
      to: '/',
      search: { tab: 'recommend' },
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到首页',
      ui: { placement: 'tabbar', icon: 'tab_home', gesture: 'tap' },
    },
    {
      id: 'tab.following',
      from: [{ path: '/', search: { tab: '*' } }, '/shop', '/me'],
      to: '/following',
      // 默认进入“全部”，但如果用户已经在关注页切到“视频”，
      // 回到主 Tab 时允许“恢复到视频”（依赖访问记忆/主 Tab 常驻）。
      // 这里用 cases 表达语义：边仍会出现在图中，但会被标注为 requires_prior_visit。
      search: { tab: 'all' },
      searchParams: {},
      cases: [
        {
          when: { op: 'eq', left: { ref: 'param', key: 'tab' }, right: 'video' },
          to: '/following',
          search: { tab: 'video' },
          availability: 'requires_prior_visit',
          availabilityNote:
            '仅当用户此前在关注页切换到“视频”，且主 Tab 常驻/存在访问记忆时，回到“关注”可直接恢复到视频。',
        },
        { when: { op: 'always' }, to: '/following', search: { tab: 'all' } },
      ],
      mode: 'replace',
      params: {},
      label: '切换到关注',
      ui: { placement: 'tabbar', icon: 'tab_following', gesture: 'tap' },
    },
    {
      id: 'tab.shop',
      from: [{ path: '/', search: { tab: '*' } }, { path: '/following', search: { tab: '*' } }, '/me'],
      to: '/shop',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到会员购',
      ui: { placement: 'tabbar', icon: 'tab_shop', gesture: 'tap' },
    },
    {
      id: 'tab.me',
      from: [{ path: '/', search: { tab: '*' } }, { path: '/following', search: { tab: '*' } }, '/shop'],
      to: '/me',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到我的',
      ui: { placement: 'tabbar', icon: 'tab_me', gesture: 'tap' },
    },

    // =========================
    // 首页内 Tab 切换
    // =========================
    {
      id: 'home.tab.switch',
      from: { path: '/', search: { tab: '*' } },
      to: '/',
      search: {},
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换首页 Tab',
      ui: { placement: 'content', icon: 'home_tab', gesture: 'tap' },
    },
    {
      id: 'home.anime.ranking.switch',
      from: { path: '/', search: { tab: 'anime' } },
      to: '/',
      search: { tab: 'anime' },
      searchParams: { animeRank: 'string' },
      mode: 'replace',
      params: {},
      label: '切换动画页排行榜',
      ui: { placement: 'content', icon: 'anime_ranking_tab', gesture: 'tap' },
    },

    // =========================
    // 关注页内 Tab 切换
    // =========================
    {
      id: 'following.tab.switch',
      from: [
        { path: '/following', search: { tab: 'all' } },
        { path: '/following', search: { tab: 'video' } },
      ],
      to: '/following',
      search: {},
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换关注 Tab',
      ui: { placement: 'content', icon: 'following_tab', gesture: 'tap' },
    },

    // =========================
    // 视频相关
    // =========================
    {
      id: 'video.open',
      from: [
        { path: '/', search: { tab: 'recommend' } },
        { path: '/', search: { tab: 'hot' } },
        { path: '/', search: { tab: 'anime' } },
        { path: '/', search: { tab: 'movie' } },
        { path: '/following', search: { tab: '*' } },
        { path: '/user/:mid', search: { tab: '*' } },
        { path: '/user/:mid', search: { menu: 'true' } },
        { path: '/ranking', search: { tab: '*' } },
        { path: '/search/results', search: { tab: '*' } },
        '/partitions/:label',
        '/profile/fav/:folderId',
        '/favorites/folder/:folderId',
        '/profile/likes',
        { path: '/space', search: { tab: '*' } },
        { path: '/favorites', search: { tab: '*' } },
      ],
      to: '/video/:bvid',
      search: { tab: 'intro' },
      searchParams: {},
      mode: 'push',
      params: { bvid: 'string' },
      label: '打开视频',
      ui: { placement: 'content', icon: 'video', gesture: 'tap' },
    },
    {
      id: 'video.open.fromVideo',
      from: [
        { path: '/video/:bvid', search: { tab: 'intro' } },
        { path: '/video/:bvid', search: { tab: 'comment' } },
        { path: '/video/:bvid', search: { tab: 'intro', menu: 'true' } },
      ],
      to: '/video/:bvid',
      search: { tab: 'intro' },
      searchParams: {},
      mode: 'push',
      params: { bvid: 'string' },
      label: '打开相关视频',
      ui: { placement: 'content', icon: 'video_related', gesture: 'tap' },
    },
    {
      id: 'video.tab.switch',
      // Tab 切换入口在顶部 Tab 栏；当 menu overlay 打开时该入口不可点击（被遮挡），
      // 因此必须把 from 收紧，避免生成“menu=true 时仍可切到评论”的不可达边。
      from: [
        { path: '/video/:bvid', search: { tab: 'intro', menu: null } },
        { path: '/video/:bvid', search: { tab: 'comment', menu: null } },
      ],
      to: '/video/:bvid',
      // 切换 Tab 时必须关闭 menu（入口会被遮挡，且不应产生 tab=comment&menu=true 组合）。
      // 推荐面板是本地子状态（localStates），不通过 URL 表示，因此这里无需处理 suggestions。
      search: { menu: null },
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换视频 Tab',
      ui: { placement: 'content', icon: 'video_tab', gesture: 'tap' },
    },
    {
      id: 'video.menu.open',
      // 用户菜单仅在简介 Tab 可打开（避免 tab=comment + menu=true 这类未声明组合）
      from: { path: '/video/:bvid', search: { tab: 'intro', menu: null, coinDialog: null } },
      to: '/video/:bvid',
      search: { tab: 'intro', menu: 'true' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开用户菜单',
      ui: { placement: 'content', icon: 'video_menu', gesture: 'tap' },
    },
    {
      id: 'video.coinDialog.open',
      from: { path: '/video/:bvid', search: { tab: 'intro', coinDialog: null, menu: null } },
      to: '/video/:bvid',
      search: { tab: 'intro', coinDialog: 'open' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开投币弹窗',
      ui: { placement: 'content', icon: 'coin', gesture: 'tap' },
    },

    // =========================
    // 用户空间
    // =========================
    {
      id: 'user.open',
      from: [
        { path: '/video/:bvid', search: { tab: 'intro' } },
        { path: '/video/:bvid', search: { tab: 'comment' } },
        { path: '/video/:bvid', search: { tab: 'intro', menu: 'true' } },
        { path: '/following', search: { tab: '*' } },
        { path: '/search/results', search: { tab: '*' } },
        { path: '/user/:mid', search: { tab: '*' } },
        { path: '/user/:mid', search: { menu: 'true' } },
        // “我的好友”页必须带 tab（follow/fans）或 menu=true；这里仅允许从 tab 状态打开用户，避免生成无入度占位节点
        { path: '/profile/following', search: { tab: 'follow' } },
        { path: '/profile/following', search: { tab: 'fans' } },
      ],
      to: '/user/:mid',
      // 用户空间的 tab 是必需离散状态：默认进入“投稿”
      search: { tab: 'works' },
      searchParams: {},
      mode: 'push',
      params: { mid: 'string' },
      label: '打开用户空间',
      ui: { placement: 'content', icon: 'user', gesture: 'tap' },
    },
    {
      id: 'user.tab.switch',
      // Tab 切换入口在页面内 Tab 栏；menu 打开时入口被遮挡，因此 from 需排除 menu=true
      from: [
        { path: '/user/:mid', search: { tab: 'home', menu: null } },
        { path: '/user/:mid', search: { tab: 'dynamic', menu: null } },
        { path: '/user/:mid', search: { tab: 'works', menu: null } },
        { path: '/user/:mid', search: { tab: 'shop', menu: null } },
      ],
      to: '/user/:mid',
      // 切换 Tab 时关闭离散 overlay（menu），避免生成未声明组合
      search: { menu: null },
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换用户空间 Tab',
      ui: { placement: 'content', icon: 'user_tab', gesture: 'tap' },
    },
    {
      id: 'user.menu.open',
      // menu 打开时是全屏 overlay，tab/suggestions 的值不影响可见动作集合，因此这里统一清除它们
      from: { path: '/user/:mid', search: { tab: '*', menu: null } },
      to: '/user/:mid',
      search: { menu: 'true', tab: null },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开关注菜单',
      ui: { placement: 'content', icon: 'user_menu', gesture: 'tap' },
    },
    {
      id: 'space.open',
      from: '/me',
      to: '/space',
      // “我的空间”页的 tab 是离散有限集合：默认进入“主页”
      search: { tab: 'home' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开我的空间',
      ui: { placement: 'content', icon: 'space', gesture: 'tap' },
    },
    {
      id: 'space.tab.switch',
      from: { path: '/space', search: { tab: '*' } },
      to: '/space',
      search: {},
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换我的空间 Tab',
      ui: { placement: 'content', icon: 'space_tab', gesture: 'tap' },
    },

    // =========================
    // 搜索
    // =========================
    {
      id: 'search.open',
      from: { path: '/', search: { tab: '*' } },
      to: '/search',
      // 搜索首页不带 tab/q
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开搜索',
      ui: { placement: 'topbar', icon: 'search', gesture: 'tap' },
    },
    {
      id: 'search.results.open',
      from: '/search',
      to: '/search/results',
      // 进入结果页必须有 tab（默认综合）
      search: { tab: 'comprehensive' },
      searchParams: { q: 'string' },
      mode: 'push',
      params: {},
      label: '执行搜索（进入结果页）',
      ui: { placement: 'topbar', icon: 'search_submit', gesture: 'tap' },
    },
    {
      id: 'search.results.tab.switch',
      from: { path: '/search/results', search: { tab: '*' } },
      to: '/search/results',
      preserveParams: ['q'],
      search: {},
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换搜索结果 Tab',
      ui: { placement: 'content', icon: 'search_tab', gesture: 'tap' },
    },
    {
      id: 'search.results.query.submit',
      from: { path: '/search/results', search: { tab: '*' } },
      to: '/search/results',
      preserveParams: ['tab'],
      search: {},
      searchParams: { q: 'string' },
      mode: 'replace',
      params: {},
      label: '搜索结果页-更换关键词',
      ui: { placement: 'topbar', icon: 'search_submit', gesture: 'tap' },
    },
    {
      id: 'search.results.close',
      from: { path: '/search/results', search: { tab: '*' } },
      to: '/search',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '退出搜索结果（回到搜索首页）',
      ui: { placement: 'topbar', icon: 'search_clear', gesture: 'tap' },
    },

    // =========================
    // 分区
    // =========================
    {
      id: 'partitions.open',
      from: { path: '/', search: { tab: '*' } },
      to: '/partitions',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开全部分区',
      ui: { placement: 'content', icon: 'partitions', gesture: 'tap' },
    },
    {
      id: 'partition.open',
      from: '/partitions',
      to: '/partitions/:label',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { label: 'string' },
      label: '打开分区详情',
      ui: { placement: 'content', icon: 'partition', gesture: 'tap' },
    },
    {
      id: 'home.movie.partition.open',
      from: { path: '/', search: { tab: 'movie' } },
      to: '/partitions/:label',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { label: 'string' },
      label: '影视页打开分区详情',
      ui: { placement: 'content', icon: 'partition', gesture: 'tap' },
    },
    {
      id: 'home.anime.partition.open',
      from: { path: '/', search: { tab: 'anime' } },
      to: '/partitions/:label',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { label: 'string' },
      label: '动画页打开分区详情',
      ui: { placement: 'content', icon: 'partition', gesture: 'tap' },
    },

    // =========================
    // 排行榜
    // =========================
    {
      id: 'ranking.open',
      from: [{ path: '/', search: { tab: 'hot' } }, '/partitions'],
      to: '/ranking',
      search: { tab: '全站' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开排行榜',
      ui: { placement: 'content', icon: 'ranking', gesture: 'tap' },
    },
    {
      id: 'ranking.tab.switch',
      from: { path: '/ranking', search: { tab: '*' } },
      to: '/ranking',
      search: {},
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换排行榜分区',
      ui: { placement: 'content', icon: 'ranking_tab', gesture: 'tap' },
    },

    // =========================
    // 个人资料编辑
    // =========================
    {
      id: 'profileEdit.open',
      from: ['/me', { path: '/space', search: { tab: '*' } }],
      to: '/profile/edit',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '编辑资料',
      ui: { placement: 'content', icon: 'profile_edit', gesture: 'tap' },
    },
    {
      id: 'profileEditName.open',
      from: '/profile/edit',
      to: '/profile/edit/name',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '编辑昵称',
      ui: { placement: 'content', icon: 'profile_edit_name', gesture: 'tap' },
    },
    {
      id: 'profileEditSign.open',
      from: '/profile/edit',
      to: '/profile/edit/sign',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '编辑签名',
      ui: { placement: 'content', icon: 'profile_edit_sign', gesture: 'tap' },
    },
    {
      id: 'schoolInfo.open',
      from: { path: '/space', search: { tab: '*' } },
      to: '/profile/school',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '学校信息',
      ui: { placement: 'content', icon: 'school_info', gesture: 'tap' },
    },

    // =========================
    // 用户关系
    // =========================
    {
      id: 'userRelation.open',
      from: ['/me', { path: '/space', search: { tab: '*' } }],
      to: '/profile/following',
      // “我的好友”页必须带 tab，由入口显式传入 follow/fans，避免粉丝入口落到默认关注页。
      search: {},
      searchParams: { tab: 'string' },
      mode: 'push',
      params: {},
      label: '关注/粉丝列表',
      ui: { placement: 'content', icon: 'user_relation', gesture: 'tap' },
    },
    {
      id: 'userRelation.tab.switch',
      from: [
        { path: '/profile/following', search: { tab: 'follow' } },
        { path: '/profile/following', search: { tab: 'fans' } },
      ],
      to: '/profile/following',
      // 切换 Tab 时关闭菜单（避免组合）
      search: { menu: null },
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换我的好友 Tab',
      ui: { placement: 'content', icon: 'user_relation_tab', gesture: 'tap' },
    },
    {
      id: 'userRelation.menu.open',
      from: { path: '/profile/following', search: { tab: '*', menu: null } },
      to: '/profile/following',
      // menu 打开时是全屏 overlay，因此清除 tab，避免产生 tab+menu 组合状态
      search: { menu: 'true', tab: null },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开好友操作菜单',
      ui: { placement: 'content', icon: 'user_relation_menu', gesture: 'tap' },
    },
    {
      id: 'recentLikes.open',
      from: { path: '/space', search: { tab: '*' } },
      to: '/profile/likes',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '最近点赞',
      ui: { placement: 'content', icon: 'recent_likes', gesture: 'tap' },
    },
    {
      id: 'favorites.open',
      from: '/me',
      to: '/favorites',
      search: { tab: 'folders' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '我的收藏',
      ui: { placement: 'content', icon: 'favorites', gesture: 'tap' },
    },
    {
      id: 'favorites.tab.switch',
      from: { path: '/favorites', search: { tab: '*' } },
      to: '/favorites',
      search: {},
      searchParams: { tab: 'string' },
      mode: 'replace',
      params: {},
      label: '切换收藏 Tab',
      ui: { placement: 'content', icon: 'favorites_tab', gesture: 'tap' },
    },
    {
      id: 'favFolderDetail.open',
      from: { path: '/favorites', search: { tab: '*' } },
      to: '/favorites/folder/:folderId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { folderId: 'string' },
      label: '收藏页-收藏夹详情',
      ui: { placement: 'content', icon: 'favorites_detail', gesture: 'tap' },
    },
    {
      id: 'favoritesDetail.open',
      from: { path: '/space', search: { tab: '*' } },
      to: '/profile/fav/:folderId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { folderId: 'string' },
      label: '收藏夹详情',
      ui: { placement: 'content', icon: 'favorites_detail', gesture: 'tap' },
    },

    // =========================
    // 新建收藏夹
    // =========================
    {
      id: 'favCreate.open',
      from: { path: '/video/:bvid', search: { tab: '*' } },
      to: '/fav/create',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '新建收藏夹',
      ui: { placement: 'content', icon: 'fav_create', gesture: 'tap' },
    },

    // =========================
    // 设置
    // =========================
    {
      id: 'settings.open',
      from: '/me',
      to: '/settings',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开设置',
      ui: { placement: 'content', icon: 'settings', gesture: 'tap' },
    },
    { id: 'settings.recommend.open', from: '/settings', to: '/settings/recommend', search: {}, searchParams: {}, mode: 'push', params: {}, label: '首页推荐设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.language.open', from: '/settings', to: '/settings/language', search: {}, searchParams: {}, mode: 'push', params: {}, label: '语言', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.profileEdit.open', from: '/settings', to: '/profile/edit', search: {}, searchParams: {}, mode: 'push', params: {}, label: '账号资料', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.avatarEntry.open', from: '/settings', to: '/settings/avatar-entry', search: {}, searchParams: {}, mode: 'push', params: {}, label: '首页头像入口设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.playback.open', from: '/settings', to: '/settings/playback', search: {}, searchParams: {}, mode: 'push', params: {}, label: '播放设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.offline.open', from: '/settings', to: '/settings/offline', search: {}, searchParams: {}, mode: 'push', params: {}, label: '离线设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.chase.open', from: '/settings', to: '/settings/chase', search: {}, searchParams: {}, mode: 'push', params: {}, label: '追番/追剧设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.push.open', from: '/settings', to: '/settings/push', search: {}, searchParams: {}, mode: 'push', params: {}, label: '推送设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.message.open', from: '/settings', to: '/settings/message', search: {}, searchParams: {}, mode: 'push', params: {}, label: '消息设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.harass.open', from: '/settings', to: '/settings/harass', search: {}, searchParams: {}, mode: 'push', params: {}, label: '防骚扰和互动人群设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.storage.open', from: '/settings', to: '/settings/storage', search: {}, searchParams: {}, mode: 'push', params: {}, label: '清理存储空间', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.other.open', from: '/settings', to: '/settings/other', search: {}, searchParams: {}, mode: 'push', params: {}, label: '其他设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.timer.open', from: '/settings', to: '/settings/timer', search: {}, searchParams: {}, mode: 'push', params: {}, label: '定时关闭', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.sleep.open', from: '/settings', to: '/settings/sleep', search: {}, searchParams: {}, mode: 'push', params: {}, label: '睡眠提醒', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.playback.autoplay.open', from: '/settings/playback', to: '/settings/playback/autoplay', search: {}, searchParams: {}, mode: 'push', params: {}, label: '自动播放设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.playback.portrait.open', from: '/settings/playback', to: '/settings/playback/portrait', search: {}, searchParams: {}, mode: 'push', params: {}, label: '竖屏模式设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.playback.pip.open', from: '/settings/playback', to: '/settings/playback/pip', search: {}, searchParams: {}, mode: 'push', params: {}, label: '小窗播放/后台听视频设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.playback.danmaku.open', from: '/settings/playback', to: '/settings/playback/danmaku', search: {}, searchParams: {}, mode: 'push', params: {}, label: '弹幕/字幕设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.playback.quality.open', from: '/settings/playback', to: '/settings/playback/quality', search: {}, searchParams: {}, mode: 'push', params: {}, label: '清晰度设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.playback.other.open', from: '/settings/playback', to: '/settings/playback/other', search: {}, searchParams: {}, mode: 'push', params: {}, label: '其他设置(播放下)', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.playback.autoplay.feed.open', from: '/settings/playback/autoplay', to: '/settings/playback/autoplay-feed', search: {}, searchParams: {}, mode: 'push', params: {}, label: '动态/活动页单列视频是否自动播放', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.playback.autoplay.home.open', from: '/settings/playback/autoplay', to: '/settings/playback/autoplay-home', search: {}, searchParams: {}, mode: 'push', params: {}, label: '首页自动播放', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.message.replyAt.open', from: '/settings/message', to: '/settings/message/reply-at', search: {}, searchParams: {}, mode: 'push', params: {}, label: '回复与@消息提醒', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.message.like.open', from: '/settings/message', to: '/settings/message/like', search: {}, searchParams: {}, mode: 'push', params: {}, label: '收到喜欢消息提醒', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.message.fan.open', from: '/settings/message', to: '/settings/message/fan', search: {}, searchParams: {}, mode: 'push', params: {}, label: '新增粉丝消息提醒', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.message.support.open', from: '/settings/message', to: '/settings/message/support', search: {}, searchParams: {}, mode: 'push', params: {}, label: '应援团', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.message.unfollow.open', from: '/settings/message', to: '/settings/message/unfollow', search: {}, searchParams: {}, mode: 'push', params: {}, label: '未关注人消息', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.other.watermark.open', from: '/settings/other', to: '/settings/other/watermark', search: {}, searchParams: {}, mode: 'push', params: {}, label: '图片水印设置', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
    { id: 'settings.other.imageQuality.open', from: '/settings/other', to: '/settings/other/image-quality', search: {}, searchParams: {}, mode: 'push', params: {}, label: '默认图片质量', ui: { placement: 'content', icon: 'settings', gesture: 'tap' } },
  ],

  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;

export type TransitionId = (typeof NAVIGATION_DECLARATION.transitions)[number]['id'];
