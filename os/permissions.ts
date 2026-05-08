import type { AppId } from './types';

export type PermissionId =
  | 'android.permission.ACCESS_FINE_LOCATION'
  | 'android.permission.ACCESS_COARSE_LOCATION'
  | 'android.permission.CAMERA'
  | 'android.permission.READ_CONTACTS'
  | 'android.permission.WRITE_CONTACTS'
  | 'android.permission.READ_EXTERNAL_STORAGE'
  | 'android.permission.WRITE_EXTERNAL_STORAGE'
  | 'android.permission.RECORD_AUDIO'
  | 'android.permission.READ_PHONE_STATE'
  | 'android.permission.CALL_PHONE'
  | 'android.permission.SEND_SMS'
  | 'android.permission.RECEIVE_SMS'
  | 'android.permission.READ_CALL_LOG'
  | 'android.permission.POST_NOTIFICATIONS';

export type PermissionStatus = 'not_requested' | 'granted' | 'denied' | 'denied_forever';

export interface PermissionGroup {
  id: string;
  displayName: string;
  description: string;
  iconName: string;
  permissions: PermissionId[];
}

export interface PermissionRequestOptions {
  rationale?: string;
}

export interface PermissionSnapshot {
  grants: Record<AppId, Partial<Record<PermissionId, PermissionStatus>>>;
}

export const PERMISSIONS = {
  ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
  ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
  CAMERA: 'android.permission.CAMERA',
  READ_CONTACTS: 'android.permission.READ_CONTACTS',
  WRITE_CONTACTS: 'android.permission.WRITE_CONTACTS',
  READ_EXTERNAL_STORAGE: 'android.permission.READ_EXTERNAL_STORAGE',
  WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
  RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
  READ_PHONE_STATE: 'android.permission.READ_PHONE_STATE',
  CALL_PHONE: 'android.permission.CALL_PHONE',
  SEND_SMS: 'android.permission.SEND_SMS',
  RECEIVE_SMS: 'android.permission.RECEIVE_SMS',
  READ_CALL_LOG: 'android.permission.READ_CALL_LOG',
  POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
} as const satisfies Record<string, PermissionId>;

export const PERMISSION_IDS: PermissionId[] = Object.values(PERMISSIONS);

const PERMISSION_DISPLAY_NAMES: Record<PermissionId, string> = {
  [PERMISSIONS.ACCESS_FINE_LOCATION]: '精确位置',
  [PERMISSIONS.ACCESS_COARSE_LOCATION]: '粗略位置',
  [PERMISSIONS.CAMERA]: '相机',
  [PERMISSIONS.READ_CONTACTS]: '读取通讯录',
  [PERMISSIONS.WRITE_CONTACTS]: '修改通讯录',
  [PERMISSIONS.READ_EXTERNAL_STORAGE]: '读取存储空间',
  [PERMISSIONS.WRITE_EXTERNAL_STORAGE]: '写入存储空间',
  [PERMISSIONS.RECORD_AUDIO]: '麦克风',
  [PERMISSIONS.READ_PHONE_STATE]: '读取手机状态',
  [PERMISSIONS.CALL_PHONE]: '拨打电话',
  [PERMISSIONS.SEND_SMS]: '发送短信',
  [PERMISSIONS.RECEIVE_SMS]: '接收短信',
  [PERMISSIONS.READ_CALL_LOG]: '读取通话记录',
  [PERMISSIONS.POST_NOTIFICATIONS]: '通知',
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'LOCATION',
    displayName: '位置',
    description: '用于定位、导航和基于位置的服务。',
    iconName: 'ic_location_info_settings',
    permissions: [PERMISSIONS.ACCESS_FINE_LOCATION, PERMISSIONS.ACCESS_COARSE_LOCATION],
  },
  {
    id: 'CAMERA',
    displayName: '相机',
    description: '用于拍照、扫码和视频通话。',
    iconName: 'ic_camera_grip_settings',
    permissions: [PERMISSIONS.CAMERA],
  },
  {
    id: 'CONTACTS',
    displayName: '通讯录',
    description: '用于读取或编辑联系人信息。',
    iconName: 'ic_account_avatar',
    permissions: [PERMISSIONS.READ_CONTACTS, PERMISSIONS.WRITE_CONTACTS],
  },
  {
    id: 'STORAGE',
    displayName: '存储',
    description: '用于读取和写入照片、视频及其他文件。',
    iconName: 'onedrive_account',
    permissions: [PERMISSIONS.READ_EXTERNAL_STORAGE, PERMISSIONS.WRITE_EXTERNAL_STORAGE],
  },
  {
    id: 'MICROPHONE',
    displayName: '麦克风',
    description: '用于录音、语音输入和语音通话。',
    iconName: 'ic_sound_settings',
    permissions: [PERMISSIONS.RECORD_AUDIO],
  },
  {
    id: 'PHONE',
    displayName: '电话',
    description: '用于读取设备电话状态和拨号。',
    iconName: 'ic_settings_dualsim',
    permissions: [PERMISSIONS.READ_PHONE_STATE, PERMISSIONS.CALL_PHONE, PERMISSIONS.READ_CALL_LOG],
  },
  {
    id: 'SMS',
    displayName: '短信',
    description: '用于发送、接收和读取短信。',
    iconName: 'ic_notification_center',
    permissions: [PERMISSIONS.SEND_SMS, PERMISSIONS.RECEIVE_SMS],
  },
  {
    id: 'NOTIFICATIONS',
    displayName: '通知',
    description: '用于发送系统通知提醒。',
    iconName: 'ic_notification_center',
    permissions: [PERMISSIONS.POST_NOTIFICATIONS],
  },
];

const PERMISSION_TO_GROUP = new Map<PermissionId, PermissionGroup>();
for (const group of PERMISSION_GROUPS) {
  for (const permission of group.permissions) {
    PERMISSION_TO_GROUP.set(permission, group);
  }
}

export function getPermissionGroup(permissionId: PermissionId): PermissionGroup | undefined {
  return PERMISSION_TO_GROUP.get(permissionId);
}

export function getPermissionDisplayName(permissionId: PermissionId): string {
  return PERMISSION_DISPLAY_NAMES[permissionId] || permissionId;
}

export function isPermissionId(value: unknown): value is PermissionId {
  return typeof value === 'string' && (PERMISSION_IDS as string[]).includes(value);
}
