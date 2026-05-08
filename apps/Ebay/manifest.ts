import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: 'ebay',
  packageName: 'com.ebay.mobile',
  displayName: 'eBay',
  displayNameEn: 'eBay',
  version: '6.250.0.1',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncher,
  iconBackground: '#ffffff',
  iconForeground: '#e53238',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#e53238',
      background: '#ffffff',
      surface: '#ffffff',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
};

