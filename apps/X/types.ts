export interface XUser {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  screenName?: string;
  restId?: string;
  banner?: string;
  verified: boolean;
  bio?: string;
  location?: string;
  website?: string;
  birthDate?: string;
  joinDate?: string;
  following: number;
  followers: number;
}

export interface XPost {
  id: string;
  authorId: string;
  content: string;
  createdAt?: string;
  time: string;
  image?: string;
  video?: string;
  tweetUrl?: string;
  quotedPostId?: string;
  retweetedPostId?: string;
  retweetedPost?: XPost;
  stats: {
    comments: number;
    retweets: number;
    likes: number;
    views: number;
  };
  threadId?: string; // For reply chains
  replies?: XPost[];  // Nested reply objects (hydrated from replies.json)
}

export interface XNotification {
  id: string;
  type: 'like' | 'retweet' | 'reply' | 'follow' | 'mention';
  actorId: string;
  time: string;
  read: boolean;
  postId?: string;
  content?: string;
}

export interface XMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  time: string;
  read: boolean;
}

export interface XConversation {
  id: string;
  participantId: string;
  lastMessageId: string;
  unreadCount: number;
  messages: XMessage[];
  isGroup?: boolean;
}

export interface XTrend {
  id: string;
  category?: string;
  title: string;
  subtitle?: string;
  postsCount?: string;
  image?: string;
  type?: 'promoted' | 'standard' | 'news' | 'sports_match';
  meta?: any;
}

export interface XSearchHistory {
  id: string;
  type: 'user' | 'keyword';
  userId?: string;
  keyword?: string;
}

export interface XSettings {
  showInteractionCounts: boolean;
  enablePostSwipeGesture: boolean;
  showLocalContent: boolean;
  yourTrends: boolean;
  markSensitive: boolean;
  showListening: boolean;
  allowEmail: boolean;
  allowPhone: boolean;
  syncContacts: boolean;
  pushOnlyDm: boolean;
  dmRequestFrom: 'none' | 'verified' | 'everyone';
  enableAvCalls: boolean;
  allowCallFromFollowing: boolean;
  allowCallFromLogs: boolean;
  allowCallFromVerified: boolean;
  alwaysProxyCalls: boolean;
  filterLowQualityDMs: boolean;
  enableDebugLog: boolean;
  privatePosts: boolean;
  protectVideos: boolean;
  photoTagging: boolean;
  useRegion: boolean;
  prefRecommend: boolean;
  prefFollow: boolean;
  prefLiveSpace: boolean;
  prefNewsSports: boolean;
  fromXFollow: boolean;
  fromXNewsSports: boolean;
  fromXRecommend: boolean;
  fromXMoments: boolean;
  fromXLiveSpace: boolean;
  fromXOtherLive: boolean;
  fromXAlert: boolean;
  fromXNewFeatures: boolean;
  proNotify: boolean;
  onlyImportant: boolean;
  hideSuggestions: boolean;
}
