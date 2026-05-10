import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'file_manager',
  packageName: 'com.android.fileexplorer',
  displayName: '文件',
  displayNameEn: 'Files',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#f59e0b',
  iconForeground: '#ffffff',
  designViewportWidth: 412,
  theme: {
    colors: {
      primary: '#3b82f6',
      primaryDark: '#2563eb',
      background: '#f3f4f6',
      surface: '#ffffff',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  permissions: [
    PERMISSIONS.READ_EXTERNAL_STORAGE,
    PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  ],
  intentFilters: [
    {
      action: 'ACTION_VIEW',
      scheme: 'file',
      route: '/',
      description: '打开文件链接',
    },
    {
      action: 'ACTION_VIEW',
      scheme: 'content',
      route: '/',
      description: '打开 content URI',
    },
    {
      action: 'ACTION_VIEW',
      type: 'inode/directory',
      route: '/',
      description: '打开 FileManager；调用方通过 intent.route 指定具体子页（如 /category/images），缺省落在根目录',
    },
  ],
  queries: [
    { action: 'ACTION_VIEW', type: 'image/*' },
    { action: 'ACTION_SEND', type: 'image/*' },
  ],
};
