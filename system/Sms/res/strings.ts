/**
 * Sms 字符串资源 — 对应 AOSP res/values/strings.xml
 * 附件面板标签 + 设置页标题/描述
 */
export const strings = {
  // Attachment panel labels
  attachment_emoji: '表情',
  attachment_card: '名片',
  attachment_image: '图片',
  attachment_photo: '拍照',
  attachment_favorites: '我的收藏',
  attachment_schedule: '定时',
  attachment_theme: '主题',
  attachment_audio: '音频',
  attachment_video: '视频',
  attachment_slideshow: '幻灯片',

  // Settings category titles
  settings_cat_free_sms: '免费网络短信',
  settings_cat_5g: '5G消息',
  settings_cat_display: '显示',
  settings_cat_mms: '彩信',
  settings_cat_system: '系统',
  settings_cat_notifications: '提醒和通知',
  settings_cat_other: '其他',

  // Settings item titles
  settings_free_sms_sim1: '免费网络短信(SIM卡1)',
  settings_free_sms_sim2: '免费网络短信(SIM卡2)',
  settings_network_sms: '网络短信设置',
  settings_5g_message: '5G消息',
  settings_app_id: '应用号',
  settings_5g_settings: '5G消息设置',
  settings_show_avatar: '列表中显示头像',
  settings_text_avatar: '文字头像',
  settings_auto_convert_sms: '自动转为短信',
  settings_auto_convert_mms: '自动转为彩信',
  settings_block_strangers: '屏蔽陌生人的网络短信',
  settings_mms_read_report: '彩信已读报告',
  settings_auto_download_mms: '自动下载彩信',
  settings_roaming_download: '漫游时自动下载',
  settings_wap_push: '允许WAP推送',
  settings_sms_center: '设置短信中心号码',
  settings_sim_messages: '管理SIM卡中的信息',
  settings_show_preview: '显示预览内容',
  settings_delivery_report: '送达报告',
  settings_5g_read_report: '回执报告',
  settings_service_agreement: '服务协议',
  settings_privacy_policy: '隐私政策',

  // Page-level UI strings
  app_name: '短信',
  search_hint: '搜索短信',
  toast_cleared_prefix: '已清除 ',
  toast_cleared_suffix: ' 条未读',
  toast_no_unread: '没有未读短信',
  empty_search_results: '没有匹配的短信',
  new_message_title: '新建短信',
  recipient_label: '收信人:',
  pick_contact_title: '选择联系人',
  cancel: '取消',
  sms_placeholder: '短信',
  conversation_not_found: '会话不存在',
  empty_messages: '暂无消息，发一条试试',
  status_sending: '发送中…',
  status_sent: '已发送',
  free_sms_desc: '小米设备之间优先通过互联网发送免费网络短信',
  free_sms_stats: '自上次启用，您已经发送了 2 条免费网络短信，0条免费网络彩信',
  settings_title: '短信设置',
  placeholder_not_implemented: '该页面暂未实现',
  advanced_settings_title: '高级设置',

  // Error dialog
  error_invalid_recipient_title: '无法发送此信息',
  error_invalid_recipient_body: '您发送的信息中含有无效的收信人',
  error_invalid_recipient_ok: '知道了',

  // Context menu (long press on conversation)
  menu_delete: '删除',
  menu_mark_unread: '标为未读',
  menu_mark_read: '标为已读',
  menu_pin: '置顶',
  menu_unpin: '取消置顶',
  menu_block: '加入黑名单',
  menu_add_contact: '添加到联系人',
  menu_encrypt: '加密',

  // Settings item summaries
  summary_currently_online: '当前在线',
  summary_5g_message: '开启后，默认通过WLAN或移动网络收发短信',
  summary_show_avatar: '显示头像以及公司等信息',
  summary_text_avatar: '为没有头像的联系人自动添加文字',
  summary_auto_convert_sms: '使用免费网络短信发送短信失败时转为通过运营商发送，可能要缴纳运营商费用',
  summary_auto_convert_mms: '使用免费网络短信发送彩信失败时转为通过运营商发送，可能要缴纳运营商费用',
  summary_block_strangers: '开启后，未保存为联系人的小米手机用户将无法给您发送网络短信',
  summary_wap_push: '允许接收和提醒WAP推送消息(SI/SL)',
  summary_show_preview: '允许短信通知显示预览内容',
  summary_delivery_report: '对方收到短信后返回报告',
  summary_5g_auto_sms: '5G消息文本消息发送失败时转为通过普通短信发送，可能要缴纳运营商费用',
  summary_5g_auto_mms: '5G消息图片/视频/音频/长文本消息发送失败时转为通过彩信发送，可能要缴纳运营商费用',
  summary_5g_read_report: '对方收到短信后返回已读状态',
} as const;

export type StringKey = keyof typeof strings;
