import { afterEach, describe, expect, it } from 'vitest';
import { clearNavError, getLastNavError, recordNavError } from '../os/osNavError';

describe('osNavError module state', () => {
  afterEach(() => {
    clearNavError();
  });

  it('starts empty', () => {
    expect(getLastNavError()).toBeNull();
  });

  it('record → get → clear round-trip', () => {
    recordNavError('/wifi', 'activity-42');
    const err = getLastNavError();
    expect(err).not.toBeNull();
    expect(err!.route).toBe('/wifi');
    expect(err!.activityId).toBe('activity-42');
    expect(typeof err!.timestamp).toBe('number');

    clearNavError();
    expect(getLastNavError()).toBeNull();
  });

  it('record overwrites the previous entry (only latest failure is kept)', () => {
    recordNavError('/a', 'act-1');
    recordNavError('/b', 'act-2');
    const err = getLastNavError();
    expect(err!.route).toBe('/b');
    expect(err!.activityId).toBe('act-2');
  });
});
