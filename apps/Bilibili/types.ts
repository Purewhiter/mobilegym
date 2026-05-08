// Type definitions for Bilibili app data

export interface BilibiliVideo {
  id: string;
  title?: string;
  cover?: string;
  author?: string;
  face?: string;
  plays?: number;
  danmaku?: number;
  duration?: string;
  date?: number;
  isAd?: boolean;
  desc?: string;
  partition?: string;
  raw?: any;
  stats?: {
    likes?: number;
    coins?: number;
    favorites?: number;
    shares?: number;
    favs?: number;
  };
}

export interface RankingVideo {
  id: string;
  title?: string;
  cover?: string;
  author?: string;
  face?: string;
  plays?: number;
  danmaku?: number;
  duration?: number | string;
  desc?: string;
  score?: number;
  rank: number;
  partition: string;
  raw?: any;
}

export interface University {
  id: string;
  name: string;
  city: string;
}

export interface BilibiliRelationUser {
  mid: string;
  name: string;
  face: string;
  sign?: string;
  level?: number;
  isVip?: boolean;
  officialVerify?: {
    type: number; // 0: none, 1: person, 2: org
    desc: string;
  };
}

export interface BilibiliUser {
  name: string;
  level: number;
  avatar: string;
  bCoins: number;
  coins: number;
  /** 大会员到期时间戳（ms），未开通过期则为 undefined */
  vipExpireAt?: number;
  followingList?: BilibiliRelationUser[];
  followersList?: BilibiliRelationUser[];
  following: number; // Deprecated: use followingList.length
  followers: number; // Deprecated: use followersList.length
  dynamic: number;
  isVip: boolean;
  sex?: '男' | '女' | '保密';
  birthday?: string;
  sign?: string;
  school?: string;
  enrollmentYear?: string;
  ipLocation?: string;
  uid?: string;
  likedVideoIds?: string[];
  dislikedVideoIds?: string[];
  coinedVideoCoins?: Record<string, number>;
  favoritesFolders?: {
    id: string;
    title: string;
    description?: string;
    count?: number;
    cover?: string;
    isPublic?: boolean;
    videoIds?: string[];
  }[];
  subscribedAnime?: { id: string; title?: string; cover?: string; updateInfo?: string }[];
  subscribedDramas?: { id: string; title?: string; cover?: string; updateInfo?: string }[];
  searchHistory?: string[];
}

/** 设置页配置：嵌套结构，与 defaults.json settings 一致 */
export interface BilibiliSettings {
  language: string | null;
  timer: string;
  sleepReminder: boolean;
  recommend: {
    playMode: string;
    autoPlay: string;
    bigCardSound: string;
    refresh: string;
  };
  avatarEntry: { watchVideo: boolean; listenVideo: boolean };
  offline: { autoDownload: boolean };
  chase: { xianXiuMode: boolean };
  push: Record<string, boolean>;
  message: {
    notify: boolean;
    smartBlock: boolean;
    replyAt: string;
    like: string;
    fan: string;
    support: string;
    supportCollapse: boolean;
    unfollowCollapse: boolean;
  };
  harass: { oneKey: boolean; comment: string; danmaku: string; pm: string };
  other: {
    wifiPkg: boolean;
    clipboard: boolean;
    screenshotShare: boolean;
    watermark: string;
    imageQuality: string;
  };
  playback: {
    dataAuto: boolean;
    detailAuto: boolean;
    detailFullscreen: boolean;
    feedAuto: string;
    homeAuto: string;
    portraitFullscreen: boolean;
    pipOut: boolean;
    pipIn: boolean;
    backgroundListen: boolean;
    backgroundSeries: boolean;
    danmakuMemory: boolean;
    danmakuQuick: boolean;
    subtitleFeedback: boolean;
    subtitleDrag: boolean;
    hdr: boolean;
    fullscreenCount: boolean;
    gravity: boolean;
    volumeBalance: string;
    eyeCare: boolean;
    colorAid: boolean;
    https: boolean;
  };
}

export interface UserInfo {
  mid: number;
  name: string;
  face: string;
  sign: string;
  level: number;
  vip: {
    status: number;
    label: string;
  };
  official: {
    role: number;
    title: string;
    type: number;
  };
  top_photo: string;
  live_room: any;
  follower: number;
  following: number;
  likes: number;
  videos: BilibiliVideo[];
  location?: string;
}

export interface CommentReply {
  rpid: string;
  mid: string;
  uname: string;
  avatar: string;
  sex?: string;
  level?: number;
  vip?: boolean;
  message: string;
  like: number;
  ctime: number;
  rcount?: number;
  location: string;
  time_desc?: string;
  replies: CommentReply[] | null;
}

export interface VideoComments {
  bvid: string;
  aid: number;
  title: string;
  comments: CommentReply[];
  count: number;
  error?: string;
}

export interface CommentsData {
  generated_at: string;
  total_videos: number;
  data: Record<string, VideoComments>;
}
