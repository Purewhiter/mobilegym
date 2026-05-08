import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'compass',
  packageName: 'com.miui.compass',
  displayName: '指南针',
  displayNameEn: 'Compass',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#000000',
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#ef4444',
      background: '#000000',
      surface: '#111827',
      textPrimary: '#ffffff',
      textSecondary: '#9ca3af',
      border: '#374151',
      statusBarForeground: 'light',
      navigationBarForeground: 'light',
    },
  },
  permissions: [
    PERMISSIONS.ACCESS_FINE_LOCATION,
  ],
};
