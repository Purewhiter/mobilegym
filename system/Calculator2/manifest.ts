import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: 'calculator2',
  packageName: 'com.android.calculator2',
  displayName: '计算器2',
  displayNameEn: 'Calculator 2',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#5c6b70',       // AOSP 图标主色调（蓝灰色）
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#00BCD4',           // AOSP accent (cyan)
      primaryDark: '#00838F',
      onSurface: '#ffffff',
      background: '#FFFFFF',
      surface: '#434343',
      textPrimary: 'rgba(0,0,0,0.54)',
      textSecondary: 'rgba(0,0,0,0.42)',
      border: '#2a2a2a',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  intentFilters: [
    { action: 'android.intent.action.MAIN', route: '/', description: '计算器主页' },
  ],
};
