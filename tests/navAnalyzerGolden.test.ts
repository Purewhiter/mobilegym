/**
 * navigation_declaration_analyzer.mjs — golden CLI 闸门
 *
 * 通过子进程运行 analyzer 本体（CLI 契约），对一小（Compass）一复杂（Alipay）
 * 两个 App 跑 schema 模式，与 public/ 入库产物逐字节比对。不 import 脚本内部
 * 函数——实现可以自由重构（如拆分为 scripts/lib/ 模块），只要输出字节不变、
 * CLI 行为不变，本测试就保持绿。
 *
 * 守住两件事：
 *   1. analyzer 重构不得引起任何输出字节漂移（对象键序、pretty 缩进、字段集合）；
 *   2. 声明与 public/ 入库产物不得脱同步（改声明必须重新生成产物）。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'navigation_declaration_analyzer.mjs');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-analyzer-golden-'));

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** 定位第一个差异字节，便于失败时快速看到漂移点（而不是打印整个 JSON）。 */
function describeFirstDiff(actual: Buffer, expected: Buffer): string {
  const n = Math.min(actual.length, expected.length);
  let i = 0;
  while (i < n && actual[i] === expected[i]) i++;
  if (i === n && actual.length === expected.length) return 'byte-identical';
  const ctx = (buf: Buffer) =>
    JSON.stringify(buf.subarray(Math.max(0, i - 40), i + 40).toString('utf-8'));
  return (
    `first diff at byte ${i} (actual ${actual.length}B vs expected ${expected.length}B)\n` +
    `  actual   ...${ctx(actual)}...\n` +
    `  expected ...${ctx(expected)}...`
  );
}

const CASES = [
  { app: 'Compass', lower: 'compass' },
  { app: 'Alipay', lower: 'alipay' },
] as const;

describe('navigation_declaration_analyzer golden (schema mode vs public/ artifacts)', () => {
  for (const { app, lower } of CASES) {
    it(
      `${app}: 图与 simplified 伴生产物均与 public/ 逐字节一致`,
      () => {
        const outFile = path.join(tmpDir, `${lower}_nav_graph.json`);
        const res = spawnSync(process.execPath, [SCRIPT, app, '-o', outFile], {
          cwd: REPO_ROOT,
          encoding: 'utf-8',
          timeout: 120_000,
        });
        expect(res.status, `stderr: ${res.stderr}`).toBe(0);

        for (const suffix of ['_nav_graph.json', '_nav_graph_simplified.json']) {
          const actualPath = path.join(tmpDir, `${lower}${suffix}`);
          const goldenPath = path.join(REPO_ROOT, 'public', `${lower}${suffix}`);
          const actual = fs.readFileSync(actualPath);
          const golden = fs.readFileSync(goldenPath);
          expect(
            actual.equals(golden),
            `${lower}${suffix}: ${describeFirstDiff(actual, golden)}`,
          ).toBe(true);
        }
      },
      120_000,
    );
  }
});

// data 模式产物不入库（按需生成），没有 public/ golden 可比；用「确定性双跑 +
// 结构快照」锁 nav_data_expand/prune 的回归：同一声明与数据两次运行必须逐字节
// 一致，且节点/边规模与 schemaVersion 落在快照锁定的形状上。
describe('navigation_declaration_analyzer golden (data mode determinism + shape)', () => {
  it(
    'WechatReading --data: 双跑逐字节一致且图形状稳定',
    () => {
      const run = (outName: string) => {
        const outFile = path.join(tmpDir, outName);
        const res = spawnSync(
          process.execPath,
          [SCRIPT, 'WechatReading', '--data', 'data/index.ts', '-o', outFile],
          { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 120_000 },
        );
        expect(res.status, `stderr: ${res.stderr}`).toBe(0);
        return fs.readFileSync(outFile);
      };

      const first = run('wr_data_1.json');
      const second = run('wr_data_2.json');
      expect(first.equals(second), describeFirstDiff(first, second)).toBe(true);

      const graph = JSON.parse(first.toString('utf-8'));
      expect(graph.schemaVersion).toBe(1);
      expect(graph.mode).toBe('data');
      // 形状快照：节点/边数量随声明或数据有意变化时，更新此处即可。
      expect({ nodes: graph.nodes.length, edges: graph.edges.length }).toMatchInlineSnapshot(`
        {
          "edges": 706,
          "nodes": 213,
        }
      `);
    },
    240_000,
  );
});
