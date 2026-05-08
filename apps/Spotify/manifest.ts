import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';
import { IcLauncher } from './res/icons';

export const manifest: AppManifest = {
  id: 'spotify',
  packageName: 'com.spotify.music',
  displayName: 'Spotify',
  displayNameEn: 'Spotify',
  version: '9.1.34.2060',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncher,
  iconBackground: '#000000',
  iconForeground: '#1ed760',
  designViewportWidth: 412,
  theme: {
    colors: {
      primary: '#1ed760',
      primaryDark: '#1db954',
      accent: '#1db954',
      background: '#000000',
      surface: '#121212',
      textPrimary: '#ffffff',
      textSecondary: '#b3b3b3',
      border: '#2a2a2a',
      statusBarForeground: 'light',
      navigationBarForeground: 'light',
    },
  },
  permissions: [
    PERMISSIONS.READ_EXTERNAL_STORAGE,
    PERMISSIONS.RECORD_AUDIO,
  ],
};
