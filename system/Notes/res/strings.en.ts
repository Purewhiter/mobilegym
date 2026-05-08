import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  // App / Page titles
  app_name: 'Notes',
  notes: 'Notes',
  todo: 'To-do',
  folders: 'Folders',
  settings: 'Settings',
  todo_settings: 'To-do Settings',
  trash: 'Trash',
  private_notes: 'Private',

  // Folder names (system)
  folder_all: 'All',
  folder_call: 'Call Notes',
  folder_unfiled: 'Unfiled',
  folder_new_default: 'New Folder',

  // Note editor
  editor_title_placeholder: 'Title',
  editor_start_writing: 'Start writing or ',
  editor_create_mind_note: 'Create mind map',
  editor_word_count_suffix: ' words',
  editor_note_not_found: 'Note does not exist or has been deleted',
  editor_trash_banner: 'This note is in Trash. Restore it before editing.',

  // Actions / Labels
  action_back: 'Back',
  action_close: 'Close',
  action_cancel: 'Cancel',
  action_confirm: 'OK',
  action_more: 'More',
  action_done: 'Done',
  action_undo: 'Undo',
  action_redo: 'Redo',
  action_delete: 'Delete',
  action_restore: 'Restore',
  action_restore_all: 'Restore All',
  action_permanent_delete: 'Delete Permanently',
  action_pin: 'Pin',
  action_unpin: 'Unpin',
  action_move_to: 'Move to',
  action_set_private: 'Set as Private',
  action_unset_private: 'Remove from Private',
  action_set_reminder: 'Set Reminder',
  action_send_to_desktop: 'Send to Home Screen',
  action_share: 'Share',
  action_drawing_board: 'Drawing board',
  action_new_note: 'New Note',
  action_new_todo: 'New To-do',
  action_check_todo: 'Mark as done',
  action_uncheck_todo: 'Mark as not done',
  action_new_folder: 'New Folder',
  action_rename: 'Rename',
  action_rename_folder: 'Rename Folder',
  action_select_all: 'Select All',
  action_deselect_all: 'Deselect All',
  action_cancel_select: 'Cancel Selection',
  action_select: 'Select',

  // Search
  search_placeholder: 'Search notes',

  // Editor toolbar
  toolbar_handwrite: 'Handwrite',
  toolbar_recording: 'Recording',
  toolbar_image: 'Image',
  toolbar_doodle: 'Doodle',
  toolbar_checklist: 'Checklist',
  toolbar_text_style: 'Text',

  // Settings page
  settings_section_notes: 'Notes',
  settings_list_view: 'List View',
  settings_grid_double: 'Two Columns',
  settings_grid_single: 'Single Column',
  settings_show_word_count: 'Show Word Count',

  // Toast messages
  toast_pinned: 'Pinned',
  toast_unpinned: 'Unpinned',
  toast_set_private: 'Set as private',
  toast_unset_private: 'Removed from private',
  toast_moved_to_trash: 'Moved to Trash',
  toast_restored: 'Restored',
  toast_all_restored: 'All restored',
  toast_permanent_deleted: 'Permanently deleted',
  toast_reminder_set: 'Reminder set',
  toast_reminder_cleared: 'Reminder cleared',
  toast_undo_dev: 'Undo is under development',
  toast_redo_dev: 'Redo is under development',
  toast_mind_note_dev: 'Mind map is under development',
  toast_handwrite_dev: 'Handwriting is under development',
  toast_recording_dev: 'Recording is under development',
  toast_image_dev: 'Image is under development',
  toast_doodle_dev: 'Doodle is under development',
  toast_checklist_dev: 'Checklist is under development',
  toast_text_style_dev: 'Text style is under development',
  toast_send_desktop_dev: 'Send to Home Screen is under development',
  toast_share_dev: 'Share (dev)',
  toast_drawing_board_dev: 'Drawing board (dev)',

  // Empty states
  empty_notes: 'No notes',
  empty_trash: 'Trash is empty',
  empty_private: 'No private notes',
  empty_todo: 'No to-dos',
  todo_completed_section: 'Completed',

  // Placeholders / fallbacks
  untitled: 'Untitled',
  no_content: 'No additional text',
  trash_time_prefix: 'Deleted: ',
  current_folder: 'Current',
  note_count_suffix: ' notes',
  selected_count_prefix: '',
  selected_count_suffix: ' selected',
  todo_input_placeholder: 'Enter to-do item',
  todo_search_placeholder: 'Search to-dos',

  // Confirm dialogs
  confirm_permanent_delete: 'Delete permanently? This action cannot be undone.',
  confirm_restore_all: 'Restore all notes from Trash?',
  confirm_folder_placeholder: 'Enter folder name',


  // DateTime dialog
  datetime_picker_title: 'Set Date and Time',
  datetime_hint: 'Select a time and tap "OK"',
  datetime_clear: 'Clear Reminder',
  datetime_hour_suffix: 'h',
  datetime_minute_suffix: 'm',

  // InputDialog
  input_hint: 'Type and press Enter to confirm',

  // Private label
  label_private: 'Private',
  label_encrypted: 'Encrypted',

  // Date suffix characters
  date_suffix_year: '/',
  date_suffix_month: '/',
  date_suffix_day: '',

  // Toast: moved-to folder
  toast_moved_to_prefix: 'Moved to "',
  toast_moved_to_editor_prefix: 'Moved to "',
  toast_moved_to_suffix: '"',

  // Folder picker dialog title
  select_folder_title: 'Select Folder',

  // Folder delete confirm
  confirm_delete_folder_pre: 'Delete folder "',
  confirm_delete_folder_post: '"? Notes will be moved to "Unfiled".',

  // ActionSheet title for private notes
  private_notes_title: 'Private Notes',

  // Reminder label prefix
  alarm_label_prefix: 'Reminder ',
};
