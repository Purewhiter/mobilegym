import { describe, expect, it } from 'vitest';
import { runAppDataLoaderModule } from '../os/appDataLoaderReady';

describe('app data loader readiness protocol', () => {
  it('runs preload, hydrateStore, then waitReady in order', async () => {
    const calls: string[] = [];

    await runAppDataLoaderModule({
      preload: async () => { calls.push('preload'); },
      hydrateStore: async () => { calls.push('hydrateStore'); },
      waitReady: async () => { calls.push('waitReady'); },
    });

    expect(calls).toEqual(['preload', 'hydrateStore', 'waitReady']);
  });
});
