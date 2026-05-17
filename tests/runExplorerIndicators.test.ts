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

function loadGetTaskIndicators(result: unknown) {
  const helperSources = ['isErrorEpisode', 'isRealSuccess']
    .filter(name => runExplorerHtml.includes(`function ${name}(`))
    .map(extractFunctionSource)
    .join('\n');
  const indicatorSource = extractFunctionSource('getTaskIndicators');

  const context = {
    getResultForTask: () => result,
    console,
  };
  vm.createContext(context);
  new vm.Script(`${helperSources}\n${indicatorSource}\nthis.__fn = getTaskIndicators;`).runInContext(context);
  return context.__fn as (task: unknown) => string[];
}

describe('run_explorer falseComplete indicator alignment', () => {
  it('does not tag falseComplete for error episodes', () => {
    const getTaskIndicators = loadGetTaskIndicators({
      is_error: true,
      execution: {
        finished: true,
        truncated: false,
        stop_reason: 'COMPLETE',
      },
      judge: {
        success: false,
        clean: true,
      },
    });

    expect(getTaskIndicators({})).not.toContain('falseComplete');
  });

  it('tags falseComplete when agent declared COMPLETE but episode is not fully successful', () => {
    const getTaskIndicators = loadGetTaskIndicators({
      is_error: false,
      execution: {
        finished: true,
        truncated: false,
        stop_reason: 'COMPLETE',
      },
      judge: {
        success: false,
        clean: true,
      },
    });

    expect(getTaskIndicators({})).toContain('falseComplete');
  });
});
