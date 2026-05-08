import type { Locale } from '@/os/locale';
import type { PhoneSettingsPage } from '../settings/types';

const PHONE_SETTINGS_PAGE_TITLES_ZH: Record<string, string> = {
  miui_call_feature_setting: '电话',
  miui_network_setting: '移动网络',
  call_record_setting: '通话录音',
  location_setting: '归属地及国家码',
  auto_answer_setting: '自动接听',
  call_advanced_setting: '高级设置',
  privacy_setting: '隐私设置',
  permission_setting: '权限说明',
  answer_state_setting: '来电时状态',
  call_fold_setting: '折叠屏通话设置',
  miui_phone_account_settings: '通话账户',
  miui_callforward_options: '来电转接',
  miui_voicemail_callforward_options: '语音信箱与转移',
  call_waiting: '来电等待',
  miui_fdn_setting: '固定拨号',
  voicemail_setting: '语音信箱',
  miui_respond_via_sms_settings: '来电拒接短信',
  auto_ip_setting: '自动IP拨号',
  preference_settings: '联系人设置',
  preference_import_and_export: '导入/导出',
  preference_display_options: '显示选项',
  preference_more: '更多设置',
  preference_privacy_settings: '隐私设置',
  preference_privacy_contacts: '隐私-联系人',
  preference_privacy_permission: '隐私-权限',
  preference_account_list_filter: '联系人显示范围',
  preference_dial_pad_touch_tone: '拨号音',
  preference_dial_pad_touch_tone_v11: '拨号音',
  preference_device_other_fragment: '其他设置',
};

const PHONE_SETTINGS_TEXT_EN: Record<string, string> = {
  '联系人显示范围': 'Visible contacts',
  '账户：该页面由系统动态生成，模拟暂不支持': 'Accounts: this page is generated dynamically by the system and is not available in the simulator',
  '其他设置': 'Other settings',
  '设备': 'Device',
  '支持蓝牙': 'Bluetooth supported',
  '不支持蓝牙': 'Bluetooth not supported',
  '拨号音': 'Dial pad sound',
  '拨号键盘触摸音效': 'Dial pad touch tone',
  '音效': 'Sound effect',
  '默认': 'Default',
  '钢琴音': 'Piano tone',
  '显示选项': 'Display options',
  '公司': 'Company',
  '根据联系人公司分组': 'Group contacts by company',
  '所在地': 'Location',
  '根据电话号码归属地分组': 'Group contacts by phone number location',
  '最近联系时间': 'Recent contact time',
  '根据上次电话或短信联系时间分组': 'Group by the time of the last call or text',
  '导入/导出': 'Import / export',
  '导入': 'Import',
  '从存储设备导入': 'Import from storage',
  '从 SIM 卡导入': 'Import from SIM card',
  '从 SIM 卡2导入': 'Import from SIM card 2',
  '从其他设备导入': 'Import from another device',
  '导出': 'Export',
  '导出到存储设备': 'Export to storage',
  '导出到 SIM 卡': 'Export to SIM card',
  '导出到 SIM 卡2': 'Export to SIM card 2',
  '分享联系人': 'Share contacts',
  '账号导入': 'Account import',
  '导入到小米账号': 'Import to Mi Account',
  '把Google和Exchange联系人导入到我的小米账号': 'Import Google and Exchange contacts into my Mi Account',
  '更多设置': 'More settings',
  '清空联系人数据': 'Clear contact data',
  '重建索引数据': 'Rebuild index data',
  'SIM 卡管理': 'SIM card management',
  'SIM 卡2管理': 'SIM card 2 management',
  '查看 SDN': 'View SDN',
  '查看 SDN 卡2': 'View SDN card 2',
  '隐私-联系人': 'Privacy - Contacts',
  '隐私政策': 'Privacy policy',
  '查看隐私政策': 'View privacy policy',
  '权限相关': 'Permissions',
  '权限说明': 'Permission details',
  '隐私-权限': 'Privacy - Permissions',
  '读取联系人': 'Read contacts',
  '用于实现查看联系人数据等功能': 'Used to view contact data and related features',
  '修改联系人': 'Modify contacts',
  '用于实现管理联系人数据等功能': 'Used to manage contact data and related features',
  '读取通话记录': 'Read call logs',
  '用于实现查看通话记录数据等功能': 'Used to view call log data and related features',
  '修改通话记录': 'Modify call logs',
  '用于实现修改通话记录数据等功能': 'Used to modify call log data and related features',
  '获取设备信息': 'Get device information',
  '用于实现读取设备SIM卡信息等功能': 'Used to read device SIM information and related features',
  '读写设备存储': 'Read and write device storage',
  '用于从相册添加联系人头像、导入vCard等功能': 'Used to add contact photos from albums and import vCards',
  '拍摄照片和录制视频': 'Take photos and record videos',
  '用于从拍摄照片和修改头像等功能': 'Used to take photos and update avatars',
  '拨打电话': 'Make phone calls',
  '用于实现使用桌面快捷方式拨打电话功能': 'Used to make calls through desktop shortcuts',
  '定位': 'Location',
  '用于通过蓝牙从其他设备导入联系人等功能': 'Used to import contacts from other devices over Bluetooth',
  '连接附近的设备': 'Connect nearby devices',
  '隐私设置': 'Privacy settings',
  '通讯录与拨号隐私设置': 'Contacts and dialer privacy settings',
  '小米黄页隐私设置': 'Mi Yellow Pages privacy settings',
  '联系人设置': 'Contacts settings',
  '导入或导出联系人': 'Import or export contacts',
  '联系人显示': 'Contact display',
  '显示联系人头像': 'Show contact photos',
  '无头像则显示文字头像': 'Show letter avatars when no photo is available',
  '仅显示有电话的联系人': 'Only show contacts with phone numbers',
  '显示 SIM 卡联系人': 'Show SIM contacts',
  '分账号显示': 'Show by account',
  '列表排序依据': 'Sort order',
  '联系人姓名的显示方式': 'Name display format',
  '联系人整理': 'Contact organization',
  '合并重复联系人': 'Merge duplicate contacts',
  '批量删除联系人': 'Delete contacts in bulk',
  '更多整理方式': 'More organization options',
  '查看 SIM 卡容量': 'View SIM card capacity',
  '恢复联系人': 'Restore contacts',
  '智能分组': 'Smart grouping',
  '黄页功能设置': 'Yellow Pages settings',
  '通话记录显示拦截号码': 'Show blocked numbers in call history',
  '营业厅': 'Mobile Services',
  '电话': 'Phone',
  '通话服务设置': 'Call service settings',
  '呼叫限制, 语音信箱 & 呼叫转移, 以及呼叫等待': 'Call barring, voicemail and call forwarding, plus call waiting',
  '通话账户设置': 'Calling accounts',
  '移动网络': 'Mobile network',
  '展开手机接听语音来电': 'Answer voice calls when unfolding the phone',
  '合上手机挂断电话': 'Hang up when folding the phone',
  '仅在未使用蓝牙耳机及线控耳机时生效': 'Only works when Bluetooth and wired headsets are not in use',
  '免费电话': 'Free calls',
  '通话录音': 'Call recording',
  '来电转接': 'Call forwarding',
  '语音信箱/呼叫转移': 'Voicemail / call forwarding',
  '来电等待': 'Call waiting',
  '来电时状态': 'Incoming call status',
  '设置来电时其他选项': 'Configure additional incoming call options',
  'AI通话': 'AI calling',
  '智能识别陌生号码': 'Smart unknown number identification',
  '骚扰拦截': 'Spam blocking',
  '归属地及国家码': 'Location and country code',
  '自动接听': 'Auto answer',
  '贴耳接听': 'Raise to answer',
  '来电时靠近耳朵自动接听': 'Automatically answer when the phone is near your ear',
  '来电播报': 'Caller announcement',
  '折叠设置': 'Fold settings',
  '5G新通话': '5G New Calling',
  '5G新通话全部服务由运营商提供': 'All 5G New Calling services are provided by the carrier',
  '高级设置': 'Advanced settings',
  '意见反馈': 'Feedback',
};

const CONTACT_LABEL_EN: Record<string, string> = {
  '手机': 'Mobile',
  '工作': 'Work',
  '公司': 'Company',
  '住宅': 'Home',
  '家': 'Home',
  '邮箱': 'Email',
  '邮件': 'Email',
};

function isAscii(value: string): boolean {
  return /^[\x00-\x7F\s]*$/.test(value);
}

export function localizePhoneSettingsText(text: string | undefined, locale: Locale): string {
  const raw = String(text ?? '').trim();
  if (!raw || locale !== 'en' || isAscii(raw)) {
    return raw;
  }
  return PHONE_SETTINGS_TEXT_EN[raw] ?? raw;
}

export function getPhoneSettingsPageTitle(pageId: string, locale: Locale): string {
  const title = PHONE_SETTINGS_PAGE_TITLES_ZH[pageId] ?? pageId;
  return localizePhoneSettingsText(title, locale);
}

export function localizePhoneSettingsPage(
  page: PhoneSettingsPage | undefined,
  locale: Locale,
): PhoneSettingsPage | undefined {
  if (!page || locale !== 'en') {
    return page;
  }

  return {
    ...page,
    title: localizePhoneSettingsText(page.title, locale),
    categories: page.categories.map((category) => ({
      ...category,
      title: localizePhoneSettingsText(category.title, locale),
      items: category.items.map((item) => ({
        ...item,
        title: localizePhoneSettingsText(item.title, locale),
        summary: localizePhoneSettingsText(item.summary, locale),
        options: item.options?.map((option) => ({
          ...option,
          label: localizePhoneSettingsText(option.label, locale),
        })),
      })),
    })),
  };
}

export function localizeContactLabel(label: string | undefined, locale: Locale): string {
  const raw = String(label ?? '').trim();
  if (!raw || locale !== 'en') {
    return raw;
  }
  if (isAscii(raw)) {
    return raw;
  }
  return CONTACT_LABEL_EN[raw] ?? raw;
}
