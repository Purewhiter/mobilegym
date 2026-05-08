import { beforeEach, describe, expect, it, vi } from 'vitest';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe('Notes 待办输入即创建', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true,
    });
  });

  it('保存前会 trim 待办文本', async () => {
    const { normalizeTodoText } = await import('../system/Notes/pages/todoListModel');

    expect(normalizeTodoText('  买菜  ')).toBe('买菜');
    expect(normalizeTodoText('   ')).toBe('');
  });

  it('正在编辑的新建待办不会被列表隐藏', async () => {
    const { partitionVisibleTodos } = await import('../system/Notes/pages/todoListModel');

    const result = partitionVisibleTodos(
      [
        { id: 'draft', text: '买菜', completed: false, updatedAt: 3 },
        { id: 'todo-2', text: '明天去车站', completed: false, updatedAt: 2 },
        { id: 'todo-3', text: '给妈妈打电话', completed: true, updatedAt: 1 },
      ],
      '车站',
      'draft',
    );

    expect(result.incomplete.map(todo => todo.id)).toEqual(['draft', 'todo-2']);
    expect(result.completed.map(todo => todo.id)).toEqual([]);
  });

  it('store 在新增和更新时都会保存 trim 后的文本', async () => {
    const { useNotesStore } = await import('../system/Notes/state');

    const created = useNotesStore.getState().addTodo('  买菜  ');
    expect(useNotesStore.getState().todos.find(todo => todo.id === created.id)?.text).toBe('买菜');

    useNotesStore.getState().updateTodoText(created.id, '  买牛奶  ');
    expect(useNotesStore.getState().todos.find(todo => todo.id === created.id)?.text).toBe('买牛奶');
  });
});
