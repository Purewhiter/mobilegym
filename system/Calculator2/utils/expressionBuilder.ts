/**
 * 表达式构建器 — 输入校验规则
 * 1:1 翻译自 CalculatorExpressionBuilder.java
 *
 * 所有输入都在 normalized (ASCII) 空间处理
 */

import { normalize, localize, isDigit } from './tokenizer';

export type CalcState = 'INPUT' | 'EVALUATE' | 'RESULT' | 'ERROR';

/**
 * 在表达式末尾追加一个字符（或函数名），返回新的 normalized 表达式
 *
 * @param formula 当前显示表达式
 * @param token 要追加的 ASCII 字符 (e.g. '1', '+', '-', '*', '/', '.')
 * @param state 当前计算器状态
 * @param isEdited 是否已编辑过（用于 RESULT/ERROR 首次编辑替换）
 * @returns [newFormula (localized), newIsEdited]
 */
export function appendToken(
  formula: string,
  token: string,
  state: CalcState,
  isEdited: boolean,
): [string, boolean] {
  const norm = normalize(formula);
  const start = norm.length;
  let editStart = start;
  let edited = isEdited;

  // RESULT/ERROR 状态下首次编辑替换全文
  if ((state === 'RESULT' || state === 'ERROR') && !edited) {
    editStart = 0;
    edited = true;
  }

  if (token === '.') {
    // 查找当前数字段中是否已有小数点
    const lastDotIdx = norm.lastIndexOf('.');
    if (lastDotIdx >= 0) {
      // 检查 lastDotIdx 之后是否全是数字（同一数字段）
      const afterDot = norm.substring(lastDotIdx + 1, start);
      const allDigits = [...afterDot].every(ch => isDigit(ch));
      if (allDigits) {
        return [formula, edited]; // 阻止重复小数点
      }
    }
  } else if (token === '+' || token === '*' || token === '/') {
    if (start === 0 && editStart === 0) {
      return [formula, edited]; // 不允许前导运算符
    }
    // 运算符总是续算：去掉尾部已有的运算符序列后追加新运算符
    // RESULT 状态下也保留公式（链式计算: 5 → 5×），不像数字那样替换
    let trimEnd = start;
    while (trimEnd > 0 && '+-*/'.includes(norm[trimEnd - 1])) {
      trimEnd--;
    }
    if (trimEnd === 0) {
      return [formula, edited]; // 全是运算符，不追加
    }
    const base = norm.substring(0, trimEnd);
    return [localize(base + token), true];
  }

  if (token === '-') {
    // 减号允许作为负号使用，也允许续算
    const checkStart = start; // 总是检查末尾字符（包括 RESULT 状态）
    if (checkStart > 0 && '+-'.includes(norm[checkStart - 1])) {
      // 替换前一个 +/- 为 -
      const base = norm.substring(0, checkStart - 1);
      return [localize(base + '-'), true];
    }
  }

  // 默认追加
  if (editStart === 0 && !edited) {
    // 替换整个表达式
    return [localize(token), true];
  }
  return [localize(norm + token), true];
}

/**
 * 追加函数名（自动补左括号）
 * AOSP: fun_sin onClick → append "sin("
 */
export function appendFunction(
  formula: string,
  funcName: string,
  state: CalcState,
  isEdited: boolean,
): [string, boolean] {
  const norm = normalize(formula);
  let edited = isEdited;

  if ((state === 'RESULT' || state === 'ERROR') && !edited) {
    return [localize(funcName + '('), true];
  }

  return [localize(norm + funcName + '('), true];
}

/**
 * 删除末尾一个字符
 */
export function deleteLastChar(formula: string): string {
  const norm = normalize(formula);
  if (norm.length === 0) return '';

  // 检查是否以函数名 + ( 结尾（如 "sin("）
  const funcs = ['sin(', 'cos(', 'tan(', 'ln(', 'log('];
  for (const fn of funcs) {
    if (norm.endsWith(fn)) {
      return localize(norm.slice(0, -fn.length));
    }
  }

  // 检查是否以 √( 结尾
  if (norm.endsWith('sqrt(')) {
    return localize(norm.slice(0, -5));
  }

  return localize(norm.slice(0, -1));
}
