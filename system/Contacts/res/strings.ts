/**
 * Contacts string resources.
 */
export const strings = {
  // Bottom tabs
  dialerIconLabel: '通话',
  contactsAllLabel: '联系人',
  businessHallLabel: '营业厅',

  // Tabs / Title
  contactsList: '联系人',
  frequentList: '经常联系',
  favoritesList: '收藏',

  // Search
  searchHint: '搜索联系人',
  searchSearching: '正在搜索…',
  searchNoResults: '没有找到联系人',
  clearSearchHistory: '清除搜索记录',

  // Empty state
  contactsUnavailableAddAccount: '登录账号同步联系人',
  contactsUnavailableImportSimContacts: '导入 SIM 卡联系人',
  contactsUnavailableImportFromOldDevice: '导入旧设备中的联系人',
  contactsUnavailableImportContacts: '导入存储设备中的 vCard',
  contactsUnavailableCreateContact: '新建联系人',

  // Common
  cancel: '取消',
  done: '完成',
  edit: '编辑',
  delete: '删除',
  add: '添加',

  // ContactsPage header & special entries
  contactsFilterAll: '所有联系人',
  bluetoothChat: '无网通',
  myCard: '我的名片',
  myGroups: '我的群组',
  scanBusinessCard: '扫描名片',

  // SearchPage
  search_no_history: '暂无搜索记录',
  search_contacts_header: '联系人',

  // PhoneSettingsHomePage
  settings_contacts_title: '联系人设置',
  settings_calls_title: '电话设置',
  settings_opening: '正在打开设置…',

  // NewContactPage
  new_contact_title: '新建小米账号联系人',
  new_contact_name_required: '请输入姓名',
  new_contact_placeholder_name: '姓名',
  new_contact_placeholder_company: '公司',
  new_contact_placeholder_job_title: '职位',
  new_contact_label_mobile: '手机',
  new_contact_placeholder_phone: '电话',
  new_contact_label_work: '工作',
  new_contact_placeholder_email: '邮件',
  new_contact_label_group: '群组名称',

  // ContactDetailPage
  contact_not_found: '联系人不存在',
  action_call: '拨打',
  action_sms: '短信',
  section_phones: '电话',
  section_email: '邮箱',
  section_notes: '备注',
  section_call_logs: '通话记录',
  contact_no_call_logs: '暂无通话记录',
  contact_deleted_toast: '已删除',
  contact_delete_btn: '删除联系人',

  // CallDetailPage
  call_detail_title: '通话详情',
  call_log_not_found: '记录不存在',
  call_type_incoming: '呼入',
  call_type_outgoing: '呼出',
  call_type_missed: '未接',
  call_type_normal: '通话',

  // CallsPage header
  callFilterAll: '全部通话',

  // CallsPage
  call_official_badge: '官方',
  sim_card_1: '卡 1',
  sim_card_2: '卡 2',

  // BusinessHallPage
  bh_data_remaining: '流量剩余',
  bh_data_usage_analysis: '流量使用分析',
  bh_balance: '话费余额',
  bh_yuan_unit: '元',
  bh_voice_used: '语音已用',
  bh_minutes_unit: '分钟',
  bh_greeting_prefix: '你好，',
  bh_greeting_suffix: '用户',
  bh_recharge_title: '充话费',
  bh_other_number_recharge: '其他号码充值',

  // PhonePreferenceScreenPage
  settings_selected: '已选',
} as const;

export type StringKey = keyof typeof strings;
