import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'contacts',
  packageName: 'com.android.contacts',
  displayName: '电话',
  displayNameEn: 'Phone',
  aliases: ['通讯录', '联系人', '通话'],
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#1E88E5',
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#1dcd3a',
      primaryDark: '#32c05f',
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
    PERMISSIONS.READ_CONTACTS,
    PERMISSIONS.WRITE_CONTACTS,
    PERMISSIONS.CALL_PHONE,
    PERMISSIONS.READ_CALL_LOG,
  ],
  intentFilters: [
    {
      action: 'ACTION_VIEW',
      scheme: 'tel',
      route: '/',
      description: '通过 tel: 链接拨号',
    },
    {
      action: 'ACTION_DIAL',
      route: '/',
      description: '打开拨号盘',
    },
    {
      action: 'ACTION_PICK',
      type: 'vnd.android.cursor.dir/contact',
      route: '/contacts',
      description: '选择联系人',
    },
  ],
  queries: [
    { action: 'ACTION_VIEW', scheme: 'sms' },
  ],
};
