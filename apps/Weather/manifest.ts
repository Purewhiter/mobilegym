import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'weather',
  packageName: 'com.miui.weather2',
  displayName: '天气',
  displayNameEn: 'Weather',
  version: '1.0.0',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncher,
  iconBackground: 'linear-gradient(to bottom right, #60a5fa 0%, #2563eb 100%)',
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#3b82f6',
      primaryDark: '#2563eb',
      background: '#0b1220',
      surface: '#1a2234',
      textPrimary: '#ffffff',
      textSecondary: '#8f9bb0',
      border: '#334155',
      statusBarForeground: 'light',
      navigationBarForeground: 'light',
    },
  },
  permissions: [
    PERMISSIONS.ACCESS_FINE_LOCATION,
    PERMISSIONS.ACCESS_COARSE_LOCATION,
  ],
};
