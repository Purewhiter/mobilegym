import { describe, expect, it } from 'vitest';
import { advanceScreenStack, type ScreenState } from '../os/navigation/screenStack';

type Loc = { path: string };

/** Drive the model like the host does: one call per committed history entry. */
function driver(tabs: string[] = []) {
  let seq = 0;
  let state: ScreenState<Loc> = { stack: [], parked: [] };
  const go = (path: string, index: number) => {
    state = advanceScreenStack(state, { identity: path.split('?')[0], location: { path } }, index, () => `s${++seq}`, (id) => tabs.includes(id));
    return state.stack.map((s) => `${s.id}:${s.location.path}@${s.startIndex}`);
  };
  return { go, get parked() { return state.parked.map((s) => `${s.id}:${s.location.path}`); } };
}

describe('advanceScreenStack', () => {
  it('push keeps the page below, back shows the same instance again', () => {
    const d = driver();
    d.go('/', 0);
    expect(d.go('/page/a', 1)).toEqual(['s1:/@0', 's2:/page/a@1']);
    expect(d.go('/', 0)).toEqual(['s1:/@0']);
  });

  it('a URL-driven dialog stays in its page instance', () => {
    const d = driver();
    d.go('/page/a', 0);
    expect(d.go('/page/a?dialog=ssid', 1)).toEqual(['s1:/page/a?dialog=ssid@0']);
    expect(d.go('/page/a', 0)).toEqual(['s1:/page/a@0']);
  });

  it('the same route with other params is another instance (A -> B -> new A)', () => {
    const d = driver();
    d.go('/page/a', 0);
    d.go('/page/b', 1);
    expect(d.go('/page/a', 2)).toEqual(['s1:/page/a@0', 's2:/page/b@1', 's3:/page/a@2']);
  });

  it('replace destroys the replaced instance', () => {
    const d = driver();
    d.go('/', 0);
    d.go('/page/a', 1);
    expect(d.go('/page/b', 1)).toEqual(['s1:/@0', 's3:/page/b@1']);
  });

  it('a dialog replaced by another page keeps the page under the dialog', () => {
    const d = driver();
    d.go('/page/a', 0);
    d.go('/page/a?dialog=x', 1);
    expect(d.go('/page/b', 1)).toEqual(['s1:/page/a?dialog=x@0', 's2:/page/b@1']);
    expect(d.go('/page/a', 0)).toEqual(['s1:/page/a@0']);
  });

  it('back several steps at once (popTo) drops every instance above', () => {
    const d = driver();
    d.go('/', 0);
    d.go('/page/a', 1);
    d.go('/page/b', 2);
    d.go('/page/b?dialog=x', 3);
    expect(d.go('/', 0)).toEqual(['s1:/@0']);
  });

  it('back below the first known entry starts a fresh instance', () => {
    const d = driver();
    d.go('/page/a', 2);
    expect(d.go('/', 1)).toEqual(['s2:/@1']);
  });

  it('switching main tabs parks the tab you leave and brings it back', () => {
    const d = driver(['/', '/me']);
    d.go('/?tab=discover', 0);
    expect(d.go('/me', 0)).toEqual(['s2:/me@0']);
    expect(d.parked).toEqual(['s1:/?tab=discover']);
    expect(d.go('/?tab=discover', 0)).toEqual(['s1:/?tab=discover@0']);
    expect(d.parked).toEqual(['s2:/me']);
  });

  it('a tab under a pushed page stays on the stack; pages are not parked', () => {
    const d = driver(['/', '/me']);
    d.go('/', 0);
    d.go('/note/1', 1);
    expect(d.go('/', 0)).toEqual(['s1:/@0']);
    expect(d.parked).toEqual([]);
  });
});
