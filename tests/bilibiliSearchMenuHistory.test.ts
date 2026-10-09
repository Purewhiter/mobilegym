import { describe, expect, it, vi } from 'vitest';

const memory = vi.hoisted(() => ({
  entries: ['/search/results?q=C%2B%2B&tab=user'], index: 0,
}));
vi.mock('react', () => ({ useContext: () => ({ navigator: {} }) }));
vi.mock('react-router-dom', () => ({
  UNSAFE_NavigationContext: {},
  useLocation: () => {
    const url = new URL(memory.entries[memory.index], 'http://localhost');
    return { pathname: url.pathname, search: url.search };
  },
  useSearchParams: () => [new URL(memory.entries[memory.index], 'http://localhost').searchParams],
  useNavigate: () => (target: string | number) => {
    if (typeof target === 'number') { memory.index += target; return; }
    memory.entries = memory.entries.slice(0, memory.index + 1);
    memory.entries.push(target);
    memory.index++;
  },
}));
import { useAppNavigate } from '../apps/Bilibili/navigation';

describe('Bilibili search user menu history', () => {
  it('retains the exact target and query in each restored history entry', () => {
    useAppNavigate().go('search.user.menu.open', { mid: 'first-user' });
    const first = memory.entries[memory.index];
    const params = new URL(first, 'http://localhost').searchParams;
    expect(params.get('q')).toBe('C++');
    expect(params.get('tab')).toBe('user');
    expect(params.get('menu')).toBe('true');
    expect(params.get('mid')).toBe('first-user');
    useAppNavigate().back();
    useAppNavigate().go('search.user.menu.open', { mid: 'second-user' });
    expect(new URL(memory.entries[memory.index], 'http://localhost').searchParams.get('mid')).toBe('second-user');
    expect(new URL(first, 'http://localhost').searchParams.get('mid')).toBe('first-user');
  });
});
