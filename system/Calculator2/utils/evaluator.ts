/**
 * 安全表达式求值器 — 递归下降解析器
 * 替代 eval()，支持完整的数学运算
 *
 * 支持: +, -, *, /, ^, !, sin, cos, tan, ln, log, sqrt, π, e, 括号
 * 精度: 12 位有效数字 + 5 位保护位 (与 AOSP MAX_DIGITS=12, ROUNDING_DIGITS=5 一致)
 */

import { normalize } from './tokenizer';
import { EVAL_CONFIG } from '../constants';
import { strings } from '../res/strings';

export type EvalResult =
  | { kind: 'success'; value: string }
  | { kind: 'error'; message: string }
  | { kind: 'empty' };

/**
 * 求值入口
 */
export function evaluate(formula: string): EvalResult {
  const expr = normalize(formula).trim();
  if (!expr) return { kind: 'empty' };

  try {
    const parser = new Parser(expr);
    const result = parser.parseExpression();
    if (parser.pos < parser.input.length) {
      return { kind: 'error', message: strings.error_syntax };
    }
    if (!isFinite(result)) {
      return { kind: 'error', message: result !== result ? strings.error_nan : strings.error_divide_by_zero };
    }
    return { kind: 'success', value: formatResult(result) };
  } catch {
    return { kind: 'error', message: strings.error_syntax };
  }
}

/** 格式化结果：12 位有效数字 */
function formatResult(n: number): string {
  if (n === 0) return '0';

  const maxDigits = EVAL_CONFIG.maxDigits;

  // 用 toPrecision 限制有效数字
  let s = Number(n.toPrecision(maxDigits)).toString();

  // 去掉末尾多余的零
  if (s.includes('.')) {
    s = s.replace(/\.?0+$/, '');
  }

  return s;
}

// ==================== 递归下降解析器 ====================

class Parser {
  input: string;
  pos: number;

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
  }

  peek(): string {
    this.skipSpaces();
    return this.input[this.pos] || '';
  }

  consume(expected?: string): string {
    this.skipSpaces();
    const ch = this.input[this.pos];
    if (expected && ch !== expected) {
      throw new Error(`Expected '${expected}' at pos ${this.pos}`);
    }
    this.pos++;
    return ch;
  }

  skipSpaces() {
    while (this.pos < this.input.length && this.input[this.pos] === ' ') {
      this.pos++;
    }
  }

  // expression = term (('+' | '-') term)*
  parseExpression(): number {
    let result = this.parseTerm();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.consume();
      const right = this.parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  // term = power (('*' | '/') power)*
  parseTerm(): number {
    let result = this.parsePower();
    while (this.peek() === '*' || this.peek() === '/') {
      const op = this.consume();
      const right = this.parsePower();
      result = op === '*' ? result * right : result / right;
    }
    return result;
  }

  // power = unary ('^' power)?  (右结合)
  parsePower(): number {
    const base = this.parseUnary();
    if (this.peek() === '^') {
      this.consume();
      const exp = this.parsePower(); // 右结合
      return Math.pow(base, exp);
    }
    return base;
  }

  // unary = '-' unary | postfix
  parseUnary(): number {
    if (this.peek() === '-') {
      this.consume();
      return -this.parseUnary();
    }
    return this.parsePostfix();
  }

  // postfix = primary ('!')*
  parsePostfix(): number {
    let result = this.parsePrimary();
    while (this.peek() === '!') {
      this.consume();
      result = factorial(result);
    }
    return result;
  }

  // primary = number | '(' expression ')' | function '(' expression ')' | constant
  parsePrimary(): number {
    const ch = this.peek();

    // 括号
    if (ch === '(') {
      this.consume('(');
      const result = this.parseExpression();
      if (this.peek() === ')') this.consume(')');
      return result;
    }

    // 函数
    const funcNames = ['sin', 'cos', 'tan', 'ln', 'log', 'sqrt'];
    for (const fn of funcNames) {
      if (this.input.substring(this.pos).startsWith(fn)) {
        this.pos += fn.length;
        // 期望 '('
        if (this.peek() === '(') {
          this.consume('(');
          const arg = this.parseExpression();
          if (this.peek() === ')') this.consume(')');
          return applyFunction(fn, arg);
        }
        // 没有括号也尝试解析
        const arg = this.parsePrimary();
        return applyFunction(fn, arg);
      }
    }

    // 常量 π
    if (this.input.substring(this.pos).startsWith('π')) {
      this.pos += 1;
      return Math.PI;
    }

    // 常量 e (注意不要匹配到科学记数法的 e)
    if (ch === 'e' && !isDigitAt(this.input, this.pos - 1)) {
      const nextCh = this.input[this.pos + 1];
      // 如果 e 后面不是数字也不是 +/-（科学记数法），视为常量
      if (nextCh === undefined || (nextCh !== '+' && nextCh !== '-' && !(nextCh >= '0' && nextCh <= '9'))) {
        this.pos++;
        return Math.E;
      }
    }

    // 数字
    return this.parseNumber();
  }

  parseNumber(): number {
    this.skipSpaces();
    const start = this.pos;

    // 整数部分
    while (this.pos < this.input.length && this.input[this.pos] >= '0' && this.input[this.pos] <= '9') {
      this.pos++;
    }

    // 小数部分
    if (this.pos < this.input.length && this.input[this.pos] === '.') {
      this.pos++;
      while (this.pos < this.input.length && this.input[this.pos] >= '0' && this.input[this.pos] <= '9') {
        this.pos++;
      }
    }

    // 科学记数法
    if (this.pos < this.input.length && (this.input[this.pos] === 'e' || this.input[this.pos] === 'E')) {
      this.pos++;
      if (this.pos < this.input.length && (this.input[this.pos] === '+' || this.input[this.pos] === '-')) {
        this.pos++;
      }
      while (this.pos < this.input.length && this.input[this.pos] >= '0' && this.input[this.pos] <= '9') {
        this.pos++;
      }
    }

    if (this.pos === start) {
      throw new Error(`Unexpected character at pos ${this.pos}: '${this.input[this.pos]}'`);
    }

    return parseFloat(this.input.substring(start, this.pos));
  }
}

function isDigitAt(s: string, pos: number): boolean {
  if (pos < 0 || pos >= s.length) return false;
  return s[pos] >= '0' && s[pos] <= '9';
}

function applyFunction(name: string, arg: number): number {
  switch (name) {
    case 'sin': return Math.sin(arg * Math.PI / 180); // AOSP 用度数
    case 'cos': return Math.cos(arg * Math.PI / 180);
    case 'tan': return Math.tan(arg * Math.PI / 180);
    case 'ln': return Math.log(arg);
    case 'log': return Math.log10(arg);
    case 'sqrt': return Math.sqrt(arg);
    default: throw new Error(`Unknown function: ${name}`);
  }
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}
