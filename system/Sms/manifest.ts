import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'sms',
  packageName: 'com.android.mms',
  displayName: '短信',
  displayNameEn: 'Messages',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#1E88E5',
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#07c160',
      primaryDark: '#06a152',
      background: '#f5f5f5',
      surface: '#ffffff',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  permissions: [
    PERMISSIONS.SEND_SMS,
    PERMISSIONS.RECEIVE_SMS,
    PERMISSIONS.READ_CONTACTS,
  ],
  intentFilters: [
    {
      action: 'ACTION_SEND',
      type: 'text/plain',
      route: '/new',
      description: '接收文本分享',
    },
    {
      action: 'ACTION_SEND',
      type: 'image/*',
      route: '/new',
      description: '接收图片分享',
    },
    {
      action: 'ACTION_VIEW',
      scheme: 'sms',
      route: '/new',
      description: '通过 sms: 链接发短信 — 调用方需要传 { newTask: true } 让 SMS 进入独立 Task',
    },
  ],
  queries: [
    { action: 'ACTION_PICK', type: 'vnd.android.cursor.dir/contact' },
    { action: 'ACTION_VIEW', scheme: 'tel' },
  ],
};
