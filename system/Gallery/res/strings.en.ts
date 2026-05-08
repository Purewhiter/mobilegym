import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  app_name: 'Gallery',

  // --- Home tabs ---
  tab_photos: 'Photos',
  tab_albums: 'Albums',

  // --- Date labels ---
  date_today: 'Today',
  date_yesterday: 'Yesterday',
  date_range_separator: ' to ',
  date_month_day: 'month day',
  date_year_month_day: 'year month day',

  // --- Photos page ---
  photos_title: 'Photos',
  photos_item_count_suffix: ' items',
  photos_empty_title: 'No photos',
  photos_empty_desc: 'Photos you take or save will appear here',
  photos_done: 'Done',

  // --- Search / filter labels ---
  search_label: 'Search',
  filter_label: 'Filter',
  more_label: 'More',

  // --- Select mode ---
  select_prefix: 'Selected ',
  select_suffix: ' items',
  select_prompt: 'Select items',
  action_favorite: 'Favorite',
  action_share: 'Share',
  action_delete: 'Delete',

  // --- Delete confirmation dialog ---
  delete_photo_title: 'Delete photo',
  delete_photo_confirm_batch: 'Are you sure you want to delete {count} selected photos? This action cannot be undone.',
  delete_photo_confirm_single: 'Are you sure you want to delete this photo? This action cannot be undone.',
  dialog_confirm: 'Confirm',
  dialog_cancel: 'Cancel',

  // --- Albums page ---
  albums_title: 'Albums',
  albums_app_albums: 'App Albums',

  // --- Creation tools ---
  creation_title: 'Create',
  creation_collage: 'Collage',
  creation_video_edit: 'Video Edit',
  creation_smart_clip: 'Smart Clip',
  creation_photo_movie: 'Photo Movie',

  // --- More section ---
  more_title: 'More',
  more_recently_deleted: 'Recently Deleted',
  more_documents: 'Documents',
  more_people: 'People',
  more_selfie: 'Selfie',
  more_customize: 'Customize',

  // --- Favorites page ---
  favorites_title: 'Favorites',
  favorites_count_suffix: ' photos',
  favorites_empty_title: 'No favorites',
  favorites_empty_desc: 'Tap the heart icon on a photo to add it to favorites',

  // --- Album detail page ---
  album_default_name: 'Album',
  album_select: 'Select',
  album_done: 'Done',
  album_empty: 'No content',

  // --- Photo viewer page ---
  viewer_back: 'Back',
  viewer_rotate: 'Rotate',
  viewer_send: 'Send',
  viewer_edit: 'Edit',
  viewer_favorite: 'Favorite',
  viewer_delete: 'Delete',
  viewer_more: 'More',

  // --- Date format suffixes ---
  gallery_year_suffix: '/',
  gallery_month_suffix: '/',
  gallery_day_suffix: '',

  // --- Batch delete dialog ---
  gallery_delete_batch_prefix: 'Delete ',
  gallery_delete_batch_suffix: ' photos? This action cannot be undone.',

  // --- Photo viewer more menu ---
  more_menu_add_to: 'Add to',
  more_menu_set_wallpaper: 'Set as wallpaper',
  more_menu_details: 'Details',
  more_menu_generate_pdf: 'Generate PDF',
  more_menu_extract: 'Extract',
  more_menu_doc_edit: 'Edit document',
  more_menu_watermark: 'Privacy watermark',
  more_menu_clipboard: 'Copy to clipboard',
  more_menu_rename: 'Rename',

  // --- Photo details dialog ---
  details_title: 'Details',
  details_capture_time: 'Captured: ',
  details_file_info: 'File: ',
  details_file_path: 'Path: ',
  details_weekday_prefix: '',
  details_weekday_sun: 'Sun',
  details_weekday_mon: 'Mon',
  details_weekday_tue: 'Tue',
  details_weekday_wed: 'Wed',
  details_weekday_thu: 'Thu',
  details_weekday_fri: 'Fri',
  details_weekday_sat: 'Sat',
  details_internal_storage: 'Internal storage',

  // --- Rename dialog ---
  rename_title: 'Rename',
  rename_placeholder: 'Enter new file name',
  rename_success: 'Renamed',
  rename_failed: 'Rename failed',
  rename_invalid_name: 'Invalid file name',
};
