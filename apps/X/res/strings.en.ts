import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  app_name: 'X',

  // —— Home ————————————————————————————————————————————————————————————————
  home_tab_foryou: 'For you',
  home_tab_following: 'Following',
  home_follow_button: 'Follow',

  // —— Search / Explore ————————————————————————————————————————————————————
  search_placeholder: 'Search',
  search_tab_foryou: 'For you',
  search_tab_trending: 'Trending',
  search_tab_news: 'News',
  search_tab_sports: 'Sports',
  search_tab_entertainment: 'Entertainment',
  search_news_empty: 'Nothing here yet, for now.',
  search_sports_schedule: 'Schedule',
  search_sports_standings: 'Standings',
  search_sports_news: 'News',
  search_sports_full_schedule: 'Full schedule ->',
  search_global_trends_title: 'Global trends',
  search_global_trends_subtitle: 'Most popular posts',
  search_global_trends_explore: 'Explore',

  // —— Search Input ————————————————————————————————————————————————————————
  search_input_placeholder: 'Search',
  search_input_cancel: 'Cancel',
  search_results_title: 'Search results',
  search_results_user_count_suffix: ' users',
  search_results_empty: 'No users found',
  search_recent_title: 'Recent searches',
  search_input_tab_hot: 'Top',
  search_input_tab_latest: 'Latest',
  search_input_tab_people: 'People',
  search_input_tab_video: 'Videos',
  search_input_tab_photo: 'Photos',
  search_view_all: 'View all',

  // —— Notifications ———————————————————————————————————————————————————————
  notifications_title: 'Notifications',
  notifications_tab_all: 'All',
  notifications_tab_verified: 'Verified',
  notifications_tab_mentions: 'Mentions',
  notifications_empty: 'No notifications yet',

  // —— Messages ————————————————————————————————————————————————————————————
  messages_title_chat: 'Chats',
  messages_title_connecting: 'Connecting',
  messages_search_placeholder: 'Search Direct Messages',
  messages_tab_all: 'All',
  messages_tab_unread: 'Unread',
  messages_tab_groups: 'Groups',
  messages_tab_requests: 'Requests',
  messages_last_message_me_prefix: 'You: ',
  messages_requests_empty_title: 'Your message requests are empty',
  messages_requests_empty_desc: 'Direct messages or group messages from people you do not follow will show up here. You can accept or delete them.',
  messages_groups_empty_title: 'No group chats yet',
  messages_groups_empty_desc: 'Create a group and start an end-to-end encrypted chat',
  messages_unread_empty_title: "You're all caught up!",
  messages_unread_empty_desc: 'Unread conversations will appear here',
  messages_all_empty_title: 'No chats yet',
  messages_all_empty_desc: 'Start an end-to-end encrypted chat',

  // —— Chat ————————————————————————————————————————————————————————————————
  chat_not_found: 'Conversation not found',
  chat_back: 'Back',
  chat_joined_prefix: 'Joined ',
  chat_input_placeholder: 'Start a new message',
  chat_send_aria_label: 'Send',

  // —— Compose ————————————————————————————————————————————————————————————
  compose_cancel: 'Cancel',
  compose_submit: 'Post',
  compose_placeholder: "What's happening?",
  compose_reply_permission: 'Everyone can reply',

  // —— Reply ———————————————————————————————————————————————————————————————
  reply_title: 'Reply',
  reply_cancel: 'Cancel',
  reply_submit: 'Post',
  reply_not_found: 'Post not found',
  reply_placeholder: 'Post your reply',
  reply_to_prefix: 'Replying to ',

  // —— Post Details / Activity ———————————————————————————————————————————
  post_title: 'Post',
  post_not_found: 'Post not found',
  post_views_suffix: 'views',
  post_view_quotes: 'View quotes',
  post_loading_replies: 'Loading replies…',
  post_no_replies: 'No replies yet',
  post_sort_replies: 'Sort replies',
  post_sort_quotes: 'Sort quotes',
  post_sort_relevant: 'Relevant',
  post_sort_recent: 'Recent',
  post_sort_likes: 'Likes',
  post_sort_popular: 'Popular',
  post_reply_placeholder: 'Post your reply',
  post_activity_title: 'Post activity',

  // —— Profile ————————————————————————————————————————————————————————————
  profile_edit_button: 'Edit profile',
  profile_following_label: 'Following',
  profile_followers_label: 'Followers',
  profile_tab_posts: 'Posts',
  profile_tab_replies: 'Replies',
  profile_tab_subs: 'Subscriptions',
  profile_tab_videos: 'Videos',
  profile_tab_photos: 'Photos',
  profile_tab_articles: 'Articles',
  profile_subs_unlock_title: 'Unlock more with subscriptions',
  profile_subs_unlock_desc: 'Share your exclusive posts and rewards. Start a subscription.',
  profile_subs_unlock_button: 'Start subscription',
  profile_articles_empty_title: 'No articles yet',
  profile_articles_empty_desc: 'Articles you publish will show up here.',
  profile_videos_empty: 'No videos yet',
  profile_photos_empty: 'No photos yet',
  profile_content_empty: 'No content yet',
  profile_content_empty_desc: 'When you post, it will show up here.',
  profile_replies_empty: 'No replies yet',

  // —— UserProfile ——————————————————————————————————————————————————————————
  user_not_found_title: 'User not found',
  user_not_found_desc: 'This user could not be found',
  user_follow_button: 'Follow',
  user_following_button: 'Following',
  user_subs_unlock_title: 'Unlock more with subscriptions',
  user_subs_unlock_desc_tpl: 'shared 0 subscriber-exclusive posts. Subscribe to see their exclusive posts and rewards.',
  user_articles_empty_title: 'No articles yet',
  user_articles_empty_desc_tpl: 'publishes articles, they will show up here.',
  user_videos_empty: 'No videos yet',
  user_photos_empty: 'No photos yet',
  user_content_empty: 'No content yet',
  user_replies_empty: 'No replies yet',

  // —— UserProfile Follow Menu ————————————————————————————————————————————
  follow_menu_subscribe: 'Subscribe',
  follow_menu_subscribe_desc: 'Get exclusive content and badge',
  follow_menu_notifications: 'Turn on notifications',
  follow_menu_notifications_desc: "Don't miss any posts",
  follow_menu_unfollow: 'Unfollow',
  follow_menu_close_aria_label: 'Close',

  // —— UserConnections —————————————————————————————————————————————————————
  connections_tab_following: 'Following',
  connections_tab_followers: 'Followers',
  connections_follow_button: 'Follow',
  connections_following_button: 'Following',
  connections_empty: 'No users yet',

  // —— Grok ————————————————————————————————————————————————————————————————
  grok_mode_auto: 'Auto',
  grok_announce_title: 'Introducing Grok 4.1',
  grok_announce_desc: 'Setting new standards in conversational intelligence, emotional understanding, and real-world utility.',
  grok_quick_create_image: 'Create image',
  grok_quick_edit_image: 'Edit image',
  grok_quick_voice_mode: 'Try voice mode',
  grok_input_placeholder: 'Ask anything',
  grok_error_connection: 'Sorry, I seem to have lost connection to the universe.',
  grok_submit_button: 'Send',
  grok_generating: 'Generating…',
  grok_send_button: 'Speak',

  // —— Drawer ——————————————————————————————————————————————————————————————
  drawer_following_label: 'Following',
  drawer_followers_label: 'Followers',
  drawer_menu_profile: 'Profile',
  drawer_menu_premium: 'Premium',
  drawer_menu_videos: 'Videos',
  drawer_menu_communities: 'Communities',
  drawer_menu_bookmarks: 'Bookmarks',
  drawer_menu_lists: 'Lists',
  drawer_menu_spaces: 'Spaces',
  drawer_menu_creator_studio: 'Creator Studio',
  drawer_menu_download_grok: 'Download Grok',
  drawer_menu_settings: 'Settings and privacy',
  drawer_menu_help: 'Help Center',

  // —— Media ———————————————————————————————————————————————————————————————
  media_image_load_failed: 'Image failed to load',
  media_video_paused: 'Video loading paused',
  media_video_load_failed: 'Video failed to load',
  media_video_open_new_window: 'Open in new window',

  // —— Shared UI —————————————————————————————————————————————————————————————
  common_you_reposted: 'You reposted',
  common_cancel: 'Cancel',
  bookmark_toast_added: 'Post added to your bookmarks',
  bookmark_toast_add_to_folder: 'Add to folder',
  retweet_sheet_retweet: 'Repost',
  retweet_sheet_quote: 'Quote',
  retweet_sheet_view_activity: 'View post activity',

  // —— Context ——————————————————————————————————————————————————————————————
  time_just_now: 'just now',

  // —— UserProfile Subs (other user) ————————————————————————————————————
  user_subs_button: 'Subscribe',
};
