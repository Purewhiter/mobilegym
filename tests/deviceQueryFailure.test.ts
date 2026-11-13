import { beforeEach, describe, expect, it, vi } from 'vitest';

// A device session whose queries fail a set number of times before answering.
let failures = 0;
let calls = 0;
let status: number | undefined;
let generation = 0;
let queryGate: Promise<void> | undefined;

vi.mock('../os/device/DeviceClient', () => {
  class DeviceStaleError extends Error {}
  return {
    DeviceClient: {
      generation: () => generation,
      sessionId: async () => 'test',
      hold: () => {},
      whenIdle: async () => {},
      query: async (_appId: string, name: string) => {
        calls += 1;
        await queryGate;
        if (failures > 0) {
          failures -= 1;
          throw Object.assign(new Error('query failed'), { status });
        }
        return `${name}#${calls}`;
      },
    },
    DeviceStaleError,
  };
});
vi.mock('../os/createAppStore', () => ({ registerAppStore() {}, registerStateSetter() {} }));

const { DeviceStaleError } = await import('../os/device/DeviceClient');
const { awaitLaunchData, deviceQueryFailures, prefetchDeviceQuery, waitForStateCommit } = await import('../os/device/deviceStore');

describe('device query failures', () => {
  beforeEach(() => {
    failures = 0;
    calls = 0;
    status = undefined;
    queryGate = undefined;
    // A new episode: failures recorded by earlier tests no longer count.
    generation += 1;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('tries a failed query again before giving up', async () => {
    failures = 2;
    await prefetchDeviceQuery('q-app', 'flaky');
    expect(calls).toBe(3);
    // It answered in the end: nothing to report, the episode can be judged.
    expect(deviceQueryFailures()).toEqual([]);
    await expect(waitForStateCommit()).resolves.toBeUndefined();
    // Answered: asking again uses the cached result.
    await prefetchDeviceQuery('q-app', 'flaky');
    expect(calls).toBe(3);
  });

  it('stops after three attempts and fetches again when asked', async () => {
    failures = 3;
    await prefetchDeviceQuery('q-app', 'down');
    expect(calls).toBe(3);
    // Not stuck on the failure: the next request for it goes out.
    await prefetchDeviceQuery('q-app', 'down');
    expect(calls).toBe(4);
    // The page went without its data at some step: the episode is not judged.
    expect(deviceQueryFailures()).toContainEqual({ query: 'q-app.down', message: 'query failed' });
    await expect(waitForStateCommit()).rejects.toThrow('Device data was missing during this episode: q-app.down');
  });

  it('does not repeat a request the server refused', async () => {
    failures = 1;
    status = 404;
    await prefetchDeviceQuery('q-app', 'missing');
    expect(calls).toBe(1);
  });

  it('does not record a query that fails after its episode resets', async () => {
    let release!: () => void;
    queryGate = new Promise((resolve) => { release = resolve; });
    failures = 1;
    status = 404;
    const loading = prefetchDeviceQuery('q-app', 'reset-during-query');
    await Promise.resolve();
    generation += 1;
    release();
    await loading;
    expect(deviceQueryFailures()).toEqual([]);
  });
});

describe('shared data an app launches with', () => {
  beforeEach(() => {
    generation += 1;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('records nothing when the data arrives in time', async () => {
    await awaitLaunchData('providers.sync', Promise.resolve(), 50);
    expect(deviceQueryFailures()).toEqual([]);
  });

  it('records an app that opened before the data arrived', async () => {
    await awaitLaunchData('providers.sync', new Promise(() => {}), 10);
    expect(deviceQueryFailures()).toEqual([{ query: 'providers.sync', message: 'not loaded within 10ms' }]);
    await expect(waitForStateCommit()).rejects.toThrow('Device data was missing during this episode: providers.sync');
  });

  it('records a load that failed', async () => {
    await awaitLaunchData('fs.init', Promise.reject(new Error('session lost')), 50);
    expect(deviceQueryFailures()).toEqual([{ query: 'fs.init', message: 'session lost' }]);
  });

  it('records nothing for a load a reset abandoned', async () => {
    await awaitLaunchData('providers.sync', Promise.reject(new DeviceStaleError()), 50);
    expect(deviceQueryFailures()).toEqual([]);
  });

  it('does not charge the next episode for a wait that started before a reset', async () => {
    const waiting = awaitLaunchData('providers.sync', new Promise(() => {}), 10);
    generation += 1;
    await waiting;
    expect(deviceQueryFailures()).toEqual([]);
  });
});
