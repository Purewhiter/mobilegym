import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  // Page-level UI strings
  app_name: 'Messages',
  search_hint: 'Search messages',
  toast_cleared_prefix: 'Cleared ',
  toast_cleared_suffix: ' unread',
  toast_no_unread: 'No unread messages',
  empty_search_results: 'No matching messages',
  new_message_title: 'New message',
  recipient_label: 'To:',
  pick_contact_title: 'Select contact',
  cancel: 'Cancel',
  sms_placeholder: 'Message',
  conversation_not_found: 'Conversation not found',
  empty_messages: 'No messages yet. Say hello!',
  status_sending: 'Sending…',
  status_sent: 'Sent',
  free_sms_desc: 'Send free Internet SMS between Xiaomi devices',
  free_sms_stats: 'Since last enabled, you have sent 2 free Internet SMS and 0 free MMS',
  settings_title: 'Messages Settings',
  placeholder_not_implemented: 'This page is not yet implemented',
  advanced_settings_title: 'Advanced Settings',

  // Error dialog
  error_invalid_recipient_title: 'Unable to send message',
  error_invalid_recipient_body: 'The message contains an invalid recipient',
  error_invalid_recipient_ok: 'OK',

  // Context menu
  menu_delete: 'Delete',
  menu_mark_unread: 'Mark as unread',
  menu_mark_read: 'Mark as read',
  menu_pin: 'Pin',
  menu_unpin: 'Unpin',
  menu_block: 'Block',
  menu_add_contact: 'Add to contacts',
  menu_encrypt: 'Encrypt',

  // Attachment panel labels
  attachment_emoji: 'Emoji',
  attachment_card: 'Contact',
  attachment_image: 'Image',
  attachment_photo: 'Camera',
  attachment_favorites: 'Favorites',
  attachment_schedule: 'Schedule',
  attachment_theme: 'Theme',
  attachment_audio: 'Audio',
  attachment_video: 'Video',
  attachment_slideshow: 'Slideshow',

  // Settings category titles
  settings_cat_free_sms: 'Free Internet SMS',
  settings_cat_5g: '5G Message',
  settings_cat_display: 'Display',
  settings_cat_mms: 'MMS',
  settings_cat_system: 'System',
  settings_cat_notifications: 'Alerts & Notifications',
  settings_cat_other: 'Other',

  // Settings item titles
  settings_free_sms_sim1: 'Free Internet SMS (SIM 1)',
  settings_free_sms_sim2: 'Free Internet SMS (SIM 2)',
  settings_network_sms: 'Internet SMS Settings',
  settings_5g_message: '5G Message',
  settings_app_id: 'App ID',
  settings_5g_settings: '5G Message Settings',
  settings_show_avatar: 'Show avatars in list',
  settings_text_avatar: 'Text avatar',
  settings_auto_convert_sms: 'Auto-convert to SMS',
  settings_auto_convert_mms: 'Auto-convert to MMS',
  settings_block_strangers: 'Block messages from strangers',
  settings_mms_read_report: 'MMS read report',
  settings_auto_download_mms: 'Auto-download MMS',
  settings_roaming_download: 'Auto-download while roaming',
  settings_wap_push: 'Allow WAP push',
  settings_sms_center: 'Set SMS center number',
  settings_sim_messages: 'Manage messages on SIM card',
  settings_show_preview: 'Show preview content',
  settings_delivery_report: 'Delivery report',
  settings_5g_read_report: 'Read receipt',
  settings_service_agreement: 'Terms of Service',
  settings_privacy_policy: 'Privacy Policy',

  // Settings item summaries
  summary_currently_online: 'Currently online',
  summary_5g_message:
    'When enabled, messages are sent and received via Wi-Fi or mobile data by default',
  summary_show_avatar: 'Show avatars and company information',
  summary_text_avatar:
    'Automatically generate text avatars for contacts without a profile picture',
  summary_auto_convert_sms:
    'If sending via free Internet SMS fails, the message will be sent through your carrier instead. Carrier charges may apply',
  summary_auto_convert_mms:
    'If sending MMS via free Internet SMS fails, the message will be sent through your carrier instead. Carrier charges may apply',
  summary_block_strangers:
    'When enabled, Xiaomi phone users who are not saved as contacts will be unable to send you Internet SMS',
  summary_wap_push: 'Allow receiving and alerting WAP push messages (SI/SL)',
  summary_show_preview:
    'Allow message notifications to display preview content',
  summary_delivery_report:
    'Receive a report when the recipient has received the message',
  summary_5g_auto_sms:
    'If sending a 5G text message fails, it will be sent as a standard SMS instead. Carrier charges may apply',
  summary_5g_auto_mms:
    'If sending a 5G image, video, audio, or long text message fails, it will be sent as an MMS instead. Carrier charges may apply',
  summary_5g_read_report:
    'Receive read status when the recipient has viewed the message',
};
