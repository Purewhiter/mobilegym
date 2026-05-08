import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: 'notes',
  packageName: 'com.miui.notes',
  displayName: '笔记',
  displayNameEn: 'Notes',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#ffb200',
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#ffbb0f',
      primaryDark: '#f9b40f',
      background: '#f7f7f7',
      surface: '#ffffff',
      textPrimary: '#000000',
      textSecondary: '#666666',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  intentFilters: [
    {
      action: 'ACTION_SEND',
      type: 'text/plain',
      route: '/',
      description: '接收文本分享',
    },
  ],
  queries: [
    { action: 'ACTION_SEND', type: 'text/plain' },
  ],
};
