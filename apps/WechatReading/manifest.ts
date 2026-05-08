import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: 'wechat_reading',
  packageName: 'com.tencent.weread',
  displayName: '微信读书',
  displayNameEn: 'WeRead',
  version: '10.0.0',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncher,
  iconBackground: '#ffffff',
  iconForeground: '#3b82f6',
  designViewportWidth: 412,
  theme: {
    colors: {
      primary: '#3b82f6',
      background: '#f5f7f9',
      surface: '#ffffff',
      textPrimary: '#000000',
      textSecondary: '#666666',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
};

