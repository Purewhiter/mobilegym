import { beforeEach, describe, expect, it } from 'vitest';
import { defaultOsState, OsStateStore } from '../os/OsStateStore';
import { applyOsStatePatch } from '../os/simState';

function resetOsState() {
  OsStateStore.setState(structuredClone(defaultOsState), true);
}

describe('applyOsStatePatch array selectors', () => {
  beforeEach(() => {
    resetOsState();
  });

  it('updates, deletes, and appends nearby bluetooth devices via selector syntax', () => {
    applyOsStatePatch({
      hardware: {
        'nearbyBluetooth[name=Xiaomi Buds 4 Pro]': { connected: false },
        'nearbyBluetooth[name=小米手表]': { connected: true },
        'nearbyBluetooth[name=JBL Flip 6]': null,
        'nearbyBluetooth[]': {
          name: 'Test Speaker',
          mac: 'AA:BB:CC:DD:EE:FF',
          type: 'audio',
          paired: false,
          connected: false,
        },
      },
    });

    const devices = OsStateStore.getState().hardware.nearbyBluetooth;
    const buds = devices.find((item) => item.name === 'Xiaomi Buds 4 Pro');
    const watch = devices.find((item) => item.name === '小米手表');
    const jbl = devices.find((item) => item.name === 'JBL Flip 6');
    const appended = devices.find((item) => item.name === 'Test Speaker');

    expect(buds?.connected).toBe(false);
    expect(watch?.connected).toBe(true);
    expect(jbl).toBeUndefined();
    expect(appended).toMatchObject({
      name: 'Test Speaker',
      mac: 'AA:BB:CC:DD:EE:FF',
      type: 'audio',
      paired: false,
      connected: false,
    });
  });
});
