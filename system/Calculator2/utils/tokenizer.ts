/**
 * 表达式符号转换器 — 翻译自 CalculatorExpressionTokenizer.java
 *
 * ASCII (内部) ↔ 显示 (本地化) 符号映射
 */

const TOKEN_MAP: [string, string][] = [
  ['/', '÷'],
  ['*', '×'],
  ['-', '\u2212'],   // U+2212 MINUS SIGN
  ['Infinity', '∞'],
];

/** 将显示字符串转换为 ASCII 内部表示 */
export function normalize(expr: string): string {
  let result = expr;
  for (const [ascii, display] of TOKEN_MAP) {
    result = result.replaceAll(display, ascii);
  }
  return result;
}

/** 将 ASCII 内部表示转换为显示字符串 */
export function localize(expr: string): string {
  let result = expr;
  for (const [ascii, display] of TOKEN_MAP) {
    result = result.replaceAll(ascii, display);
  }
  return result;
}

/** 判断字符是否为数字 */
export function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}
