import type { AppManifest } from '@/os/types/manifest';
import { IcLauncher } from './res/icons';

export const manifest: AppManifest = {
  id: 'scroll_lab',
  packageName: 'com.aiden.mobilegym.scrolllab',
  displayName: '列表实验室',
  displayNameEn: 'Scroll Lab',
  aliases: ['滚动测试', '长列表', 'scroll lab', 'list benchmark'],
  version: '1.0.0',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncher,
  iconBackground: '#2563eb',
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#2563eb',
      primaryDark: '#1d4ed8',
      background: '#f4f6f8',
      surface: '#ffffff',
      textPrimary: '#172033',
      textSecondary: '#657089',
      border: '#dfe4ec',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
};
