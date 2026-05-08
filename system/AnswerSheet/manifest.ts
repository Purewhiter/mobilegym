import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: 'answer_sheet',
  packageName: 'com.mobilegym.answersheet',
  displayName: '答题卡',
  displayNameEn: 'Answer Sheet',
  aliases: ['答题卡', 'AnswerSheet'],
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#3b82f6',
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#3b82f6',
      primaryDark: '#2563eb',
      background: '#f8fafc',
      surface: '#ffffff',
      textPrimary: '#0f172a',
      textSecondary: '#64748b',
      border: '#e2e8f0',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
};
