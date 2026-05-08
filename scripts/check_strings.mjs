#!/usr/bin/env node
/**
 * scripts/check_strings.mjs
 *
 * 检查所有 App 的 strings.ts / strings.en.ts 是否完整、一致、符合真实 App 习惯。
 *
 * Usage:
 *   node scripts/check_strings.mjs                # 检查所有 app
 *   node scripts/check_strings.mjs Weather        # 只检查指定 app（大小写不敏感）
 *   node scripts/check_strings.mjs --verbose      # 同时显示 INFO 级别提示
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DIR = path.resolve(__dirname, '../apps');

// ─── CLI ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const verbose = argv.includes('--verbose');
const filterApp = argv.find(a => !a.startsWith('--')) ?? null;

// ─── 标准值（常见 UI 动作词应与真实 App 保持一致）─────────────────────────
const STD_ZH = {
  action_cancel:  ['取消'],
  action_confirm: ['确认', '确定'],
  action_save:    ['保存'],
  action_delete:  ['删除'],
  action_edit:    ['编辑'],
  action_share:   ['分享'],
  action_close:   ['关闭'],
  action_add:     ['添加', '新增'],
  action_search:  ['搜索'],
  action_send:    ['发送'],
  cancel:         ['取消'],
  confirm:        ['确认', '确定'],
  back:           ['返回'],
  loading:        ['加载中...', '加载中', '正在加载...'],
  locating:       ['定位中...', '定位中'],
};

const STD_EN = {
  action_cancel:  ['Cancel'],
  action_confirm: ['Confirm', 'OK'],
  action_save:    ['Save'],
  action_delete:  ['Delete'],
  action_edit:    ['Edit'],
  action_share:   ['Share'],
  action_close:   ['Close'],
  action_add:     ['Add'],
  action_search:  ['Search'],
  action_send:    ['Send'],
  cancel:         ['Cancel'],
  confirm:        ['Confirm', 'OK'],
  back:           ['Back'],
  loading:        ['Loading...', 'Loading'],
};

// ─── 正则解析 ─────────────────────────────────────────────────────────────
const HAS_CJK    = /[\u4e00-\u9fff\u3400-\u4dbf\uff01-\uffee]/;
const HAS_LATIN  = /[a-zA-Z]/;

/**
 * 从 strings.ts / strings.en.ts 中提取 key → value 对。
 * 支持：单引号、双引号。
 * 标记模板函数（箭头函数值）为 '__FUNCTION__'。
 * 返回 null 表示文件不存在。
 */
function parseStringsFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const src = fs.readFileSync(filePath, 'utf-8');
  const result = {};

  // 单引号或双引号字符串值
  // 匹配：  key: 'value'  或  key: "value"（行首有 2+ 空格缩进）
  const reStr = /^[ \t]{2,}(\w+):\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/gm;
  let m;
  while ((m = reStr.exec(src)) !== null) {
    result[m[1]] = (m[2] ?? m[3])
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"');
  }

  // 模板字符串（无插值的 `...`）
  const reTpl = /^[ \t]{2,}(\w+):\s*`([^`$\\]*)`/gm;
  while ((m = reTpl.exec(src)) !== null) {
    if (!result[m[1]]) result[m[1]] = m[2];
  }

  // 标记函数值（模板函数，如 greeting: (name: string) => `...`）
  const reFn = /^[ \t]{2,}(\w+):\s*(?:\([^)]*\)\s*=>|function\s*\()/gm;
  while ((m = reFn.exec(src)) !== null) {
    result[m[1]] = '__FUNCTION__';
  }

  return result;
}

// ─── 问题收集 ──────────────────────────────────────────────────────────────
const E = '❌'; // Error  — 需要立即修复
const W = '⚠️ '; // Warn   — 需要关注
const I = 'ℹ️ '; // Info   — 参考信息

function collectIssues(appName, zh, en) {
  const issues = [];
  const add = (sev, key, msg) => issues.push({ sev, key, msg });

  if (!zh) { add(E, '', '缺少 strings.ts'); return issues; }
  if (!en) { add(W, '', '缺少 strings.en.ts（无英文翻译文件）'); return issues; }

  const zhKeys = new Set(Object.keys(zh));
  const enKeys = new Set(Object.keys(en));

  // ① ZH 有 / EN 缺（漏译）
  // 例外：若 ZH 值本身不含中文字符（数学符号、标点、国际通用缩写），
  //       EN 省略该 key 是正确的（值相同，无需重复声明）
  for (const k of zhKeys) {
    if (zh[k] === '__FUNCTION__') continue;
    if (!enKeys.has(k)) {
      if (!HAS_CJK.test(zh[k])) {
        add(I, k, `EN 未声明此 key（ZH 值无中文，语言中立，可省略）→ "${zh[k]}"`);
      } else {
        add(W, k, `EN 缺少翻译 → ZH 值: "${zh[k]}"`);
      }
    }
  }

  // ② EN 有 / ZH 缺（孤儿 key）
  for (const k of enKeys) {
    if (!zhKeys.has(k)) {
      add(W, k, `strings.en.ts 中有多余 key（ZH 不存在）→ EN 值: "${en[k]}"`);
    }
  }

  // ③ 空值
  // 注意：date/unit/suffix/prefix 类 key 在英文中为空字符串是合理的
  // （英文不用"日"/"月"/"年"/"级"等量词），降级为 INFO
  // 使用子串匹配，覆盖 date_suffix_day / me_unit_ge / common_unit_ge 等命名变体
  const isSuffixKey = (k) =>
    k.includes('suffix') || k.includes('prefix') || k.includes('_unit') ||
    k.includes('Suffix') || k.includes('Prefix') || k.includes('Unit') ||
    k.endsWith('_person');  // 中文量词"人"后缀，英文中为空是正确的
  for (const [k, v] of Object.entries(zh)) {
    if (v === '__FUNCTION__') continue;
    if (!v || v.trim() === '') add(E, k, `ZH 值为空字符串`);
  }
  for (const [k, v] of Object.entries(en)) {
    if (!v || v.trim() === '') {
      if (isSuffixKey(k)) {
        add(I, k, `EN 值为空（量词/后缀在英文中不需要，请确认是否正确）`);
      } else {
        add(W, k, `EN 值为空字符串（非后缀 key，可能漏填）`);
      }
    }
  }

  // ④ EN 值含中文（错把中文放进英文文件）
  for (const [k, v] of Object.entries(en)) {
    if (HAS_CJK.test(v)) add(E, k, `EN 值含中文字符 → "${v}"`);
  }

  // ⑤ ZH 值疑似未翻译（纯拉丁但不像专有名词）
  const isProperNoun = (k, v) =>
    k === 'app_name' ||
    k.startsWith('version') ||
    k.endsWith('_unit') ||
    k.endsWith('_suffix') ||
    k.endsWith('_prefix') ||
    /^[A-Z][A-Z0-9\-_.+ ]*$/.test(v) ||   // 全大写缩写
    v.length <= 4;                          // 极短字符（Wi-Fi、%、cm 等）
  for (const [k, v] of Object.entries(zh)) {
    if (v === '__FUNCTION__') continue;
    if (!HAS_CJK.test(v) && HAS_LATIN.test(v) && !isProperNoun(k, v)) {
      add(I, k, `ZH 值疑似未翻译（含拉丁字符）→ "${v}"`);
    }
  }

  // ⑥ ZH 与 EN 值完全相同（可能漏翻或是专有名词——需人工确认）
  for (const k of zhKeys) {
    if (!enKeys.has(k) || zh[k] === '__FUNCTION__') continue;
    if (zh[k] === en[k] && zh[k].length > 3 && !zh[k].match(/^[\d.%]+$/)) {
      if (HAS_CJK.test(zh[k])) {
        add(E, k, `ZH/EN 值完全相同且含中文 → "${zh[k]}"`);
      } else {
        add(I, k, `ZH/EN 值完全相同（专有名词或漏翻？）→ "${zh[k]}"`);
      }
    }
  }

  // ⑦ 标准动作词一致性检查
  for (const [k, expected] of Object.entries(STD_ZH)) {
    if (zh[k] && !expected.includes(zh[k])) {
      add(W, k, `ZH 值 "${zh[k]}" ≠ 标准值 [${expected.join(' / ')}]`);
    }
  }
  for (const [k, expected] of Object.entries(STD_EN)) {
    if (en[k]) {
      const match = expected.some(e => e.toLowerCase() === en[k].toLowerCase());
      if (!match) add(W, k, `EN 值 "${en[k]}" ≠ 标准值 [${expected.join(' / ')}]`);
    }
  }

  // ⑧ 值过长（疑似把长描述文本放进了简短标签 key）
  const LONG_LABEL_KEYS = /^(?!.*(?:desc|summary|tip|notice|hint|detail|content|message|body|policy|notice|about))/;
  for (const [k, v] of Object.entries(zh)) {
    if (v === '__FUNCTION__') continue;
    if (v.length > 60 && LONG_LABEL_KEYS.test(k)) {
      add(I, k, `ZH 值较长 (${v.length} 字符)，是否误将描述文本放入标签 key？→ "${v.slice(0, 40)}..."`);
    }
  }

  // ⑨ 重复值（不同 key 值完全相同，可能 copy-paste 错误）
  // 只报重复的中文值，且只报 key 名语义明显不同的情况
  const zhValToKeys = {};
  for (const [k, v] of Object.entries(zh)) {
    if (v === '__FUNCTION__' || !HAS_CJK.test(v) || v.length < 2) continue;
    if (!zhValToKeys[v]) zhValToKeys[v] = [];
    zhValToKeys[v].push(k);
  }
  for (const [v, keys] of Object.entries(zhValToKeys)) {
    if (keys.length >= 3) {
      // 3 个以上 key 共用同一个值——很可能是 copy-paste 遗漏
      add(I, keys.join('/'), `${keys.length} 个 key 共用同一 ZH 值 "${v}"（可能 copy-paste 后漏改？）`);
    }
  }

  return issues;
}

// ─── 主流程 ───────────────────────────────────────────────────────────────
const appDirs = fs.readdirSync(APPS_DIR)
  .filter(n => fs.statSync(path.join(APPS_DIR, n)).isDirectory())
  .filter(n => filterApp ? n.toLowerCase() === filterApp.toLowerCase() : true)
  .sort();

const results = [];
let totalE = 0, totalW = 0, totalI = 0, appsWithIssues = 0;

for (const appName of appDirs) {
  const resDir = path.join(APPS_DIR, appName, 'res');
  const zhPath = path.join(resDir, 'strings.ts');
  const enPath = path.join(resDir, 'strings.en.ts');
  if (!fs.existsSync(zhPath)) continue;

  const zh = parseStringsFile(zhPath);
  const en = parseStringsFile(enPath);
  const issues = collectIssues(appName, zh, en);

  const errs  = issues.filter(i => i.sev === E);
  const warns = issues.filter(i => i.sev === W);
  const infos = issues.filter(i => i.sev === I);

  totalE += errs.length;
  totalW += warns.length;
  totalI += infos.length;
  if (errs.length + warns.length > 0) appsWithIssues++;

  const zhCount = zh ? Object.values(zh).filter(v => v !== '__FUNCTION__').length : 0;
  const enCount = en ? Object.keys(en).length : 0;

  results.push({ appName, zhCount, enCount, issues, errs, warns, infos });
}

// ─── 输出 ─────────────────────────────────────────────────────────────────
const LINE = '─'.repeat(64);
const DLINE = '═'.repeat(64);

for (const { appName, zhCount, enCount, issues, errs, warns, infos } of results) {
  const showIssues = verbose ? issues : [...errs, ...warns];
  if (showIssues.length === 0 && !verbose) continue;

  console.log(`\n${LINE}`);
  const badge = errs.length ? '❌' : warns.length ? '⚠️ ' : '✅';
  console.log(`${badge} ${appName}  (ZH ${zhCount} 键 / EN ${enCount} 键)`);

  for (const { sev, key, msg } of showIssues) {
    const k = key ? ` [${key}]` : '';
    console.log(`   ${sev}${k}  ${msg}`);
  }

  if (!verbose && infos.length > 0) {
    console.log(`   ${I} (${infos.length} 条 INFO 提示，用 --verbose 查看)`);
  }
}

// ─── 汇总 ─────────────────────────────────────────────────────────────────
console.log(`\n${DLINE}`);
console.log(`📊 汇总`);
console.log(`   检查 App 数：${results.length}`);
console.log(`   有问题 App ：${appsWithIssues}`);
console.log(`   ❌ Error  ：${totalE}`);
console.log(`   ⚠️  Warn   ：${totalW}`);
console.log(`   ℹ️  Info   ：${totalI}（用 --verbose 查看）`);
console.log(DLINE);

if (totalE > 0) process.exit(1);
