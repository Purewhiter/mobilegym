import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const runExplorerPath = path.resolve(__dirname, '../public/run_explorer.html');
const runExplorerHtml = fs.readFileSync(runExplorerPath, 'utf8');

function extractFunctionSource(name: string): string {
  const signature = `function ${name}(`;
  const start = runExplorerHtml.indexOf(signature);
  if (start === -1) {
    throw new Error(`Could not find function ${name} in run_explorer.html`);
  }

  const bodyStart = runExplorerHtml.indexOf('{', start);
  if (bodyStart === -1) {
    throw new Error(`Could not find opening brace for ${name}`);
  }

  let depth = 0;
  for (let i = bodyStart; i < runExplorerHtml.length; i++) {
    const char = runExplorerHtml[i];
    if (char === '{') depth++;
    if (char === '}') depth--;
    if (depth === 0) {
      return runExplorerHtml.slice(start, i + 1);
    }
  }

  throw new Error(`Could not find closing brace for ${name}`);
}

type TaskStub = {
  task_id: string;
  task_name: string;
  dirName: string;
  status: string;
  tags: string[];
};

type FilterState = {
  success?: boolean;
  failed?: boolean;
  error?: boolean;
  sideEffect?: boolean;
  overdue?: boolean;
  falseComplete?: boolean;
};

type RenderOptions = {
  repeatN?: number;
  grouped?: boolean;
};

function renderWithFilters(tasks: TaskStub[], filters: FilterState, options: RenderOptions = {}): string {
  const wrap = {
    innerHTML: '',
    querySelectorAll: () => [] as Array<{ onclick?: () => void }>,
  };

  const inputs = {
    fSuccess: { checked: filters.success ?? false },
    fFailed: { checked: filters.failed ?? false },
    fError: { checked: filters.error ?? false },
    fSideEffect: { checked: filters.sideEffect ?? false },
    fOverdue: { checked: filters.overdue ?? false },
    fFalseComplete: { checked: filters.falseComplete ?? false },
  };

  const chips = Object.values(inputs).map(input => ({
    querySelector: () => input,
    classList: { toggle: () => {} },
  }));

  const elements = {
    taskList: wrap,
    taskFilter: { value: '' },
    ...inputs,
  };

  const taskGroups = new Map<string, TaskStub[]>();
  if (options.grouped) {
    taskGroups.set('group.demo', tasks);
  }

  const context = {
    state: {
      runDirName: 'demo-run',
      summary: {},
      meta: options.repeatN ? { repeat_n: options.repeatN } : {},
      taskGroups,
      tasks,
      selectedTask: null,
    },
    el: (id: keyof typeof elements) => elements[id],
    document: {
      querySelectorAll: (selector: string) => (selector === '.chip' ? chips : []),
    },
    taskPassesTaxonomyFilters: () => true,
    getTaskStatusForTrial: (task: TaskStub) => task.status,
    getTaskIndicators: (task: TaskStub) => task.tags,
    getResultForTask: () => ({
      execution: { steps: 3, runtime_s: 1.2 },
    }),
    INDICATOR_LABELS: {
      sideEffect: { icon: '🔧', text: '副作用' },
      overdue: { icon: '⏱', text: '超步数' },
      falseComplete: { icon: '🚫', text: '错误完成' },
    },
    console,
  };

  vm.createContext(context);
  new vm.Script(`${extractFunctionSource('renderTaskList')}\nthis.__fn = renderTaskList;`).runInContext(context);
  (context.__fn as () => void)();
  return wrap.innerHTML;
}

describe('run_explorer indicator filter semantics', () => {
  it('does not filter by issue tags when no issue tag is selected', () => {
    const html = renderWithFilters(
      [
        { task_id: 't.side', task_name: '带副作用失败', dirName: 'dir-side', status: 'failed', tags: ['sideEffect'] },
      ],
      { failed: true }
    );

    expect(html).toContain('带副作用失败');
  });

  it('filters positively when an issue tag is selected', () => {
    const html = renderWithFilters(
      [
        { task_id: 't.side', task_name: '带副作用失败', dirName: 'dir-side', status: 'failed', tags: ['sideEffect'] },
        { task_id: 't.plain', task_name: '普通失败', dirName: 'dir-plain', status: 'failed', tags: [] },
      ],
      { failed: true, sideEffect: true }
    );

    expect(html).toContain('带副作用失败');
    expect(html).not.toContain('普通失败');
  });

  it('matches any selected issue tag instead of requiring all tags', () => {
    const html = renderWithFilters(
      [
        { task_id: 't.side', task_name: '副作用失败', dirName: 'dir-side', status: 'failed', tags: ['sideEffect'] },
        { task_id: 't.overdue', task_name: '超步数失败', dirName: 'dir-overdue', status: 'failed', tags: ['overdue'] },
        { task_id: 't.plain', task_name: '普通失败', dirName: 'dir-plain', status: 'failed', tags: [] },
      ],
      { failed: true, sideEffect: true, overdue: true }
    );

    expect(html).toContain('副作用失败');
    expect(html).toContain('超步数失败');
    expect(html).not.toContain('普通失败');
  });

  it('shows grouped trials that match any selected issue tag', () => {
    const html = renderWithFilters(
      [
        { task_id: 'group.demo', task_name: '同组任务', dirName: 'dir-side', status: 'failed', tags: ['sideEffect'] },
        { task_id: 'group.demo', task_name: '同组任务', dirName: 'dir-overdue', status: 'failed', tags: ['overdue'] },
        { task_id: 'group.demo', task_name: '同组任务', dirName: 'dir-plain', status: 'failed', tags: [] },
      ],
      { failed: true, sideEffect: true, overdue: true },
      { grouped: true, repeatN: 2 }
    );

    expect(html).toContain('data-dir="dir-side"');
    expect(html).toContain('data-dir="dir-overdue"');
    expect(html).not.toContain('data-dir="dir-plain"');
  });
});
