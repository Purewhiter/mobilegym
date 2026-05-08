// 微信读书 App 类型定义

export interface Book {
    id: string;
    title: string;
    author: string;
    cover?: string;
    coverColor?: string;
    category?: string;
    totalWords: number;    // 总字数
    rating?: number;
    recommendedValue?: number;
    recommendationTag?: string; // e.g. "神作"
    masterpiece?: boolean;      // 是否神作勋章 (Image 1)
    totalReviews?: number;      // 总点评人数 (Image 1)
    reviewBreakdown?: {         // 点评分布
        recommended: number;
        average: number;
        notRecommended: number;
    };
    totalReads?: number;        // 总阅读人数 (Image 1)
    isMembership?: boolean;     // 是否付费会员可读 (Image 1)
    intro?: string;             // 简介 (Image 3)
    content?: string;           // 正文内容 (Simulated)
    contentSource?: string;     // 真实文本文件名（assets/books/ 下），如 "红楼梦.txt"
}

export interface BookChapter {
    index: number;
    title: string;
    content: string;
    startOffset: number;
}

export interface ParsedBook {
    chapters: BookChapter[];
    totalChars: number;
}

export interface ShelfItem {
    bookId: string;
    isPrivate: boolean;
    addedAt: string;        // ISO 日期格式 'YYYY-MM-DDTHH:mm:ss'
}

/** 「喜欢的书」书单中的条目（编辑书单页） */
export interface LikedListBookEntry {
    bookId: string;
    recommendation?: string;
}

export interface ReadingRecord {
    id?: string;           // 唯一标识
    key?: string;          // Alternate unique key for benchmark
    recordId?: string;     // Alternate unique key for benchmark
    bookId: string;
    date: string;          // 'YYYY-MM-DD' 格式
    duration: number;      // 阅读时长（分钟）
    timestamp: string;     // ISO 日期格式 'YYYY-MM-DDTHH:mm:ss'
}

export interface BookProgress {
    bookId: string;
    charOffset: number;    // 当前阅读位置（字符偏移量）
    lastReadAt: string;    // ISO 日期格式 'YYYY-MM-DDTHH:mm:ss'
}

export interface ReadingStats {
    totalMinutes: number;
    daily: { [date: string]: number };
}

export interface Badge {
    id: string;
    name: string;
    type: string;
    value: string;
    color: string;
}

export interface UserProfile {
    id: string;
    name: string;
    avatar: string;
    gender: '男' | '女' | '';
    introduction: string;
    signature: string;
    readingTimeMinutes: number;
    coinBalance: number;
    membership: boolean;
    isWechatFriend: boolean;
    likesCount: number;
    followerCount: number;
    followingCount: number;
    badges: Badge[];
    recentBooks: string[]; // bookIds
}

export interface PrivacyProfileSettings {
    showShelf: boolean;
    showLiked: boolean;
    showLists: boolean;
    showBadge: boolean;
    showThought: boolean;
    visibility: string;
}

export interface PrivacySettings {
    requireFollowRequest: boolean;
    hideVipGlobal: boolean;
    autoPrivateReading: boolean;
    shelfReplacement: boolean;
    rejectStrangerMsg: boolean;
    closePersonalizedRec: boolean;
    closeReadingRank: boolean;
    profile: PrivacyProfileSettings;
}

export interface NotificationSettings {
    newFollower: boolean;
    newWechatFriend: boolean;
    activityWelfare: boolean;
}

export type ReaderThemeColor = 'white' | 'yellow' | 'green' | 'dark';

export type ReaderThemeBackground = 'matchTheme' | 'bg1' | 'bg2' | 'bg3' | 'bg4';

export type ReaderTypographyIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ReaderPrefs {
    fontSize: number;
    themeColor: ReaderThemeColor;
    themeBg: ReaderThemeBackground;
    margin: ReaderTypographyIndex;
    lineHeight: ReaderTypographyIndex;
}

export interface Settings {
    autoLock: boolean;
    allowLandscape: boolean;
    hideThought: boolean;
    showTimeBattery: boolean;
    volumeKeyTurn: boolean;
    firstLineIndent: boolean;
    clickLeftNext: boolean;
    blockWebNovels: boolean;
    mixAudio: boolean;
    pageTurnStyle: string;
    darkMode: string;
    privacy: PrivacySettings;
    notifications: NotificationSettings;
}

export interface Audiobook {
    id: string;
    title: string;
    author: string;
    coverColor: string;
    plays: string;
    rating?: string;
}
