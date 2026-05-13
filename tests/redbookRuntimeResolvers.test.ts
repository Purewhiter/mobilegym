import { describe, expect, it } from 'vitest';
import { resolveRedBookRuntimeUser } from '../apps/RedBook/utils/runtimeResolvers';
import { buildRedBookView } from '../apps/RedBook/data/view';
import type { Note, User } from '../apps/RedBook/types';
import type { RedBookBaseDataset } from '../apps/RedBook/data/loader';

const currentUser: User = {
  id: 'me',
  name: 'Me',
  avatar: '',
  followingIds: [],
  followerIds: [],
};

const baseUser: User = {
  id: 'author_1',
  name: 'Base Author',
  avatar: 'base-avatar.png',
  followers: 10,
  following: 1,
};

const baseNote: Note = {
  id: 'note_1',
  title: 'Base Title',
  content: 'Base Content',
  authorId: 'author_1',
  images: [],
  likes: 3,
  collections: 2,
  comments: 1,
  commentList: [
    {
      id: 'comment_1',
      userId: 'author_1',
      username: 'Base Author',
      avatar: 'base-avatar.png',
      content: 'Base Comment',
      time: 1,
      likes: 0,
    },
  ],
  createdAt: 1,
};

const buildBase = (): RedBookBaseDataset => ({
  notesById: { note_1: baseNote },
  usersById: { author_1: baseUser },
  feedIds: ['note_1'],
  userIds: ['author_1'],
  baseCommentToNote: { comment_1: 'note_1' },
});

describe('RedBook view layer overlay semantics', () => {
  it('uses runtime note overlay as a replacement instead of backfilling from base', () => {
    const view = buildRedBookView(
      {
        notes: { note_1: { id: 'note_1', title: 'Overlay Title' } as any },
        comments: {},
        users: {},
        user: currentUser,
      },
      buildBase(),
    );

    const note = view.notesById.note_1 as any;
    expect(note.title).toBe('Overlay Title');
    expect(note.authorId).toBeUndefined();
  });

  it('uses runtime base-comment overlay as a replacement instead of backfilling from base', () => {
    const view = buildRedBookView(
      {
        notes: {},
        comments: {
          comment_1: { id: 'comment_1', noteId: 'note_1', content: 'Overlay Comment' } as any,
        },
        users: {},
        user: currentUser,
      },
      buildBase(),
    );

    const note = view.notesById.note_1 as any;
    const comment = note.commentList.find((item: any) => item.id === 'comment_1');
    expect(comment.content).toBe('Overlay Comment');
    expect(comment.username).toBeUndefined();
  });
});

describe('RedBook runtime user resolver', () => {
  it('uses runtime user overlay as a replacement instead of backfilling from base', () => {
    const user = resolveRedBookRuntimeUser(
      { author_1: { id: 'author_1', name: 'Overlay Author' } as any },
      { author_1: baseUser },
      currentUser,
      'author_1',
    ) as any;

    expect(user.name).toBe('Overlay Author');
    expect(user.avatar).toBeUndefined();
  });
});
