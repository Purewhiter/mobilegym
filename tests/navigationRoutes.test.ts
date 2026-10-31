import { describe, expect, it } from 'vitest';
import { buildHref, defineRoutes } from '../os/navigation/routes';

const routes = defineRoutes({
  home: { path: '/' },
  detail: { path: '/history/:meetingId' },
  messages: { path: '/messages', search: { tab: ['todo', 'all'], sub: ['system', 'welfare'] } },
});

describe('os/navigation routes', () => {
  it('names each route after its key', () => {
    expect(routes.detail).toEqual({ name: 'detail', path: '/history/:meetingId', search: {} });
  });

  it('fills path params and requires them', () => {
    expect(buildHref(routes.detail, { meetingId: 42 })).toBe('/history/42');
    expect(() => buildHref(routes.detail, {})).toThrow(/meetingId/);
  });

  it('builds the query from scratch: keep copies keys, null clears them', () => {
    const current = new URLSearchParams('tab=all&sub=system&x=1');
    expect(buildHref(routes.messages, {}, { search: { tab: 'todo' } }, current)).toBe('/messages?tab=todo');
    expect(buildHref(routes.messages, {}, { keep: ['tab', 'sub'], search: { sub: null } }, current)).toBe('/messages?tab=all');
    expect(buildHref(routes.messages, {}, { search: { tab: 'all', sub: 'welfare' } })).toBe('/messages?tab=all&sub=welfare');
    expect(buildHref(routes.home)).toBe('/');
  });
});
