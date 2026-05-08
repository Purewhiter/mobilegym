import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'map',
  packageName: 'com.autonavi.minimap',
  displayName: '地图',
  displayNameEn: 'Maps',
  version: '26.07.05.867227976',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncher,
  iconBackground: '#ffffff',
  iconForeground: '#ea4335',
  designViewportWidth: 412,
  theme: {
    colors: {
      primary: '#007982',
      primaryDark: '#006a6a',
      accent: '#ea4335',
      background: '#f0f3f8',
      surface: '#ffffff',
      textPrimary: '#1f2937',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  permissions: [
    PERMISSIONS.ACCESS_FINE_LOCATION,
    PERMISSIONS.ACCESS_COARSE_LOCATION,
    PERMISSIONS.READ_EXTERNAL_STORAGE,
  ],
  intentFilters: [
    {
      action: 'ACTION_VIEW',
      scheme: 'geo',
      route: '/search',
      description: '打开地理位置',
    },
  ],
};
