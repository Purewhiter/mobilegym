/**
 * Maps Android IntentCommand package/class to simulated app IDs.
 */

const PACKAGE_MAP: Record<string, string> = {
  'com.android.deskclock': 'clock',
  'com.miui.weather2': 'weather',
  'com.android.calendar': 'calendar',
  'com.android.contacts': 'contacts',
  'com.android.mms': 'sms',
  'com.android.settings': 'settings',
  'com.android.camera': 'camera',
  'com.android.gallery3d': 'gallery',
  'com.miui.gallery': 'gallery',
  'com.miui.calculator': 'calculator',
  'com.miui.notes': 'notes',
  'com.miui.compass': 'compass',
  'com.android.fileexplorer': 'filemanager',
  'com.miui.securitycenter': 'settings',
  'com.mi.health': 'settings',
  'com.miui.player': 'spotify',
  'com.spotify.music': 'spotify',
  'com.tencent.mm': 'wechat',
  'com.eg.android.AlipayGphone': 'alipay',
  'com.autonavi.minimap': 'map',
  'com.miui.personalassistant': 'settings',
};

export function resolveIntent(pkg: string, _cls?: string): string | null {
  return PACKAGE_MAP[pkg] ?? null;
}

export function handleWmrIntent(pkg: string, cls?: string): boolean {
  const appId = resolveIntent(pkg, cls);
  if (appId) {
    (window as any).__OS__?.openApp?.(appId);
    return true;
  }
  return false;
}
