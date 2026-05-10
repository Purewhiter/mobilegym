import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'railway12306',
  packageName: 'com.MobileTicket',
  displayName: '铁路12306',
  displayNameEn: 'Railway 12306',
  aliases: ['12306'],
  version: '5.9.4.5',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncher,
  iconBackground: '#4b89dc',
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#3b99fc',
      primaryDark: '#298ccf',
      accent: '#ff8c00',
      background: '#f5f5f5',
      surface: '#ffffff',
      textPrimary: '#333333',
      textSecondary: '#999999',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  permissions: [
    PERMISSIONS.ACCESS_FINE_LOCATION,
    PERMISSIONS.READ_PHONE_STATE,
    PERMISSIONS.READ_CONTACTS,
  ],
  queries: [
    { action: 'ACTION_PAY', scheme: 'alipays' },
    { action: 'ACTION_VIEW', scheme: 'sms' },
  ],
};
