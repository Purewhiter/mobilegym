import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { createRedBookModule, type RedBookDeviceState } from '../apps/RedBook/device';
import type { Note, User } from '../apps/RedBook/types';
import { DeviceServer, type Session } from '../device/engine';

const me: User = { id: 'me', name: 'Me', avatar: '', followingIds: [], followerIds: [] };

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
  category: '美食',
  commentList: [
    { id: 'comment_1', userId: 'author_1', username: 'Base Author', avatar: 'base-avatar.png', content: 'Base Comment', time: 1, likes: 0 },
  ],
  createdAt: 1,
};

const secondNote: Note = { ...baseNote, id: 'note_2', title: 'Second', likes: 9, commentList: [], comments: 0, category: '旅行' };

function writeCatalog(): string {
  const root = mkdtempSync(join(tmpdir(), 'redbook-device-'));
  const dataDir = join(root, 'apps', 'RedBook', 'data');
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, 'users.json'), JSON.stringify([baseUser]));
  writeFileSync(join(dataDir, 'notes.json'), JSON.stringify([baseNote, secondNote]));
  return root;
}

const root = writeCatalog();

function initialState(patch: Partial<RedBookDeviceState> = {}): RedBookDeviceState {
  return {
    user: { ...me },
    notes: {},
    comments: {},
    users: {},
    chats: [],
    notifications: [],
    history: [],
    searchHistory: [],
    hotSearch: [],
    guessYouLike: [],
    settings: {} as RedBookDeviceState['settings'],
    storage: { cacheSizeBytes: 1 },
    publishDraft: { text: '', templateId: 'basic', title: '', images: [] },
    ...patch,
  };
}

describe('RedBook device module', () => {
  let server: DeviceServer;
  let session: Session;
  const note = (id: string) => server.getRecord(session, 'redbook', 'notes', id) as unknown as Note | undefined;
  const user = (id: string) => server.getRecord(session, 'redbook', 'users', id) as unknown as User | undefined;
  const run = (name: string, ...args: unknown[]) => server.runCommand(session, 'redbook', name, args, { now: 1000 });

  beforeEach(() => {
    server = new DeviceServer(root);
    server.register(createRedBookModule({ cdnBase: '/cdn' }));
    session = server.createSession();
    server.importState(session, 'redbook', initialState());
  });

  it('uses a runtime note overlay as a replacement instead of backfilling from the catalog', () => {
    server.importState(session, 'redbook', initialState({
      notes: { note_1: { id: 'note_1', title: 'Overlay Title' } as Note },
    }));
    expect(note('note_1')!.title).toBe('Overlay Title');
    expect(note('note_1')!.authorId).toBeUndefined();
  });

  it('uses a runtime base-comment overlay as a replacement instead of backfilling', () => {
    server.importState(session, 'redbook', initialState({
      comments: { comment_1: { id: 'comment_1', noteId: 'note_1', content: 'Overlay Comment' } as any },
    }));
    const comment = note('note_1')!.commentList!.find(c => c.id === 'comment_1') as any;
    expect(comment.content).toBe('Overlay Comment');
    expect(comment.username).toBeUndefined();
  });

  it('writes like, collect and comment effects into the note record', () => {
    run('toggleLike', 'note_1');
    run('toggleCollect', 'note_1');
    const { state } = run('addComment', 'note_1', 'hi');
    const merged = note('note_1')!;
    expect([merged.likes, merged.collections, merged.comments]).toEqual([4, 3, 2]);
    expect(merged.commentList![0].content).toBe('hi');
    // The exported state keeps the existing shape: truth fields, no derived counts.
    const exported = state as RedBookDeviceState;
    expect(exported.user.likedNotes).toEqual(['note_1']);
    expect(exported.notes).toEqual({});
    expect(Object.values(exported.comments)[0]).toMatchObject({ noteId: 'note_1', content: 'hi' });
    // Unliking reverts to the catalog record.
    run('toggleLike', 'note_1');
    expect(note('note_1')!.likes).toBe(3);
  });

  it('counts a follow in the followed user record', () => {
    run('followUser', 'author_1');
    expect(user('author_1')!.followers).toBe(11);
    run('followUser', 'author_1');
    expect(user('author_1')!.followers).toBe(10);
  });

  it('filters derived relationship counts out of updateUser writes', () => {
    const { state } = run('updateUser', { intro: '新的简介', following: 999, followers: 888 });
    const exported = (state as RedBookDeviceState).user as any;
    expect(exported.intro).toBe('新的简介');
    expect(exported.following).toBeUndefined();
    expect(exported.followers).toBeUndefined();
  });

  it('puts published notes first in the feed and hides tombstoned notes', () => {
    const { result: newId } = run('addNote', { title: 'Mine', content: 'c', images: [] });
    const feed = () => (server.runQuery(session, 'redbook', 'feed', {}) as { items: Note[] }).items.map(n => n.id);
    expect(feed()).toEqual([newId, 'note_1', 'note_2']);
    server.importState(session, 'redbook', initialState({ notes: { note_1: null } }));
    expect(feed()).toEqual(['note_2']);
  });

  it('filters by category and sorts by likes like the home feed', () => {
    const page = (args: Record<string, unknown>) =>
      (server.runQuery(session, 'redbook', 'feed', args) as { items: Note[]; total: number });
    expect(page({ category: '旅行' }).items.map(n => n.id)).toEqual(['note_2']);
    expect(page({ sort: 'likes', limit: 1 })).toMatchObject({ total: 2, items: [{ id: 'note_2' }] });
  });

  it('keeps sessions isolated while sharing one catalog', () => {
    const other = server.createSession();
    server.importState(other, 'redbook', initialState());
    run('toggleLike', 'note_1');
    expect(note('note_1')!.likes).toBe(4);
    expect((server.getRecord(other, 'redbook', 'notes', 'note_1') as unknown as Note).likes).toBe(3);
  });
});
