import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'wechat',
  packageName: 'com.tencent.mm',
  displayName: '微信',
  displayNameEn: 'WeChat',
  version: '8.0.65',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncher,
  iconBackground: '#07c160',
  iconForeground: '#ffffff',
  designViewportWidth: 412,
  theme: {
    colors: {
      primary: '#07c160',
      primaryDark: '#06a152',
      background: '#ededed',
      surface: '#ffffff',
      textPrimary: '#000000',
      textSecondary: '#666666',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  permissions: [
    PERMISSIONS.CAMERA,
    PERMISSIONS.RECORD_AUDIO,
    PERMISSIONS.ACCESS_FINE_LOCATION,
    PERMISSIONS.READ_CONTACTS,
    PERMISSIONS.READ_EXTERNAL_STORAGE,
    PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  ],
  intentFilters: [
    {
      action: 'ACTION_SEND',
      type: 'text/plain',
      route: '/',
      description: '接收文本分享',
    },
    {
      action: 'ACTION_SEND',
      type: 'image/*',
      route: '/share/forward',
      launchMode: 'singleTask',
      description: '接收图片分享 — 选择会话后转发图片，完成后停留在微信',
    },
    {
      action: 'ACTION_VIEW',
      scheme: 'weixin',
      route: '/',
      description: '微信深度链接',
    },
    {
      action: 'ACTION_PAY',
      scheme: 'weixin',
      route: '/pay/confirmation',
      params: [
        { name: 'amount', type: 'number', description: '支付金额（元）' },
        { name: 'merchantName', type: 'string', description: '商户名称' },
        { name: 'subject', type: 'string', description: '服务描述' },
        { name: 'source', type: 'string', description: '调用方 appId' },
      ],
      description: '微信支付收银台 — 接收外部支付请求',
    },
  ],
  queries: [
    { action: 'ACTION_SEND', type: 'text/plain' },
    { action: 'ACTION_SEND', type: 'image/*' },
    { action: 'ACTION_PICK', type: 'vnd.android.cursor.dir/contact' },
  ],
};
