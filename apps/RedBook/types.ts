export interface User {
  id: string;
  name: string;
  avatar: string;
  userCover?: string; // Cover image for profile
  following?: number | string;
  followers?: number | string;
  likesAndCollections?: number | string;
  intro?: string;
  location?: string;
  gender?: string;
  age?: string;
  birthday?: string;
  address?: string;
  userUrl?: string; // Original XHS User URL

  /**
   * ========= 当前用户专属的“真值”字段（解耦用户态/互动态） =========
   * - likedNotes/collectedNotes/followings 等才是“我做了什么”的源数据
   * - feed/users 里的 isLiked/isCollected/isFollowed 由这些字段派生，保证兼容现有 UI/评测
   */
  likedNotes?: string[]; // noteIds
  collectedNotes?: string[]; // noteIds
  followings?: string[]; // userIds (I follow)
  followerIds?: string[]; // userIds (follow me) - optional demo data
  /**
   * 我点过赞的评论（按 noteId 分桶，避免 commentId 不全局唯一的问题）
   */
  likedCommentsByNote?: Record<string, string[]>; // { [noteId]: commentIds[] }
  /**
   * 我发出的评论索引（用于“用户维度的评论列表”，不替代 note.commentList）
   */
  commentList?: Array<{
    noteId: string;
    commentId: string;
    content: string;
    time: number;
    replyToId?: string;
  }>;

  /**
   * 我发布过的笔记列表（noteIds）。
   * - 用于“我的主页/作品”快速索引与稳定排序
   * - 真值由 user 维护，不依赖扫描全量 notesById
   */
  publishedNoteIds?: string[];
}

export interface Comment {
    id: string;
    userId: string;
    username: string;
    avatar: string;
    content: string;
    time: number;
    likes: number | string;
    replyToId?: string; // ID of the comment being replied to
    location?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  authorId: string;
  images: string[];
  video?: string;
  cover?: string;
  type?: 'video' | 'image';
  likes: number | string;
  collections: number | string;
  comments: number | string;
  commentList?: Comment[];
  createdAt: number;
  category?: string; // To support category filtering
  url?: string; // Original XHS URL
  tags?: string[];
  videoUrl?: string;
}

export interface RedBookEntities {
  usersById: Record<string, User>;
  notesById: Record<string, Note>;
}

export interface RedBookState {
  user: User; // 当前登录用户（包含互动/关系真值字段）
  entities: RedBookEntities;
  feedIds: string[]; // 首页流（noteIds）
  userIds: string[]; // 平台用户列表（userIds）
  history: string[]; // 浏览记录（noteIds）
}