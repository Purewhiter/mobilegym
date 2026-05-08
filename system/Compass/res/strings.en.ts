import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  app_name: 'Compass',

  // --- Top bar tabs ---
  tab_compass: 'Compass',
  tab_level: 'Level',

  // --- Compass directions ---
  direction_north: 'N',
  direction_northeast: 'NE',
  direction_east: 'E',
  direction_southeast: 'SE',
  direction_south: 'S',
  direction_southwest: 'SW',
  direction_west: 'W',
  direction_northwest: 'NW',

  // --- Latitude / longitude labels ---
  lat_north: 'N Lat',
  lat_south: 'S Lat',
  lon_east: 'E Lon',
  lon_west: 'W Lon',

  // --- More menu ---
  menu_more: 'More',
  menu_close: 'Close menu',
  menu_view_privacy_policy: 'View privacy policy',
  menu_permissions: 'Permissions',

  // --- Permissions page ---
  permission_title: 'Permissions',
  permission_location_title: 'Access device location',
  permission_location_desc: 'Used to provide latitude and longitude services',
  permission_camera_title: 'Open camera',
  permission_camera_desc: 'Used to open compass AR mode',
  permission_status_allowed: 'Allowed',

  // --- Privacy page ---
  privacy_back: 'Back',
  privacy_new_tab: 'New tab',

  // --- Common ---
  back: 'Back',
};
