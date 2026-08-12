/**
 * lint_store_getters.mjs — 行为级测试
 *
 * 通过子进程运行脚本本体（CLI 契约），在临时工作区里构造 fixture App，
 * 断言退出码与关键输出，不 import 脚本内部函数——脚本实现可以自由重构
 * （如扩展 system/ 扫描），只要 CLI 行为不变，本测试就保持绿。
 *
 * 依赖的 CLI 契约（见脚本头部 Usage 注释）：
 *   - 工作区根 = process.cwd()，扫描 <cwd>/apps/<App>/state.ts 及 App 内 .tsx；
 *   - 位置参数为 App 名过滤；
 *   - 发现反模式 → exit 1 并打印 getter 名，干净 → exit 0。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SCRIPT_PATH = fileURLToPath(new URL('../scripts/lint_store_getters.mjs', import.meta.url));

let fixtureRoot: string;

function runLint(args: string[] = []) {
  const res = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd: fixtureRoot,
    encoding: 'utf-8',
    timeout: 30_000,
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function writeFixtureFile(relPath: string, contents: string) {
  const abs = path.join(fixtureRoot, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents, 'utf-8');
}

beforeAll(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-store-getters-'));

  // 空 system/ 目录：脚本若扩展 system/ 扫描也不应因目录缺失而崩
  fs.mkdirSync(path.join(fixtureRoot, 'system'), { recursive: true });

  // ── Fixture 1：违规 App —— actions 接口里有查询 getter + 组件订阅它 ──
  writeFixtureFile(
    'apps/ViolationApp/state.ts',
    `interface ViolationAppActions {
  isThing: (id: string) => boolean;
  getThingById: (id: string) => Thing;
  setThing: (id: string) => void;
}
`,
  );
  writeFixtureFile(
    'apps/ViolationApp/pages/Page.tsx',
    `export const Page = () => {
  const liked = useViolationAppStore(s => s.isThing);
  return null;
};
`,
  );

  // ── Fixture 2：干净 App —— 只有白名单布尔/写操作，组件订阅数据字段 ──
  writeFixtureFile(
    'apps/CleanApp/state.ts',
    `interface CleanAppActions {
  isPlaying: () => boolean;
  setName: (name: string) => void;
  toggleLike: (id: string) => void;
  reset: () => void;
}
`,
  );
  writeFixtureFile(
    'apps/CleanApp/pages/Page.tsx',
    `export const Page = () => {
  const items = useCleanAppStore(s => s.items);
  return null;
};
`,
  );
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('lint_store_getters CLI', () => {
  it('违规 App：查询 getter 定义 + 组件订阅 → exit 1，输出指出问题', () => {
    const { status, stdout } = runLint(['ViolationApp']);
    expect(status).toBe(1);
    // Pass 1：actions 接口里的查询 getter
    expect(stdout).toContain('isThing');
    expect(stdout).toContain('getThingById');
    // Pass 2：组件订阅 getter 函数引用
    expect(stdout).toContain('useViolationAppStore');
    // 合法写操作不应被点名
    expect(stdout).not.toContain('setThing');
  });

  it('干净 App（含 SAFE_NAMES 白名单 isPlaying）→ exit 0', () => {
    const { status, stdout, stderr } = runLint(['CleanApp']);
    expect(stderr).toBe('');
    expect(status, `stdout: ${stdout}`).toBe(0);
  });

  it('不带过滤扫描全工作区：存在违规 App → exit 1', () => {
    const { status } = runLint();
    expect(status).toBe(1);
  });
});
