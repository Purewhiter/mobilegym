export interface RedditPost {
  id: string;
  subreddit: string;
  subredditIcon?: string;
  author: string;
  timeAgo: string;
  title: string;
  image?: string;
  images?: string[];
  upvotes: string;
  comments: string;
  isAd?: boolean;
  content?: string;
  shares?: number;
  url?: string;
  authorAvatar?: string;
  commentsData?: Array<Omit<Comment, 'postId'>>;
}

export interface Comment {
  id: string;
  postId: string;
  author: string;
  body: string;
  score?: number;
  created_utc?: number;
  parentId?: string;
}

export interface RedditSettings {
  showNSFW: boolean;
  blurNSFW: boolean;
  showCommunityStyles: boolean;
  theme: 'light' | 'dark' | 'auto';
  autoplayVideo: 'always' | 'wifi' | 'never';
  quietAudio: boolean;
  inboxNotifications: boolean;
  commentReplyNotifications: boolean;
  upvoteNotifications: boolean;
  mentionNotifications: boolean;
  chatMessageNotifications: boolean;
  communityAlerts: boolean;
  trendingNotifications: boolean;
  homeFeedRecommendations: boolean;
  allowCookies: boolean;
  personalizedAds: boolean;
  showOnlineStatus: boolean;
  defaultCommentSort: 'best' | 'top' | 'new' | 'controversial' | 'old' | 'qa';
  rememberPerPostSort: boolean;
  textSize: 'small' | 'default' | 'large' | 'extra-large';
  reduceAnimations: boolean;
  openLinksInApp: boolean;
  savedImageAttribution: boolean;
  defaultMarkdown: boolean;
}

export type RedditPostsOverlay = Record<string, RedditPost | null>;
export type RedditCommentsOverlay = Record<string, Comment | null>;

export interface RedditCommunity {
  id: string;
  name: string;
  icon?: string;
  members: string;
  isSpotlight?: boolean;
  spotlightImage?: string;
  spotlightTitle?: string;
}
