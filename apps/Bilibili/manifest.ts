import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'bilibili',
  packageName: 'com.bilibili.app.in',
  displayName: '哔哩哔哩',
  displayNameEn: 'Bilibili',
  version: '8.72.0',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncher,
  iconBackground: '#fb7299',
  iconForeground: '#ffffff',
  designViewportWidth: 412,
  theme: {
    colors: {
      primary: '#fb7299',
      primaryDark: '#c45a76',
      background: '#f1f2f3',
      surface: '#ffffff',
      textPrimary: '#18191c',
      textSecondary: '#9499a0',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  permissions: [
    PERMISSIONS.CAMERA,
    PERMISSIONS.RECORD_AUDIO,
    PERMISSIONS.READ_EXTERNAL_STORAGE,
    PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  ],
  queries: [
    { action: 'ACTION_PAY', scheme: 'weixin' },
  ],
};
