#!/usr/bin/env node
/**
 * Build Settings i18n dictionary from decompiled Android resources.
 *
 * Approach:
 * 1. Parse values-zh-rCN/strings.xml → resource_name → Chinese
 * 2. Parse values/strings.xml → resource_name → English
 * 3. Build Chinese → English mapping using resource_name as the bridge
 * 4. Extract all Chinese strings from pages.json (+ overrides.json)
 * 5. Add manual translations for component hardcoded strings
 * 6. Output system/Settings/i18n/en.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// Parse Android strings.xml into Map<name, value>
function parseStringsXml(filePath) {
  const xml = readFileSync(filePath, 'utf-8');
  const map = new Map();
  const regex = /<string\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    let value = match[2]
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    map.set(match[1], value);
  }
  return map;
}

function extractConfigStrings(pagesJsonPath, overridesJsonPath) {
  const strings = new Set();
  const add = (s) => {
    if (typeof s !== 'string') return;
    if (/[\u4e00-\u9fff]/.test(s)) strings.add(s);
  };

  const visitItem = (item) => {
    if (!item || typeof item !== 'object') return;
    add(item.title);
    add(item.summary);
    if (Array.isArray(item.options)) {
      for (const opt of item.options) add(opt?.label);
    }
  };

  const visitPage = (page) => {
    if (!page || typeof page !== 'object') return;
    add(page.title);
    if (Array.isArray(page.categories)) {
      for (const cat of page.categories) {
        add(cat?.title);
        if (Array.isArray(cat?.items)) {
          for (const it of cat.items) visitItem(it);
        }
      }
    }
  };

  const pagesData = JSON.parse(readFileSync(pagesJsonPath, 'utf-8'));
  for (const section of pagesData?.mainSections || []) {
    for (const item of section?.items || []) visitItem(item);
  }
  for (const page of Object.values(pagesData?.pages || {})) visitPage(page);

  const overrides = JSON.parse(readFileSync(overridesJsonPath, 'utf-8'));
  for (const page of Object.values(overrides || {})) visitPage(page);

  return strings;
}

const zhMap = parseStringsXml('decompiled/Settings_decompiled/res/values-zh-rCN/strings.xml');
const enMap = parseStringsXml('decompiled/Settings_decompiled/res/values/strings.xml');

console.log(`Parsed ${zhMap.size} zh-rCN entries, ${enMap.size} en entries`);

// Build Chinese → English via resource name
const zhToEn = new Map();
for (const [name, zhValue] of zhMap) {
  const enValue = enMap.get(name);
  if (enValue && zhValue !== enValue) {
    zhToEn.set(zhValue, enValue);
  }
}

console.log(`Built ${zhToEn.size} Chinese→English mappings from decompiled resources`);

// Extract config strings
const configStrings = extractConfigStrings('system/Settings/data/pages.json', 'system/Settings/data/overrides.json');
console.log(`Found ${configStrings.size} unique Chinese strings in generated config`);

// Collect all translations: start with config matches
const allTranslations = new Map();

for (const zh of configStrings) {
  if (zhToEn.has(zh)) {
    allTranslations.set(zh, zhToEn.get(zh));
  }
}

console.log(`Auto-matched: ${allTranslations.size} config strings`);

// ── Manual translations for unmatched config strings ──
const manualConfigTranslations = {
  'OEM 解锁': 'OEM unlocking',
  '不广播时关闭该模式': 'Turn off this mode when not broadcasting',
  '以旧换新': 'Trade-in',
  '使用 2 个 SIM 卡时，此手机将仅限使用 4G 网络。': 'When using 2 SIM cards, this phone will be limited to 4G network.',
  '使用人脸解锁时': 'When using face unlock',
  '保修期': 'Warranty period',
  '其他系统更新': 'Other system updates',
  '加入蓝牙共享广播': 'Join Bluetooth broadcast',
  '在紧急求救功能启动时发出响亮的声音': 'Play a loud sound when emergency SOS is activated',
  '在设备上显示的应用': 'Apps shown on device',
  '备份服务未启用': 'Backup service is not enabled',
  '头像': 'Avatar',
  '如何卸载应用？': 'How to uninstall apps?',
  '如何查询软件安装及运行所需权限列表？': 'How to check the list of permissions required by apps?',
  '如何禁用功能？': 'How to disable features?',
  '字体粗细': 'Font weight',
  '对于某些系统应用，您可以在应用的设置项中禁用应用部分扩展功能。如果需要恢复这些扩展功能，您可以再次到设置项中重新开启。': 'For some system apps, you can disable certain features in the app settings. To restore these features, go back to the settings and re-enable them.',
  '广播加密状态': 'Broadcast encryption status',
  '广播同步状态': 'Broadcast sync status',
  '广播密码': 'Broadcast password',
  '广播源ID': 'Broadcast source ID',
  '广播源地址': 'Broadcast source address',
  '广播音频同步状态': 'Broadcast audio sync status',
  '您可以到设置-应用设置-应用管理中，选择想要查看的应用，在应用信息里点击\u201c查看权限详情\u201d来查看软件所需权限。您也可以在桌面按菜单键然后长按应用快速进入应用信息页，然后直接点击查看权限详情。在用户的开机引导页面里您也可以快速查看所有的软件安装及所需权限列表信息。': 'Go to Settings > Apps > Manage apps, select the app you want to check, then tap "View permission details" to see the permissions required. You can also long-press the app icon on the home screen to access app info and view permission details directly.',
  '您可以到设置-应用设置-应用管理中，选择支持卸载的应用并点击卸载。卸载系统预置组件可能导致系统部分功能无法正常使用或运行出现异常，建议谨慎操作。对于可卸载的第三方应用，您还可以在桌面上长按图标，然后拖拽到屏幕上方的垃圾桶卸载应用。': 'Go to Settings > Apps > Manage apps, select the app and tap Uninstall. Uninstalling pre-installed system apps may cause some features to malfunction. For third-party apps, you can also long-press the icon on the home screen and drag it to the trash icon to uninstall.',
  '无法自动设置时区': 'Unable to set timezone automatically',
  '未知密码': 'Unknown password',
  '未知状态': 'Unknown status',
  '本机权益': 'Device benefits',
  '检查应用活动是否存在钓鱼式攻击': 'Check app activity for phishing attacks',
  '此页面内容由系统动态生成，模拟尚未完全实现': 'This page content is dynamically generated by the system; simulation is not fully implemented',
  '点按': 'Tap',
  '翻转相机切换自拍模式': 'Flip camera to switch to selfie mode',
  '联网查看详细的预置应用信息': 'Go online to view detailed pre-installed app info',
  '蓝牙共享广播': 'Bluetooth broadcast sharing',
  '蓝牙共享音频': 'Bluetooth shared audio',
  '规则名称': 'Rule name',
};

for (const [zh, en] of Object.entries(manualConfigTranslations)) {
  allTranslations.set(zh, en);
}

// ── Component hardcoded strings (manual translations) ──
const componentTranslations = {
  // SettingsMainPage.tsx
  '设置': 'Settings',
  '搜索系统设置项': 'Search settings',
  '新版本': 'New version',
  '管理账号、云服务、会员权益等': 'Manage accounts, cloud services, membership benefits, etc.',
  '小米用户': 'Xiaomi User',
  '此设置项在真机上会打开系统页面，当前模拟暂不支持': 'This setting would open a system page on a real device; simulation not supported yet',
  '未连接': 'Not connected',
  '已关闭': 'Off',
  '已开启': 'On',

  // LanguagePickerPage.tsx
  '中文（简体）': '中文（简体）',
  '中文（繁體）': '中文（繁體）',
  '语言': 'Language',

  // PreferenceScreen.tsx
  '锁屏、密码与指纹': 'Lock screen, passwords & fingerprints',
  '开启': 'On',
  '关闭': 'Off',
  '真机上通常会打开系统页面': 'On a real device this would open a system page',
  '当前模拟暂不支持完整内容。': 'Full content simulation is not yet supported.',
  '管理已保存网络': 'Manage saved networks',
  '已保存的网络': 'Saved networks',
  '此页面内容暂未加载': 'This page content has not loaded yet',
  '主题商店不可用': 'Theme Store unavailable',
  '该设置项未提供可选项，可能由系统动态生成': 'This setting has no available options; may be dynamically generated by the system',
  '已复制到剪贴板': 'Copied to clipboard',
  '无法获取': 'Unable to retrieve',

  // BluetoothDevicesPage.tsx
  '蓝牙': 'Bluetooth',
  '请先开启蓝牙': 'Please enable Bluetooth first',
  '已断开连接': 'Disconnected',
  '已连接': 'Connected',
  '已配对并连接': 'Paired and connected',
  '开关': 'Toggle',
  '本机': 'This device',
  '设备名称': 'Device name',
  '已配对设备': 'Paired devices',
  '暂无已配对设备': 'No paired devices',
  '音频设备': 'Audio device',
  '可穿戴设备': 'Wearable device',
  '蓝牙设备': 'Bluetooth device',
  '可用设备': 'Available devices',
  '暂无可用设备': 'No available devices',
  '更多设置': 'More settings',
  '高级设置': 'Advanced settings',
  '快连、连接通知、图标显示等': 'Quick connect, connection notifications, icon display, etc.',
  '请输入蓝牙名称': 'Enter Bluetooth name',
  '名称不能为空': 'Name cannot be empty',
  '已更新': 'Updated',

  // WifiNetworksPage.tsx
  'WLAN': 'WLAN',
  '无密码': 'No password',
  '请先开启 WLAN': 'Please enable WLAN first',
  '可用网络': 'Available networks',
  '未发现可用网络': 'No available networks found',
  '隐藏网络': 'Hidden network',
  '网络管理': 'Network management',
  '查看与管理已保存的 WLAN': 'View and manage saved WLAN networks',
  '代理、随机 MAC、网络偏好等': 'Proxy, random MAC, network preferences, etc.',
  '请输入密码': 'Enter password',
  '连接': 'Connect',

  // WifiSavedNetworkDetailPage.tsx
  '网络详情': 'Network details',
  '该网络不存在或已被移除': 'This network does not exist or has been removed',
  '状态': 'Status',
  '安全性': 'Security',
  '无': 'None',
  '连接状态': 'Connection status',
  '未连接': 'Not connected',
  '选项': 'Options',
  '自动加入': 'Auto-join',
  '重新连接': 'Reconnect',
  'WLAN 已关闭': 'WLAN is off',
  '忘记网络': 'Forget network',
  '从已保存网络中移除': 'Remove from saved networks',
  '已移除': 'Removed',

  // WifiSavedNetworksPage.tsx
  'WLAN 已关闭。你仍可管理已保存的网络，但无法连接。': 'WLAN is off. You can still manage saved networks but cannot connect.',
  '添加网络': 'Add network',
  '手动添加一个 WLAN 网络': 'Manually add a WLAN network',
  '不自动加入': 'Don\'t auto-join',
  '网络名称(SSID)': 'Network name (SSID)',
  '输入密码': 'Enter password',
  '可留空（无密码网络）': 'Leave empty for open networks',
  '添加': 'Add',
  '已添加到已保存网络': 'Added to saved networks',

  // SilentModeSettingsPage.tsx
  '已切换：无': 'Switched: None',
  '已切换：静音': 'Switched: Silent',
  '已切换：勿扰': 'Switched: Do Not Disturb',
  '所有音量正常': 'All volumes at normal level',
  '静音': 'Silent',
  '禁止来电和通知铃声': 'Mute incoming calls and notification ringtones',
  '勿扰': 'Do Not Disturb',
  '禁止来电、通知的铃声和振动': 'Mute ringtones and vibrations for calls and notifications',
  '静音/勿扰': 'Silent / DND',
  '静音模式': 'Silent mode',
  '例外（模拟）': 'Exceptions (simulated)',
  '允许来电提醒': 'Allow call alerts',
  '所有人': 'Everyone',
  '所有联系人': 'All contacts',
  '所有收藏联系人': 'Starred contacts',
  '重复来电提醒': 'Repeat callers',
  '15 分钟内重复来电时允许提醒（模拟）': 'Allow alerts for repeat calls within 15 minutes (simulated)',
  '更多（模拟）': 'More (simulated)',
  '屏蔽媒体音': 'Block media sound',
  '屏蔽小爱同学声音': 'Block XiaoAi voice',
  '禁止悬浮通知': 'Block floating notifications',
  '开启后将不再显示顶部横幅通知': 'When enabled, top banner notifications will be hidden',
  '允许网络电话响铃': 'Allow VoIP ringing',

  // NotificationManagingPage.tsx
  '通知管理': 'Notification management',
  '应用通知': 'App notifications',

  // NotificationAppDetailPage.tsx
  '未找到应用': 'App not found',
  '（空）': '(empty)',
  '通知权限': 'Notification permission',
  '允许通知': 'Allow notifications',
  '关闭后，该应用将无法发送系统通知': 'When off, this app cannot send system notifications',
  '已关闭并清除通知': 'Notifications disabled and cleared',
  '已开启通知': 'Notifications enabled',
  '清除该应用所有通知': 'Clear all notifications for this app',
  '立即从通知栏移除该应用的通知': 'Remove this app\'s notifications from the notification bar immediately',
  '已清除': 'Cleared',
  '桌面与提示': 'Home screen & alerts',
  '桌面角标': 'Badge',
  '在桌面图标右上角显示未读数量': 'Show unread count on home screen icon',
  '声音与振动（模拟）': 'Sound & vibration (simulated)',
  '通知提示音': 'Notification sound',
  '当前模拟仅保存开关状态': 'Simulation only saves toggle state',
  '震动': 'Vibration',
  '调试': 'Debug',
  '发送测试通知': 'Send test notification',
  '用于验证通知开关/角标联动': 'For testing notification toggle / badge sync',
  '这是一条测试通知': 'This is a test notification',
  '已发送': 'Sent',

  // StorageDashboardPage.tsx
  '存储空间': 'Storage',
  '存储使用情况': 'Storage usage',
  '分类': 'Categories',
  '文件': 'Files',
  '浏览 /sdcard': 'Browse /sdcard',
  '图片': 'Photos',
  '视频': 'Videos',
  '音频': 'Audio',
  '文档': 'Documents',
  '刷新统计': 'Refresh statistics',
  '重新计算存储占用': 'Recalculate storage usage',

  // LauncherSettingsPage.tsx
  '桌面': 'Home screen',
  '布局': 'Layout',
  '桌面布局': 'Home screen layout',
  '调整桌面网格（立即生效）': 'Adjust home screen grid (takes effect immediately)',
  '图标大小': 'Icon size',
  '80% ～ 120%（立即生效）': '80% - 120% (takes effect immediately)',
  '图标居上': 'Icons at top',
  '仅模拟保存开关状态（暂不影响自动排布）': 'Simulation only saves toggle state (does not affect auto-layout)',
  '操作（模拟）': 'Actions (simulated)',
  '负一屏': 'Left screen',
  '当前模拟仅保存开关状态': 'Simulation only saves toggle state',
  '图标打开动画': 'Icon open animation',

  // InputDialog.tsx / ListPreference.tsx
  '确定': 'OK',
  '取消': 'Cancel',
  '已选': 'Selected',

  // ValuePreference.tsx
  '已设置': 'Set',
  '请输入值': 'Enter value',

  // SettingsSearchPage.tsx
  '清除': 'Clear',
  '输入关键词开始搜索': 'Enter keywords to search',
  '未找到相关设置': 'No matching settings found',

  // SettingsHeader.tsx
  '返回': 'Back',
};

for (const [zh, en] of Object.entries(componentTranslations)) {
  allTranslations.set(zh, en);
}

console.log(`Total translations (config + component): ${allTranslations.size}`);

// ── Write system/Settings/i18n/en.ts ──
mkdirSync('system/Settings/i18n', { recursive: true });

// Sort entries for readability
const sorted = [...allTranslations.entries()].sort((a, b) => a[0].localeCompare(b[0], 'zh'));

// Escape single quotes for TS string literals
function escapeTs(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

let tsContent = `// Auto-generated from decompiled Android resources + manual component translations
// Run: node scripts/build_settings_i18n.mjs
// Source: decompiled/Settings_decompiled/res/values/strings.xml (English)
//         decompiled/Settings_decompiled/res/values-zh-rCN/strings.xml (Chinese)

export const EN: Record<string, string> = {\n`;

for (const [zh, en] of sorted) {
  tsContent += `  '${escapeTs(zh)}': '${escapeTs(en)}',\n`;
}

tsContent += `};\n`;

writeFileSync('system/Settings/i18n/en.ts', tsContent);
console.log(`\nWrote system/Settings/i18n/en.ts with ${sorted.length} entries`);

// ── Write system/Settings/i18n/index.ts ──
const indexContent = `import { useLocale } from '@/os/locale';
import { EN } from './en';

export function useSettingsT(): (zh: string) => string {
  const locale = useLocale();
  if (locale === 'zh-Hans') return (zh) => zh;
  return (zh) => EN[zh] ?? zh;
}
`;

writeFileSync('system/Settings/i18n/index.ts', indexContent);
console.log('Wrote system/Settings/i18n/index.ts');
