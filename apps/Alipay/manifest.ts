import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: 'alipay',
  packageName: 'com.eg.android.AlipayGphone',
  displayName: '支付宝',
  displayNameEn: 'Alipay',
  version: '10.8.26.7000',
  versionCode: 1,
  type: 'plugin',
  icon: IcLauncher,
  iconBackground: '#1677ff',
  iconForeground: '#ffffff',
  designViewportWidth: 412,
  theme: {
    colors: {
      primary: '#1677ff',
      secondary: '#00b96b',
      background: '#f5f5f5',
      surface: '#ffffff',
      textPrimary: '#333333',
      textSecondary: '#666666',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  intentFilters: [
    {
      action: 'ACTION_PAY',
      scheme: 'alipays',
      route: '/pay/cashier',
      params: [
        { name: 'amount', type: 'number', description: '支付金额（元）' },
        { name: 'orderId', type: 'string', description: '商户订单号' },
        { name: 'merchantName', type: 'string', description: '商户名称' },
        { name: 'subject', type: 'string', description: '商品描述' },
      ],
      description: '支付宝收银台 — 接收外部支付请求',
    },
    {
      action: 'ACTION_REFUND',
      scheme: 'alipays',
      route: '/pay/refund',
      params: [
        { name: 'amount', type: 'number', description: '退款金额（元）' },
        { name: 'orderId', type: 'string', description: '商户订单号' },
        { name: 'merchantName', type: 'string', description: '商户名称' },
        { name: 'subject', type: 'string', description: '商品描述' },
      ],
      description: '支付宝退款 — 接收外部退款请求',
    },
  ],
};

