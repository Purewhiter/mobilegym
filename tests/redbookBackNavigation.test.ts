import { describe, expect, test } from 'vitest';
import { getRedBookBackIntent } from '../apps/RedBook/components/RedBookNavigationHandler';

describe('RedBook back navigation', () => {
  test('closes root overlays before running double-back exit logic', () => {
    expect(
      getRedBookBackIntent({
        pathname: '/',
        search: '?tab=discover&menu=drawer',
        currentIndex: 1,
        lastBackTime: 0,
        now: 10_000,
      }),
    ).toEqual({ type: 'history-back' });

    expect(
      getRedBookBackIntent({
        pathname: '/me',
        search: '?tab=notes&sub=public&modal=publish',
        currentIndex: 3,
        lastBackTime: 0,
        now: 10_000,
      }),
    ).toEqual({ type: 'history-back' });
  });
});
