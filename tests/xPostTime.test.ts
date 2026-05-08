import { beforeEach, describe, expect, it, vi } from 'vitest';

const FIXED_NOW = Date.parse('2026-03-25T05:43:06.000Z');
const TWITTER_EPOCH_MS = 1288834974657n;

function snowflakeToIso(id: string): string {
  const numeric = BigInt(id.replace(/^p_/, ''));
  const timestampMs = Number((numeric >> 22n) + TWITTER_EPOCH_MS);
  return new Date(timestampMs).toISOString();
}

describe('X 帖子时间派生', () => {
  beforeEach(() => {
    vi.resetModules();

    vi.doMock('../os/TimeService', async () => {
      const actual = await vi.importActual<typeof import('../os/TimeService')>('../os/TimeService');
      return {
        ...actual,
        now: () => FIXED_NOW,
      };
    });

    vi.doMock('../os/locale', async () => {
      const actual = await vi.importActual<typeof import('../os/locale')>('../os/locale');
      return {
        ...actual,
        getLocale: () => 'en',
      };
    });
  });

  it('优先用 createdAt 派生展示 time', async () => {
    const { getXPostDisplayTime } = await import('../apps/X/utils/formatTime');

    expect(
      getXPostDisplayTime({
        id: 'p_1998865882718810540',
        createdAt: '2026-03-25T04:43:06.000Z',
        time: '2d',
      }),
    ).toBe('1h');
  });

  it('缺少 createdAt 时会用 ISO time 回填', async () => {
    const { normalizeXPostTemporalFields } = await import('../apps/X/utils/formatTime');

    expect(
      normalizeXPostTemporalFields({
        id: 'p_1998865882718810540',
        authorId: 'u_vivalastool',
        content: 'sample',
        time: '2026-03-25T04:43:06.000Z',
        stats: { comments: 0, retweets: 0, likes: 0, views: 0 },
      }),
    ).toMatchObject({
      createdAt: '2026-03-25T04:43:06.000Z',
      time: '1h',
    });
  });

  it('旧数据已有相对 time 时，不会被帖子 id 反推时间覆盖', async () => {
    const { normalizeXPostTemporalFields } = await import('../apps/X/utils/formatTime');

    expect(
      normalizeXPostTemporalFields({
        id: 'p_1879526642210808148',
        authorId: 'u_skywind3000',
        content: 'sample',
        time: '5h',
        stats: { comments: 0, retweets: 0, likes: 0, views: 0 },
      }),
    ).toMatchObject({
      time: '5h',
    });
  });

  it('缺少绝对时间时会从帖子 id 回填 createdAt', async () => {
    const { resolveXPostCreatedAt } = await import('../apps/X/utils/formatTime');

    expect(
      resolveXPostCreatedAt({
        id: 'p_1998865882718810540',
        time: '1h',
      }),
    ).toBe(snowflakeToIso('p_1998865882718810540'));
  });

  it('最新排序会正确识别本地 new_/reply_ 时间戳 id', async () => {
    const { compareXPostsByRecencyDesc } = await import('../apps/X/utils/formatTime');

    expect(
      compareXPostsByRecencyDesc(
        { id: 'reply_1710000001000', time: '刚刚' },
        { id: 'new_1710000000000', time: '刚刚' },
      ),
    ).toBeLessThan(0);
  });

  it('最新排序在相对 time 与显式 createdAt 混排时，会优先保持新旧关系正确', async () => {
    const { compareXPostsByRecencyDesc } = await import('../apps/X/utils/formatTime');

    expect(
      compareXPostsByRecencyDesc(
        { id: 'p_1879526642210808148', time: '5h' },
        { id: 'p_older', createdAt: '2025-01-15T13:50:46.076Z', time: '2d' },
      ),
    ).toBeLessThan(0);
  });
});
