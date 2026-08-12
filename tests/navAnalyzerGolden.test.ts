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
