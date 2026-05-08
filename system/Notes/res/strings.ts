/**
 * Notes 字符串资源 — 对应 AOSP res/values/strings.xml
 * 页面级 UI 字符串（标题、按钮、提示、Toast 等）
 */
export const strings = {
  // App / Page titles
  app_name: '小米笔记',
  notes: '笔记',
  todo: '待办',
  folders: '文件夹',
  settings: '设置',
  todo_settings: '待办设置',
  trash: '回收站',
  private_notes: '私密',

  // Folder names (system)
  folder_all: '全部',
  folder_call: '通话笔记',
  folder_unfiled: '未分类',
  folder_new_default: '新建文件夹',

  // Note editor
  editor_title_placeholder: '标题',
  editor_start_writing: '开始书写或',
  editor_create_mind_note: '创建思维笔记',
  editor_word_count_suffix: '字',
  editor_note_not_found: '笔记不存在或已删除',
  editor_trash_banner: '该笔记在回收站，恢复后才能编辑。',

  // Actions / Labels
  action_back: '返回',
  action_close: '关闭',
  action_cancel: '取消',
  action_confirm: '确定',
  action_more: '更多',
  action_done: '完成',
  action_undo: '撤销',
  action_redo: '重做',
  action_delete: '删除',
  action_restore: '恢复',
  action_restore_all: '全部恢复',
  action_permanent_delete: '永久删除',
  action_pin: '置顶',
  action_unpin: '取消置顶',
  action_move_to: '移动到',
  action_set_private: '设为私密',
  action_unset_private: '解除私密',
  action_set_reminder: '设置提醒',
  action_send_to_desktop: '发送到桌面',
  action_share: '分享',
  action_drawing_board: '画板',
  action_new_note: '新建笔记',
  action_new_todo: '新建待办',
  action_check_todo: '标记完成',
  action_uncheck_todo: '取消完成',
  action_new_folder: '新建文件夹',
  action_rename: '重命名',
  action_rename_folder: '重命名文件夹',
  action_select_all: '全选',
  action_deselect_all: '取消全选',
  action_cancel_select: '取消选择',
  action_select: '选择',

  // Search
  search_placeholder: '搜索笔记',

  // Editor toolbar
  toolbar_handwrite: '手写',
  toolbar_recording: '录音',
  toolbar_image: '图片',
  toolbar_doodle: '涂鸦',
  toolbar_checklist: '清单',
  toolbar_text_style: '文字',

  // Settings page
  settings_section_notes: '笔记',
  settings_list_view: '列表视图',
  settings_grid_double: '双列',
  settings_grid_single: '单列',
  settings_show_word_count: '显示字数',

  // Toast messages
  toast_pinned: '已置顶',
  toast_unpinned: '已取消置顶',
  toast_set_private: '已设为私密',
  toast_unset_private: '已解除私密',
  toast_moved_to_trash: '已移到回收站',
  toast_restored: '已恢复',
  toast_all_restored: '已全部恢复',
  toast_permanent_deleted: '已永久删除',
  toast_reminder_set: '提醒已设置',
  toast_reminder_cleared: '提醒已清除',
  toast_undo_dev: '撤销开发中',
  toast_redo_dev: '重做开发中',
  toast_mind_note_dev: '思维笔记功能开发中',
  toast_handwrite_dev: '手写开发中',
  toast_recording_dev: '录音开发中',
  toast_image_dev: '图片开发中',
  toast_doodle_dev: '涂鸦开发中',
  toast_checklist_dev: '清单开发中',
  toast_text_style_dev: '文字样式开发中',
  toast_send_desktop_dev: '发送到桌面开发中',
  toast_share_dev: '分享功能开发中',
  toast_drawing_board_dev: '画板功能开发中',

  // Empty states
  empty_notes: '没有笔记',
  empty_trash: '回收站为空',
  empty_private: '没有私密笔记',
  empty_todo: '没有待办',
  todo_completed_section: '已完成',

  // Placeholders / fallbacks
  untitled: '无标题',
  no_content: '无附加文案',
  trash_time_prefix: '删除时间：',
  current_folder: '当前',
  note_count_suffix: '条笔记',
  selected_count_prefix: '已选 ',
  selected_count_suffix: ' 项',
  todo_input_placeholder: '输入待办内容',
  todo_search_placeholder: '搜索待办',

  // Confirm dialogs
  confirm_permanent_delete: '确定永久删除？此操作不可撤销。',
  confirm_restore_all: '恢复回收站中的全部笔记？',
  confirm_folder_placeholder: '请输入文件夹名称',


  // DateTime dialog
  datetime_picker_title: '设置日期和时间',
  datetime_hint: '选择时间后点击"确定"',
  datetime_clear: '清除提醒',
  datetime_hour_suffix: '时',
  datetime_minute_suffix: '分',

  // InputDialog
  input_hint: '输入后按回车确认',

  // Private label
  label_private: '私密',
  label_encrypted: '已加密',

  // Date suffix characters (used in formatListTime / formatHeaderTime helpers)
  date_suffix_year: '年',
  date_suffix_month: '月',
  date_suffix_day: '日',

  // Toast: moved-to folder (two distinct prefix variants for visual accuracy)
  toast_moved_to_prefix: '已移动到「',
  toast_moved_to_editor_prefix: '已移到「',
  toast_moved_to_suffix: '」',

  // Folder picker dialog title (in NoteEditorPage)
  select_folder_title: '选择文件夹',

  // Folder delete confirm (split around folder name)
  confirm_delete_folder_pre: '删除文件夹"',
  confirm_delete_folder_post: '"？文件夹内笔记将移到"未分类"。',

  // ActionSheet title for private notes
  private_notes_title: '私密笔记',

  // Reminder label prefix (before the formatted time)
  alarm_label_prefix: '提醒 ',
} as const;

export type StringKey = keyof typeof strings;
