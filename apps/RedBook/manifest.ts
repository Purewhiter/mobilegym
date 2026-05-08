import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'redbook',
  packageName: 'com.xingin.xhs',
  displayName: '小红书',
  displayNameEn: 'RedNote',
  version: '9.15.0',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncher,
  iconBackground: '#ff2442',
  iconForeground: '#ffffff',
  designViewportWidth: 412,
  theme: {
    colors: {
      primary: '#ff2442',
      background: '#ffffff',
      surface: '#ffffff',
      textPrimary: '#333333',
      textSecondary: '#999999',
      border: '#f5f5f5',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  permissions: [
    PERMISSIONS.CAMERA,
    PERMISSIONS.RECORD_AUDIO,
    PERMISSIONS.READ_EXTERNAL_STORAGE,
    PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    PERMISSIONS.ACCESS_FINE_LOCATION,
  ],
  intentFilters: [
    {
      action: 'ACTION_SEND',
      type: 'text/plain',
      route: '/publish/text',
      description: '接收文本分享',
    },
    {
      action: 'ACTION_SEND',
      type: 'image/*',
      route: '/publish/text',
      description: '接收图片分享',
    },
  ],
  queries: [
    { action: 'ACTION_SEND', type: 'text/plain' },
    { action: 'ACTION_SEND', type: 'image/*' },
  ],
};
