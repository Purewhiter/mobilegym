import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  app_name: 'Themes',

  refresh: 'Refresh',
  tab_themes: 'Themes',
  tab_fonts: 'Text styles',
  tab_aod: 'AOD',
  loading: 'Loading...',
  load_failed: 'Load failed: ',
  no_resources_found: 'No resources found.',
  enabled: 'Enabled',
  unknown_author: 'Unknown author',
  pill_icons: 'Icons',
  pill_wallpaper: 'Wallpaper',
  pill_statusbar: 'Status Bar',
  pill_control_center: 'Control Center',

  theme_detail: 'Theme Details',
  apply: 'Apply',
  applying: 'Applying...',
  apply_full_theme: 'Apply full theme',
  mix_and_match: 'Mix & Match',
  apply_icons_only: 'Apply icons only',
  apply_wallpaper_only: 'Apply wallpaper only',
  no_available_wallpaper: 'No wallpaper available for this theme',
  sim_font_not_supported: 'Font preview only. Applying fonts is not supported in simulation.',
  sim_aod_not_supported: 'AOD preview only. Applying AOD is not supported in simulation.',
  operation_failed: 'Operation failed: ',
  resource_not_found: 'Resource not found: ',
};
