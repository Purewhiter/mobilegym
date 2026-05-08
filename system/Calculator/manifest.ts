import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: 'calculator',
  packageName: 'com.miui.calculator',
  displayName: '计算器',
  displayNameEn: 'Calculator',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#ff7e45',
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#f97316',
      primaryDark: '#ea580c',
      background: '#000000',
      surface: '#111827',
      textPrimary: '#ffffff',
      textSecondary: '#9ca3af',
      border: '#2a2a2a',
      statusBarForeground: 'light',
      navigationBarForeground: 'light',
    },
  },
};
