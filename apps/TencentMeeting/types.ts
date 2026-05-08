// ========== 参会人员 ==========

// 参会人员基础信息
export interface ParticipantInfo {
    id: string;
    name: string;
    avatar?: string;
}

// 进行中会议的参会人员（包含实时状态）
export interface ActiveParticipant extends ParticipantInfo {
    isHost: boolean;
    isMuted: boolean;
    isVideoOn: boolean;
    isHandRaised?: boolean;
    isSharing?: boolean;
    role?: 'host' | 'co-host' | 'attendee';
    allowUnmute?: boolean;
}

// ========== 会议类型定义 ==========

// 会议类型
export type MeetingType = 'quick' | 'recurring' | 'personal' | 'scheduled' | 'joined';

// 会议基础信息（共用）
export interface MeetingBase {
    id: string;
    meetingId: string; // 会议号，如 "524 733 540"
    title: string;
    startTime: number; // 开始时间戳
    duration: number; // 预计时长（分钟），快速会议默认60
    timezone: string; // 时区，默认 "(GMT+08:00) 中国标准时间"
    hostId: string; // 发起人 ID
    type: MeetingType;
}

// 单次参会记录
export interface ParticipationRecord {
    joinTime: number;  // 加入时间
    duration: number;  // 参会时长（毫秒）
}

// 历史会议记录
export interface MeetingRecord extends MeetingBase {
    endTime?: number; // 会议实际结束时间戳（主持人结束时设置，参与者离开时为 undefined 表示会议可能还在进行）
    participants: ParticipantInfo[]; // 所有曾参会的人员
    isRecurring?: boolean;
    participations?: ParticipationRecord[]; // 用户的多次参会记录
}

export interface ChatMessage {
    id: string;
    text: string;
    sender: string;
    senderId: string;
    time: number;
    to: string; // '所有人' or name
    toId?: string; // 'all' or userId
}

// 进行中的会议（当前用户正在参与）
export interface ActiveMeeting extends MeetingBase {
    participants: ActiveParticipant[]; // 当前在线的参会人员
    joinTime: number; // 本次加入会议的时间（用于计算本次参会时长）
    settings: {
        isMuted: boolean;
        isVideoOn: boolean;
        isHandRaised?: boolean;
        layout?: 'gallery' | 'speaker' | 'custom';
        pinnedUser?: string;
        captionEnabled?: boolean;
        captionLang?: string;
        isSharing?: boolean; // If local user is sharing
        isRecording?: boolean;
    };
    chatMessages?: ChatMessage[];
}

// 进行中的会议（可加入的模拟数据）
export interface OngoingMeeting {
    meetingId: string;
    title: string;
    hostName: string;
    hostId: string;
    startTime: number;
    duration: number; // 预计时长（分钟），快速会议默认60
    timezone: string; // 时区，默认北京时间
}

// ========== 预定会议 ==========

// 预定会议的设置
export interface ScheduledMeetingSettings {
    calendar: boolean; // 添加到日历
    waitingRoom: boolean; // 等候室
    password?: string; // 入会密码（空则无密码）
    enableSignUp: boolean; // 开启会议报名
    allowBeforeHost: boolean; // 允许成员在主持人前入会
    muteOnJoin: 'off' | 'on' | 'auto_after_6'; // 成员入会时静音
    watermark: boolean; // 会议水印
    allowMultiDevice: boolean; // 允许成员多端入会
    forbidAddContact: boolean; // 禁止互相添加联系人
    autoCloudRecord: boolean; // 自动云录制
    autoTranscribe: boolean; // 自动文字转写
    allowUploadDoc: boolean; // 允许成员上传文档
    virtualBackground?: string; // 统一虚拟背景
    autoUseOvertimeCard?: boolean; // 自动使用加时卡
}

// 预定会议
export interface ScheduledMeeting {
    id: string;
    meetingId: string; // 会议号
    title: string; // 会议主题
    note?: string; // 备注
    startTime: number; // 开始时间戳
    duration: number; // 时长（分钟）
    timezone: string; // 时区
    repeatType: 'none' | 'daily' | 'workday' | 'weekly' | 'biweekly' | 'monthly' | 'custom'; // 重复频率
    hostId: string; // 发起人 ID
    invitees: ParticipantInfo[]; // 受邀参会人
    settings: ScheduledMeetingSettings;
    status: 'pending' | 'ongoing' | 'ended' | 'cancelled'; // 状态
    createdAt: number; // 创建时间
}

// ========== 其他类型 ==========

export interface MeetingContact {
    id: string;
    name: string;
    avatar?: string;
}

export interface DeviceLogin {
    id: string;
    deviceType: 'pc' | 'mac' | 'ipad' | 'web' | 'phone';
    deviceName: string;  // 例如 "Mac", "Windows PC", "iPad"
    isLoggedIn: boolean;
    inMeeting: boolean;
    meetingTitle?: string; // 如果在会议中，显示会议名称
}
