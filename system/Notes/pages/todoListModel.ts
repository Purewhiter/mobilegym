import type { NotesTodo } from '../types';

export function normalizeTodoText(text: string): string {
  return text.trim();
}

export function partitionVisibleTodos(
  todos: NotesTodo[],
  query: string,
  editingId: string | null,
): { incomplete: NotesTodo[]; completed: NotesTodo[] } {
  const loweredQuery = query.trim().toLowerCase();
  const incomplete: NotesTodo[] = [];
  const completed: NotesTodo[] = [];

  for (const todo of todos) {
    const matchesQuery =
      todo.id === editingId || !loweredQuery || todo.text.toLowerCase().includes(loweredQuery);
    if (!matchesQuery) continue;

    if (todo.completed) {
      completed.push(todo);
    } else {
      incomplete.push(todo);
    }
  }

  return { incomplete, completed };
}
