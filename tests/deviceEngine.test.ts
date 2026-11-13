import { describe, expect, it } from 'vitest';

import { DeviceServer, type AppModule } from '../device/engine';
import { createStateOnlyModule } from '../device/stateOnly';

type CounterState = { count: number };

const counter: AppModule<CounterState> = {
  appId: 'counter',
  loadCatalog: () => ({ collections: new Map(), extras: {} }),
  materialize() {},
  exportState: (ctx) => ctx.state,
  importState: (raw) => raw as CounterState,
  commands: {
    add(ctx, [n]) {
      ctx.state = { count: ctx.state.count + Number(n) };
      ctx.put('marks', { id: `m${ctx.state.count}` });
    },
    addThenFail(ctx, [n]) {
      ctx.state = { count: ctx.state.count + Number(n) };
      ctx.put('marks', { id: 'lost' });
      ctx.hide('marks', 'm1');
      throw new Error('boom');
    },
  },
  queries: {},
};

function server() {
  const s = new DeviceServer('/', undefined, createStateOnlyModule);
  s.register(counter);
  return s;
}

describe('device engine', () => {
  it('leaves the session untouched when a command throws', () => {
    const s = server();
    const session = s.createSession();
    s.importState(session, 'counter', { count: 0 });
    s.runCommand(session, 'counter', 'add', [1], { now: 0 });
    const version = session.version;

    expect(() => s.runCommand(session, 'counter', 'addThenFail', [5], { now: 0 })).toThrow('boom');

    expect(s.exportState(session, 'counter')).toEqual({ count: 1 });
    expect(s.overlay(session, 'counter', 'marks')).toEqual({ m1: { id: 'm1' } });
    expect(session.version).toBe(version);
    // The session still works afterwards.
    expect(s.runCommand(session, 'counter', 'add', [1], { now: 0 }).state).toEqual({ count: 2 });
  });

  it('preserves the snapshot and version when export fails', () => {
    const s = new DeviceServer('/');
    s.register({
      ...counter,
      exportState(ctx) {
        if (ctx.state.count > 1) throw new Error('export failed');
        return ctx.state;
      },
    });
    const session = s.createSession();
    s.importState(session, 'counter', { count: 0 });
    s.runCommand(session, 'counter', 'add', [1], { now: 0 });
    const version = session.version;

    expect(() => s.runCommand(session, 'counter', 'add', [1], { now: 0 })).toThrow('export failed');
    expect(() => s.importState(session, 'counter', { count: 2 })).toThrow('export failed');
    expect(s.exportState(session, 'counter')).toEqual({ count: 1 });
    expect(s.overlay(session, 'counter', 'marks')).toEqual({ m1: { id: 'm1' } });
    expect(session.version).toBe(version);
  });

  it('stores the state of an app nobody registered', () => {
    const s = server();
    const session = s.createSession();
    expect(s.isInitialized(session, 'brand_new_app')).toBe(false);
    s.importState(session, 'brand_new_app', { a: 1 });
    s.runCommand(session, 'brand_new_app', '__replace', [{ a: 2 }], { now: 0 });
    expect(s.exportState(session, 'brand_new_app')).toEqual({ a: 2 });
    expect(s.appIds()).toContain('brand_new_app');
  });

  it('refuses ids that are not app ids, and unknown apps without a fallback', () => {
    const s = server();
    const session = s.createSession();
    expect(() => s.importState(session, '../etc', {})).toThrow('unknown app');
    const strict = new DeviceServer('/');
    expect(() => strict.importState(strict.createSession(), 'brand_new_app', {})).toThrow('unknown app');
  });

  it('gives sessions ids that cannot be derived from one another', () => {
    const s = new DeviceServer('/', 3);
    const a = s.createSession().id;
    const b = s.createSession().id;
    expect(a).toMatch(/^s3-[0-9a-z]+-[0-9a-f]{24}$/);
    expect(a.split('-')[2]).not.toBe(b.split('-')[2]);
  });
});
