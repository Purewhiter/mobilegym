import type { AttachmentOption, SettingsCategory } from './types';

/** Attachment panel options from screen_03_new_message_add */
export const ATTACHMENT_OPTIONS: AttachmentOption[] = [
  { id: 'emoji', icon: 'ic_attach_smiley', label: '表情' },
  { id: 'card', icon: 'ic_attach_contact', label: '名片' },
  { id: 'image', icon: 'ic_attach_photo', label: '图片' },
  { id: 'photo', icon: 'ic_attach_take_photo', label: '拍照' },
  { id: 'favorites', icon: 'ic_attach_phrase', label: '我的收藏' },
  { id: 'schedule', icon: 'ic_attach_timing', label: '定时' },
  { id: 'theme', icon: 'ic_attach_subject', label: '主题' },
  { id: 'audio', icon: 'ic_attach_sound', label: '音频' },
  { id: 'video', icon: 'ic_attach_video', label: '视频' },
  { id: 'slideshow', icon: 'ic_attach_slide_show', label: '幻灯片' },
];

/** Main settings page structure from screen_05_setting */
export const MAIN_SETTINGS: SettingsCategory[] = [
  {
    title: '免费网络短信',
    items: [
      {
        key: 'free_sms_sim1',
        title: '免费网络短信(SIM卡1)',
        summary: '当前在线',
      },
      {
        key: 'free_sms_sim2',
        title: '免费网络短信(SIM卡2)',
        summary: '当前在线',
      },
      {
        key: 'network_sms_settings',
        title: '网络短信设置',
        targetPage: '/settings/free-network-sms',
      },
    ],
  },
  {
    title: '5G消息',
    items: [
      {
        key: '5g_message',
        title: '5G消息',
        summary: '开启后，默认通过WLAN或移动网络收发短信',
      },
      {
        key: 'app_id',
        title: '应用号',
        targetPage: '/settings/app-id',
      },
      {
        key: '5g_settings',
        title: '5G消息设置',
        targetPage: '/settings/5g-message',
      },
    ],
  },
  {
    title: '显示',
    items: [
      {
        key: 'show_avatar',
        title: '列表中显示头像',
        summary: '显示头像以及公司等信息',
      },
      {
        key: 'text_avatar',
        title: '文字头像',
        summary: '为没有头像的联系人自动添加文字',
      },
    ],
  },
];

/** Free network SMS settings from screen_06_free_msg */
export const FREE_SMS_SETTINGS: SettingsCategory = {
  title: '免费网络短信',
  items: [
    {
      key: 'auto_convert_sms',
      title: '自动转为短信',
      summary: '使用免费网络短信发送短信失败时转为通过运营商发送，可能要缴纳运营商费用',
    },
    {
      key: 'auto_convert_mms',
      title: '自动转为彩信',
      summary: '使用免费网络短信发送彩信失败时转为通过运营商发送，可能要缴纳运营商费用',
    },
    {
      key: 'block_strangers',
      title: '屏蔽陌生人的网络短信',
      summary: '开启后，未保存为联系人的小米手机用户将无法给您发送网络短信',
    },
  ],
};

/** Advanced settings from screen_07_advance */
export const ADVANCED_SETTINGS: SettingsCategory[] = [
  {
    title: '彩信',
    items: [
      { key: 'mms_read_report', title: '彩信已读报告', targetPage: '/settings/mms-read-report' },
      { key: 'auto_download_mms', title: '自动下载彩信', targetPage: '/settings/mms-download' },
      { key: 'roaming_download', title: '漫游时自动下载', targetPage: '/settings/roaming' },
    ],
  },
  {
    title: '系统',
    items: [
      {
        key: 'wap_push',
        title: '允许WAP推送',
        summary: '允许接收和提醒WAP推送消息(SI/SL)',
      },
      { key: 'sms_center', title: '设置短信中心号码', targetPage: '/settings/sms-center' },
      { key: 'sim_messages', title: '管理SIM卡中的信息', targetPage: '/settings/sim-messages' },
    ],
  },
  {
    title: '提醒和通知',
    items: [
      {
        key: 'show_preview',
        title: '显示预览内容',
        summary: '允许短信通知显示预览内容',
      },
      {
        key: 'delivery_report',
        title: '送达报告',
        summary: '对方收到短信后返回报告',
      },
    ],
  },
];

/** 5G Message settings from screen_08_5g */
export const FIVEG_SETTINGS: SettingsCategory[] = [
  {
    title: '',
    items: [
      {
        key: '5g_auto_sms',
        title: '自动转为短信',
        summary: '5G消息文本消息发送失败时转为通过普通短信发送，可能要缴纳运营商费用',
      },
      {
        key: '5g_auto_mms',
        title: '自动转为彩信',
        summary: '5G消息图片/视频/音频/长文本消息发送失败时转为通过彩信发送，可能要缴纳运营商费用',
      },
      {
        key: '5g_read_report',
        title: '回执报告',
        summary: '对方收到短信后返回已读状态',
      },
    ],
  },
  {
    title: '其他',
    items: [
      { key: 'service_agreement', title: '服务协议', targetPage: '/settings/service' },
      { key: 'privacy_policy', title: '隐私政策', targetPage: '/settings/privacy' },
    ],
  },
];

