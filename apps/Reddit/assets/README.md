# Reddit 静态资源目录

将 Reddit 应用所需的图片等资源放在对应子目录下，路径以 `/reddit/` 为前缀（对应 `public/reddit/`）。

## 目录说明

- **icons/** — 顶部 Home 菜单、抽屉菜单、社区头像等图标  
  - 建议：`home.png`, `popular.png`, `watch.png`, `latest.png`, `news.png`, `drawer_menu.png`, `funny.png`, `pics.png`, `create_community.png`, `custom_feeds.png`, `all.png`, `image_001.png`～`image_006.png` 等
- **others/** — 聊天欢迎图、收件箱空状态、Community spotlights 大图  
  - 建议：`chat_welcome.png`, `inbox_empty.png`, `spotlight_001.png`～`spotlight_006.png`
- **raw_images/basic/** — 默认社区图标等  
  - 建议：`icon_communities.png`
- **avatars/** — 用户/作者头像  
  - 与 `reddit_data.json` 中 `authorAvatar` 路径一致
- **posts/** — 帖子配图  
  - 与 `reddit_data.json` 中 `image` 路径一致（本地路径如 `/reddit/posts/post_xxx.png`）

缺少图片时，界面会隐藏该元素或使用占位/兜底图标（如 Lucide 图标）。
