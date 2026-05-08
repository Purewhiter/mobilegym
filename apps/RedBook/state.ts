import { createAppStoreWithActions, memoSelector } from '../../os/createAppStore';
import { REDBOOK_CONFIG } from './data';
import * as TimeService from '../../os/TimeService';

import type { Note, User, Comment } from './types';

// ── Types ──────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image';
}

export interface ChatConversation {
  userId: string;
  username: string;
  avatar: string;
  lastMessage?: string;
  lastTime?: number;
  unreadCount: number;
  messages: ChatMessage[];
}

export interface Notification {
  id: string;
  type: 'like_note' | 'collect_note' | 'like_comment' | 'follow' | 'comment' | 'reply';
  userId: string;
  username: string;
  userAvatar: string;
  noteId?: string;
  noteCover?: string;
  content?: string;
  replyToContent?: string;
  timestamp: number;
  isRead: boolean;
}

export interface RedBookSettings {
  general: {
    useSystemFont: boolean;
    playAudio: boolean;
    autoRefresh: boolean;
    muteVideo: boolean;
    mobileDownload: boolean;
    videoHDR: boolean;
    imageHDR: boolean;
    mobileNetwork: boolean;
    history: boolean;
    videoInteraction: boolean;
    preUpload: boolean;
    teenMode: boolean;
  };
  notification: {
    receiveMsg: boolean;
    likeCollect: boolean;
    newFollow: boolean;
    comment: boolean;
    atMe: boolean;
    storeNotif: boolean;
    privateChat: boolean;
    groupChat: boolean;
    strangers: boolean;
    authorUpdates: string;
    liveReminder: string;
    contentRecommend: string;
    userRecommend: string;
    otherNotif: string;
    inAppBanner: string;
  };
  privacy: {
    oneClickProtect: boolean;
    showChatStatus: boolean;
    onlyFollowComment: boolean;
    onlyFollowDanmaku: boolean;
    onlyFollowAt: boolean;
    allowDownload: boolean;
    recommendPeople: boolean;
    onlineStatus: string;
    messagePermission: string;
    collectVisibility: string;
    commentVisibility: string;
  };
  language: string | null;
}

interface RedBookEntities {
  usersById: Record<string, User>;
  notesById: Record<string, Note>;
}

// ── Helpers ─────────────────────────────────────────────────────────

const parseCount = (count: number | string | undefined | null): number => {
  if (count === null || count === undefined) return 0;
  if (typeof count === 'number') return Number.isFinite(count) ? count : 0;
  const raw = String(count).replace(/\+/g, '').trim();
  if (!raw) return 0;
  if (raw.includes('万')) return (parseFloat(raw.replace('万', '')) || 0) * 10000;
  if (raw.toLowerCase().includes('w')) return (parseFloat(raw.toLowerCase().replace('w', '')) || 0) * 10000;
  return parseFloat(raw) || 0;
};

// ── State interface ─────────────────────────────────────────────────

export interface RedBookStoreState {
  user: User;
  entities: RedBookEntities;
  feedIds: string[];
  userIds: string[];
  chats: ChatConversation[];
  notifications: Notification[];
  history: string[];
  settings: RedBookSettings;
  storage: {
    cacheSizeBytes: number;
  };
  homeState: {
    activeCategory: string;
    citySubTab: string;
    displayCount: number;
  };
  publishDraft: {
    text: string;
    templateId: string;
    // Title entered in the publish confirmation page.
    // Used for task validation to ensure the agent actually typed the expected title.
    title: string;
    // 已烘焙/已选择的发布图片（文字卡在离开 template 页时光栅化；未来照片流也会落到这里）。
    images: string[];
  };
}

// ── Actions interface ───────────────────────────────────────────────

export interface RedBookActions {
  updateHomeState: (updates: Partial<RedBookStoreState['homeState']>) => void;
  updatePublishDraft: (updates: Partial<RedBookStoreState['publishDraft']>) => void;
  resetPublishDraft: () => void;
  toggleLike: (noteId: string) => void;
  toggleCollect: (noteId: string) => void;
  addComment: (noteId: string, content: string, replyToCommentId?: string) => void;
  toggleCommentLike: (noteId: string, commentId: string) => void;
  followUser: (userId: string) => void;
  addNote: (note: Pick<Note, 'title' | 'content' | 'images'>) => void;
  sendMessage: (toUserId: string, content: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  markNotificationsAsRead: (type?: Notification['type']) => void;
  addToHistory: (noteId: string) => void;
  clearHistory: () => void;
  clearCache: () => void;
  updateSettings: (category: keyof RedBookSettings, updates: Partial<RedBookSettings[keyof RedBookSettings]> | string | null) => void;
  // Internal: populate entities from loadEntities()
  _setEntities: (data: { notesById: Record<string, Note>; usersById: Record<string, User>; feedIds: string[]; userIds: string[] }) => void;
}

// ── Initial state ───────────────────────────────────────────────────

const now = TimeService.now();

const mockNotifications: Notification[] = [
  {
    id: 'n1',
    type: 'like_note',
    userId: REDBOOK_CONFIG.users[0]?.id ?? '',
    username: REDBOOK_CONFIG.users[0]?.name ?? '',
    userAvatar: REDBOOK_CONFIG.users[0]?.avatar ?? '',
    noteId: 'note_0',
    noteCover: REDBOOK_CONFIG.sampleNotes[0]?.images?.[0] ?? '',
    timestamp: now - 300000,
    isRead: false,
  },
  {
    id: 'n2',
    type: 'comment',
    userId: REDBOOK_CONFIG.users[1]?.id ?? '',
    username: REDBOOK_CONFIG.users[1]?.name ?? '',
    userAvatar: REDBOOK_CONFIG.users[1]?.avatar ?? '',
    noteId: 'note_0',
    noteCover: REDBOOK_CONFIG.sampleNotes[0]?.images?.[0] ?? '',
    content: '这套搭配很好看！爱了爱了❤️',
    timestamp: now - 600000,
    isRead: false,
  },
  {
    id: 'n3',
    type: 'follow',
    userId: REDBOOK_CONFIG.users[2]?.id ?? '',
    username: REDBOOK_CONFIG.users[2]?.name ?? '',
    userAvatar: REDBOOK_CONFIG.users[2]?.avatar ?? '',
    timestamp: now - 900000,
    isRead: false,
  },
  {
    id: 'n4',
    type: 'collect_note',
    userId: REDBOOK_CONFIG.users[3]?.id ?? '',
    username: REDBOOK_CONFIG.users[3]?.name ?? '',
    userAvatar: REDBOOK_CONFIG.users[3]?.avatar ?? '',
    noteId: 'note_0',
    noteCover: REDBOOK_CONFIG.sampleNotes[0]?.images?.[0] ?? '',
    timestamp: now - 1200000,
    isRead: false,
  },
  {
    id: 'n5',
    type: 'like_comment',
    userId: REDBOOK_CONFIG.users[0]?.id ?? '',
    username: REDBOOK_CONFIG.users[0]?.name ?? '',
    userAvatar: REDBOOK_CONFIG.users[0]?.avatar ?? '',
    noteId: 'note_0',
    noteCover: REDBOOK_CONFIG.sampleNotes[0]?.images?.[0] ?? '',
    content: '太赞了！',
    timestamp: now - 1500000,
    isRead: false,
  },
  {
    id: 'n6',
    type: 'reply',
    userId: REDBOOK_CONFIG.users[1]?.id ?? '',
    username: REDBOOK_CONFIG.users[1]?.name ?? '',
    userAvatar: REDBOOK_CONFIG.users[1]?.avatar ?? '',
    noteId: 'note_0',
    noteCover: REDBOOK_CONFIG.sampleNotes[0]?.images?.[0] ?? '',
    content: '谢谢分享！',
    replyToContent: '这套搭配很好看！爱了爱了❤️',
    timestamp: now - 1800000,
    isRead: false,
  },
];

const initialState: RedBookStoreState = {
  user: { ...REDBOOK_CONFIG.user },
  entities: { usersById: {} as Record<string, User>, notesById: {} as Record<string, Note> },
  feedIds: [] as string[],
  userIds: [] as string[],
  chats: [] as ChatConversation[],
  notifications: mockNotifications,
  history: [] as string[],
  settings: { ...REDBOOK_CONFIG.settings } as RedBookSettings,
  storage: {
    cacheSizeBytes: 5382144, // ~5.13 MB
  },
  homeState: {
    activeCategory: 'recommend',
    citySubTab: 'recommend',
    displayCount: 20,
  },
  publishDraft: {
    text: '',
    templateId: 'basic',
    title: '',
    images: [],
  },
};

// ── Store ──────────────────────────────────────────────────────────

export const useRedBookStore = createAppStoreWithActions<RedBookStoreState, RedBookActions>(
  'redbook',
  initialState,
  (set, get) => ({

    // ── Home state ─────────────────────────────────────────────
    updateHomeState: (updates) => {
      set({ homeState: { ...get().homeState, ...updates } });
    },

    // ── Publish draft ──────────────────────────────────────────
    updatePublishDraft: (updates) => {
      set({ publishDraft: { ...get().publishDraft, ...updates } });
    },
    resetPublishDraft: () => {
      set({ publishDraft: { text: '', templateId: 'basic', title: '', images: [] } });
    },

    // ── Like / Collect ─────────────────────────────────────────
    toggleLike: (noteId) => {
      const s = get();
      const likedNotes = s.user.likedNotes || [];
      const wasLiked = likedNotes.includes(noteId);
      const nextLikedNotes = wasLiked ? likedNotes.filter(id => id !== noteId) : [...likedNotes, noteId];
      const targetNote = s.entities.notesById[noteId];
      set({
        user: { ...s.user, likedNotes: nextLikedNotes },
        entities: {
          ...s.entities,
          notesById: {
            ...s.entities.notesById,
            [noteId]: targetNote
              ? { ...targetNote, likes: Math.max(0, parseCount(targetNote.likes) + (wasLiked ? -1 : 1)) }
              : targetNote,
          },
        },
      });
    },

    toggleCollect: (noteId) => {
      const s = get();
      const collectedNotes = s.user.collectedNotes || [];
      const wasCollected = collectedNotes.includes(noteId);
      const nextCollectedNotes = wasCollected ? collectedNotes.filter(id => id !== noteId) : [...collectedNotes, noteId];
      const targetNote = s.entities.notesById[noteId];
      set({
        user: { ...s.user, collectedNotes: nextCollectedNotes },
        entities: {
          ...s.entities,
          notesById: {
            ...s.entities.notesById,
            [noteId]: targetNote
              ? { ...targetNote, collections: Math.max(0, parseCount(targetNote.collections) + (wasCollected ? -1 : 1)) }
              : targetNote,
          },
        },
      });
    },

    // ── Comments ───────────────────────────────────────────────
    addComment: (noteId, content, replyToCommentId) => {
      const s = get();
      const nowTs = TimeService.now();
      const newComment: Comment = {
        id: `c_${nowTs}`,
        userId: s.user.id,
        username: s.user.name,
        avatar: s.user.avatar,
        content,
        time: nowTs,
        likes: 0,
        replyToId: replyToCommentId,
        location: s.user.location || '上海',
      };
      const nextUserCommentList = [
        ...(s.user.commentList || []),
        { noteId, commentId: newComment.id, content, time: nowTs, replyToId: replyToCommentId },
      ];
      const targetNote = s.entities.notesById[noteId];
      const nextNote = targetNote
        ? {
          ...targetNote,
          comments: parseCount(targetNote.comments) + 1,
          commentList: [newComment, ...(targetNote.commentList || [])],
        }
        : targetNote;
      set({
        user: { ...s.user, commentList: nextUserCommentList },
        entities: {
          ...s.entities,
          notesById: {
            ...s.entities.notesById,
            [noteId]: nextNote,
          },
        },
      });
    },

    toggleCommentLike: (noteId, commentId) => {
      const s = get();
      const likedByNote = s.user.likedCommentsByNote || {};
      const current = likedByNote[noteId] || [];
      const wasLiked = current.includes(commentId);
      const nextForNote = wasLiked ? current.filter(id => id !== commentId) : [...current, commentId];
      const nextLikedByNote = { ...likedByNote, [noteId]: nextForNote };
      const targetNote = s.entities.notesById[noteId];
      const nextNote = targetNote
        ? {
          ...targetNote,
          commentList: (targetNote.commentList || []).map(c => {
            if (c.id !== commentId) return c;
            const nextLikes = Math.max(0, parseCount(c.likes) + (wasLiked ? -1 : 1));
            return { ...c, likes: nextLikes };
          }),
        }
        : targetNote;
      set({
        user: { ...s.user, likedCommentsByNote: nextLikedByNote },
        entities: {
          ...s.entities,
          notesById: {
            ...s.entities.notesById,
            [noteId]: nextNote,
          },
        },
      });
    },

    // ── Follow ─────────────────────────────────────────────────
    followUser: (userId) => {
      const s = get();
      const targetUser = s.entities.usersById[userId];
      if (!targetUser) return;
      const followings = s.user.followings || [];
      const isFollowing = followings.includes(userId);
      const nextFollowings = isFollowing ? followings.filter(id => id !== userId) : [...followings, userId];
      set({
        user: {
          ...s.user,
          followings: nextFollowings,
          following: Math.max(0, parseCount(s.user.following) + (isFollowing ? -1 : 1)),
        },
        entities: {
          ...s.entities,
          usersById: {
            ...s.entities.usersById,
            [userId]: {
              ...targetUser,
              followers: Math.max(0, parseCount(targetUser.followers) + (isFollowing ? -1 : 1)),
            },
          },
        },
      });
    },

    // ── Add note ───────────────────────────────────────────────
    addNote: (noteData) => {
      const s = get();
      const nowTs = TimeService.now();
      const newNote: Note = {
        id: `note_${nowTs}`,
        ...noteData,
        authorId: s.user.id,
        likes: 0,
        collections: 0,
        comments: 0,
        commentList: [],
        createdAt: nowTs,
      };
      set({
        user: {
          ...s.user,
          publishedNoteIds: [newNote.id, ...(s.user.publishedNoteIds || [])],
        },
        entities: {
          ...s.entities,
          notesById: { ...s.entities.notesById, [newNote.id]: newNote },
        },
        feedIds: [newNote.id, ...s.feedIds],
      });
    },

    // ── Chat ───────────────────────────────────────────────────
    sendMessage: (toUserId, content) => {
      const s = get();
      const chats = [...s.chats];
      const chatIndex = chats.findIndex(c => c.userId === toUserId);
      const nowTs = TimeService.now();
      const newMessage: ChatMessage = {
        id: `msg_${nowTs}`,
        senderId: s.user.id,
        content,
        timestamp: nowTs,
        type: 'text',
      };
      if (chatIndex === -1) {
        const targetUser = (toUserId === s.user.id ? s.user : s.entities.usersById[toUserId]) || { name: 'User ' + toUserId, avatar: '' };
        chats.unshift({
          userId: toUserId,
          username: targetUser.name,
          avatar: targetUser.avatar,
          unreadCount: 0,
          lastMessage: content,
          lastTime: nowTs,
          messages: [newMessage],
        });
      } else {
        const chat = { ...chats[chatIndex] };
        chat.messages = [...chat.messages, newMessage];
        chat.lastMessage = content;
        chat.lastTime = nowTs;
        chats.splice(chatIndex, 1);
        chats.unshift(chat);
      }
      set({ chats });
    },

    // ── Auth ───────────────────────────────────────────────────
    logout: () => {
      console.log('Logging out...');
    },

    // ── User ───────────────────────────────────────────────────
    updateUser: (updates) => {
      set({ user: { ...get().user, ...updates } });
    },

    // ── Notifications ──────────────────────────────────────────
    markNotificationsAsRead: (type?) => {
      const s = get();
      set({
        notifications: s.notifications.map(n => {
          if (!type || n.type === type || (type === 'like_note' && (n.type === 'collect_note' || n.type === 'like_comment'))) {
            return { ...n, isRead: true };
          }
          return n;
        }),
      });
    },

    // ── History ────────────────────────────────────────────────
    addToHistory: (noteId) => {
      const s = get();
      set({ history: [noteId, ...s.history.filter(id => id !== noteId)] });
    },
    clearHistory: () => {
      set({ history: [] });
    },
    clearCache: () => {
      set({ storage: { cacheSizeBytes: 0 } });
    },

    // ── Settings ───────────────────────────────────────────────
    updateSettings: (category, updates) => {
      const s = get();
      if (category === 'language' && (typeof updates === 'string' || updates === null)) {
        set({ settings: { ...s.settings, language: updates } });
        return;
      }
      if (typeof updates === 'object' && !Array.isArray(updates) && category !== 'language') {
        set({
          settings: {
            ...s.settings,
            [category]: {
              ...(s.settings[category] as object),
              ...updates,
            },
          },
        });
      }
    },

    // ── Internal: populate entities from async loader ──────────
    _setEntities: ({ notesById, usersById, feedIds, userIds }) => {
      const s = get();
      let user = s.user;
      if (!user.publishedNoteIds) {
        user = {
          ...user,
          publishedNoteIds: Object.values(notesById)
            .filter(n => n?.authorId === user.id)
            .sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0))
            .map(n => n.id),
        };
      }
      set({
        user,
        entities: { notesById, usersById },
        feedIds,
        userIds,
      });
    },
  }),
  {
    partialize: (state) => {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(state)) {
        if (typeof v === 'function') continue;
        // Exclude large entities from persistence (loaded async from JSON)
        if (k === 'entities' || k === 'feedIds' || k === 'userIds') continue;
        result[k] = v;
      }
      return result as Partial<RedBookStoreState>;
    },
  },
);

// ── Memoized selectors ─────────────────────────────────────────────

/** Select a specific note by id — returns stable ref when notesById ref unchanged */
export const selectNoteById = (noteId: string) =>
  (state: RedBookStoreState & RedBookActions) => state.entities.notesById[noteId];

/** Resolve user by id from current user + entities map */
export const resolveRedBookUserById = (state: RedBookStoreState, userId: string): User | undefined => {
  if (!userId) return undefined;
  if (userId === state.user.id) return state.user;
  return state.entities.usersById[userId];
};
