/**
 * Gallery 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  app_name: '相册',

  // --- Home tabs ---
  tab_photos: '照片',
  tab_albums: '相册',

  // --- Date labels ---
  date_today: '今天',
  date_yesterday: '昨天',
  date_range_separator: '至',
  date_month_day: '月日',
  date_year_month_day: '年月日',

  // --- Photos page ---
  photos_title: '照片',
  photos_item_count_suffix: ' 项',
  photos_empty_title: '暂无照片',
  photos_empty_desc: '拍摄或保存照片后会显示在这里',
  photos_done: '完成',

  // --- Search / filter labels ---
  search_label: '搜索',
  filter_label: '筛选',
  more_label: '更多',

  // --- Select mode ---
  select_prefix: '已选择',
  select_suffix: '项',
  select_prompt: '选择项目',
  action_favorite: '收藏',
  action_share: '分享',
  action_delete: '删除',

  // --- Delete confirmation dialog ---
  delete_photo_title: '删除照片',
  delete_photo_confirm_batch: '确定要删除选中的 {count} 张照片吗？此操作无法撤销。',
  delete_photo_confirm_single: '确定要删除这张照片吗？此操作无法撤销。',
  dialog_confirm: '确定',
  dialog_cancel: '取消',

  // --- Albums page ---
  albums_title: '相册',
  albums_app_albums: '应用相册',

  // --- Creation tools ---
  creation_title: '创作',
  creation_collage: '拼图',
  creation_video_edit: '视频剪辑',
  creation_smart_clip: '智能成片',
  creation_photo_movie: '照片电影',

  // --- More section ---
  more_title: '更多',
  more_recently_deleted: '最近删除',
  more_documents: '文档',
  more_people: '人像',
  more_selfie: '自拍',
  more_customize: '自定义',

  // --- Favorites page ---
  favorites_title: '收藏',
  favorites_count_suffix: ' 张照片',
  favorites_empty_title: '暂无收藏',
  favorites_empty_desc: '点击照片右上角的心形图标收藏',

  // --- Album detail page ---
  album_default_name: '相册',
  album_select: '选择',
  album_done: '完成',
  album_empty: '暂无内容',

  // --- Photo viewer page ---
  viewer_back: '返回',
  viewer_rotate: '旋转',
  viewer_send: '发送',
  viewer_edit: '编辑',
  viewer_favorite: '收藏',
  viewer_delete: '删除',
  viewer_more: '更多',

  // --- Date format suffixes ---
  gallery_year_suffix: '年',
  gallery_month_suffix: '月',
  gallery_day_suffix: '日',

  // --- Batch delete dialog ---
  gallery_delete_batch_prefix: '确定要删除选中的 ',
  gallery_delete_batch_suffix: ' 张照片吗？此操作无法撤销。',

  // --- Photo viewer more menu ---
  more_menu_add_to: '添加到',
  more_menu_set_wallpaper: '设置为壁纸',
  more_menu_details: '详情',
  more_menu_generate_pdf: '生成PDF',
  more_menu_extract: '提取',
  more_menu_doc_edit: '文档编辑',
  more_menu_watermark: '隐私保护水印',
  more_menu_clipboard: '复制到剪贴板',
  more_menu_rename: '重命名',

  // --- Photo details dialog ---
  details_title: '详情',
  details_capture_time: '拍摄时间：',
  details_file_info: '文件信息：',
  details_file_path: '文件路径：',
  details_weekday_prefix: '星期',
  details_weekday_sun: '日',
  details_weekday_mon: '一',
  details_weekday_tue: '二',
  details_weekday_wed: '三',
  details_weekday_thu: '四',
  details_weekday_fri: '五',
  details_weekday_sat: '六',
  details_internal_storage: '内部存储',

  // --- Rename dialog ---
  rename_title: '重命名',
  rename_placeholder: '请输入新文件名',
  rename_success: '重命名成功',
  rename_failed: '重命名失败',
  rename_invalid_name: '文件名不合法',
} as const;

export type StringKey = keyof typeof strings;
