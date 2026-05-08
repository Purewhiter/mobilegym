/**
 * WMR expression tokenizer, parser, and evaluator.
 *
 * WMR uses non-standard operators:
 *   }  → >     {  → <     }= → >=    {= → <=    ** → &&
 *
 * Variable references:
 *   #var        numeric variable
 *   @var        string variable
 *   @arr[expr]  array access
 *   #el.prop    element property (text_width, bmp_width, etc.)
 *
 * Functions: ifelse, int, max, min, abs, sin, cos, rand, eq, not,
 *            strContains, strIsEmpty, strlen, formatDate, eval
 */
import type { ExprNode, BinaryOp, UnaryOp, WmrVarContext } from './types';
import * as TimeService from '../../TimeService';
import localeApi from '../../locale';

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

const enum Tk {
  Num, Str, Ident,
  Hash, At, Dot, Comma, LParen, RParen, LBrack, RBrack,
  Plus, Minus, Star, Slash, Percent,
  Eq, Neq, Gt, Lt, Gte, Lte,
  And, Or, Not,
  Eof,
}

interface Token { type: Tk; value: string; pos: number; }

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const normalized = src
    .replace(/\$\$/g, '@')
    .replace(/\$(?=[A-Za-z_])/g, '@');
  const len = normalized.length;

  while (i < len) {
    const ch = normalized[i];

    // whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }

    // string literal (single-quoted, with &apos; entities already decoded)
    if (ch === "'") {
      let s = '';
      i++;
      while (i < len && normalized[i] !== "'") { s += normalized[i]; i++; }
      i++; // skip closing quote
      tokens.push({ type: Tk.Str, value: s, pos: i });
      continue;
    }

    // number
    if ((ch >= '0' && ch <= '9') || (ch === '.' && i + 1 < len && normalized[i + 1] >= '0' && normalized[i + 1] <= '9')) {
      let n = '';
      while (i < len && ((normalized[i] >= '0' && normalized[i] <= '9') || normalized[i] === '.')) { n += normalized[i]; i++; }
      tokens.push({ type: Tk.Num, value: n, pos: i });
      continue;
    }

    // identifiers (function names, plain references after # or @)
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let id = '';
      while (i < len && ((normalized[i] >= 'a' && normalized[i] <= 'z') || (normalized[i] >= 'A' && normalized[i] <= 'Z') || (normalized[i] >= '0' && normalized[i] <= '9') || normalized[i] === '_')) {
        id += normalized[i]; i++;
      }
      tokens.push({ type: Tk.Ident, value: id, pos: i });
      continue;
    }

    // two-char operators
    if (i + 1 < len) {
      const two = normalized[i] + normalized[i + 1];
      if (two === '}=') { tokens.push({ type: Tk.Gte, value: '>=', pos: i }); i += 2; continue; }
      if (two === '{=') { tokens.push({ type: Tk.Lte, value: '<=', pos: i }); i += 2; continue; }
      if (two === '**') { tokens.push({ type: Tk.And, value: '&&', pos: i }); i += 2; continue; }
      if (two === '||') { tokens.push({ type: Tk.Or, value: '||', pos: i }); i += 2; continue; }
      if (two === '==') { tokens.push({ type: Tk.Eq, value: '==', pos: i }); i += 2; continue; }
      if (two === '!=') { tokens.push({ type: Tk.Neq, value: '!=', pos: i }); i += 2; continue; }
      if (two === '>=') { tokens.push({ type: Tk.Gte, value: '>=', pos: i }); i += 2; continue; }
      if (two === '<=') { tokens.push({ type: Tk.Lte, value: '<=', pos: i }); i += 2; continue; }
      if (two === '&&') { tokens.push({ type: Tk.And, value: '&&', pos: i }); i += 2; continue; }
    }

    // single-char
    switch (ch) {
      case '#': tokens.push({ type: Tk.Hash, value: '#', pos: i }); i++; continue;
      case '@': tokens.push({ type: Tk.At, value: '@', pos: i }); i++; continue;
      case '.': tokens.push({ type: Tk.Dot, value: '.', pos: i }); i++; continue;
      case ',': tokens.push({ type: Tk.Comma, value: ',', pos: i }); i++; continue;
      case '(': tokens.push({ type: Tk.LParen, value: '(', pos: i }); i++; continue;
      case ')': tokens.push({ type: Tk.RParen, value: ')', pos: i }); i++; continue;
      case '[': tokens.push({ type: Tk.LBrack, value: '[', pos: i }); i++; continue;
      case ']': tokens.push({ type: Tk.RBrack, value: ']', pos: i }); i++; continue;
      case '+': tokens.push({ type: Tk.Plus, value: '+', pos: i }); i++; continue;
      case '-': tokens.push({ type: Tk.Minus, value: '-', pos: i }); i++; continue;
      case '*': tokens.push({ type: Tk.Star, value: '*', pos: i }); i++; continue;
      case '/': tokens.push({ type: Tk.Slash, value: '/', pos: i }); i++; continue;
      case '%': tokens.push({ type: Tk.Percent, value: '%', pos: i }); i++; continue;
      case '}': tokens.push({ type: Tk.Gt, value: '>', pos: i }); i++; continue;
      case '{': tokens.push({ type: Tk.Lt, value: '<', pos: i }); i++; continue;
      case '>': tokens.push({ type: Tk.Gt, value: '>', pos: i }); i++; continue;
      case '<': tokens.push({ type: Tk.Lt, value: '<', pos: i }); i++; continue;
      case '!': tokens.push({ type: Tk.Not, value: '!', pos: i }); i++; continue;
      default:
        i++; // skip unknown
    }
  }

  tokens.push({ type: Tk.Eof, value: '', pos: i });
  return tokens;
}

// ---------------------------------------------------------------------------
// Recursive descent parser  (tokens → ExprNode AST)
// ---------------------------------------------------------------------------

class ExprParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) { this.tokens = tokens; }

  private peek(): Token { return this.tokens[this.pos]; }
  private advance(): Token { return this.tokens[this.pos++]; }
  private expect(type: Tk): Token {
    const t = this.advance();
    if (t.type !== type) throw new Error(`WMR expr: expected ${type}, got ${t.type} at ${t.pos}`);
    return t;
  }

  private parseDottedIdent(): string {
    let name = this.expect(Tk.Ident).value;
    while (this.peek().type === Tk.Dot) {
      const next = this.tokens[this.pos + 1];
      if (!next || next.type !== Tk.Ident) break;
      this.advance();
      name += '.' + this.advance().value;
    }
    return name;
  }

  parse(): ExprNode {
    const node = this.parseOr();
    return node;
  }

  private parseOr(): ExprNode {
    let left = this.parseAnd();
    while (this.peek().type === Tk.Or) {
      this.advance();
      left = { kind: 'binary', op: '||', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): ExprNode {
    let left = this.parseEquality();
    while (this.peek().type === Tk.And) {
      this.advance();
      left = { kind: 'binary', op: '&&', left, right: this.parseEquality() };
    }
    return left;
  }

  private parseEquality(): ExprNode {
    let left = this.parseComparison();
    while (this.peek().type === Tk.Eq || this.peek().type === Tk.Neq) {
      const op: BinaryOp = this.advance().type === Tk.Eq ? '==' : '!=';
      left = { kind: 'binary', op, left, right: this.parseComparison() };
    }
    return left;
  }

  private parseComparison(): ExprNode {
    let left = this.parseAddSub();
    while (this.peek().type === Tk.Gt || this.peek().type === Tk.Lt ||
           this.peek().type === Tk.Gte || this.peek().type === Tk.Lte) {
      const t = this.advance();
      const op: BinaryOp = t.type === Tk.Gt ? '>' : t.type === Tk.Lt ? '<' : t.type === Tk.Gte ? '>=' : '<=';
      left = { kind: 'binary', op, left, right: this.parseAddSub() };
    }
    return left;
  }

  private parseAddSub(): ExprNode {
    let left = this.parseMulDiv();
    while (this.peek().type === Tk.Plus || this.peek().type === Tk.Minus) {
      const op: BinaryOp = this.advance().type === Tk.Plus ? '+' : '-';
      left = { kind: 'binary', op, left, right: this.parseMulDiv() };
    }
    return left;
  }

  private parseMulDiv(): ExprNode {
    let left = this.parseUnary();
    while (this.peek().type === Tk.Star || this.peek().type === Tk.Slash || this.peek().type === Tk.Percent) {
      const t = this.advance();
      const op: BinaryOp = t.type === Tk.Star ? '*' : t.type === Tk.Slash ? '/' : '%';
      left = { kind: 'binary', op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): ExprNode {
    if (this.peek().type === Tk.Minus) {
      this.advance();
      return { kind: 'unary', op: '-' as UnaryOp, operand: this.parseUnary() };
    }
    if (this.peek().type === Tk.Not) {
      this.advance();
      return { kind: 'unary', op: '!' as UnaryOp, operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExprNode {
    const t = this.peek();

    // Number literal
    if (t.type === Tk.Num) {
      this.advance();
      return { kind: 'number', value: parseFloat(t.value) };
    }

    // String literal
    if (t.type === Tk.Str) {
      this.advance();
      return { kind: 'string', value: t.value };
    }

    // Numeric variable: #name  or  #name.prop
    if (t.type === Tk.Hash) {
      this.advance();
      const name = this.parseDottedIdent();
      if (this.peek().type === Tk.LBrack) {
        this.advance();
        const idx = this.parse();
        this.expect(Tk.RBrack);
        return { kind: 'arrayAccess', name, index: idx };
      }
      const lastDot = name.lastIndexOf('.');
      if (lastDot > 0) {
        const prop = name.slice(lastDot + 1);
        if (prop === 'text_width' || prop === 'bmp_width' || prop === 'bmp_height' || prop === 'text_height') {
          return { kind: 'propAccess', element: name.slice(0, lastDot), prop };
        }
      }
      return { kind: 'numVar', name };
    }

    // String variable: @name  or  @name[expr]
    if (t.type === Tk.At) {
      this.advance();
      const name = this.parseDottedIdent();
      if (this.peek().type === Tk.LBrack) {
        this.advance(); // skip [
        const idx = this.parse();
        this.expect(Tk.RBrack);
        return { kind: 'arrayAccess', name, index: idx };
      }
      return { kind: 'strVar', name };
    }

    // Function call or bare identifier
    if (t.type === Tk.Ident) {
      this.advance();
      if (this.peek().type === Tk.LParen) {
        this.advance(); // skip (
        const args: ExprNode[] = [];
        if (this.peek().type !== Tk.RParen) {
          args.push(this.parse());
          while (this.peek().type === Tk.Comma) {
            this.advance();
            args.push(this.parse());
          }
        }
        this.expect(Tk.RParen);
        return { kind: 'call', fn: t.value, args };
      }
      // bare identifier treated as numeric variable (some XMLs omit the # prefix)
      return { kind: 'numVar', name: t.value };
    }

    // Parenthesized expression
    if (t.type === Tk.LParen) {
      this.advance();
      const inner = this.parse();
      this.expect(Tk.RParen);
      return inner;
    }

    // Fallback: return 0
    this.advance();
    return { kind: 'number', value: 0 };
  }
}

// ---------------------------------------------------------------------------
// Compile (parse text → ExprNode with caching)
// ---------------------------------------------------------------------------

const exprCache = new Map<string, ExprNode>();

export function compileExpr(src: string): ExprNode {
  if (!src) return { kind: 'number', value: 0 };
  let node = exprCache.get(src);
  if (node) return node;
  try {
    const tokens = tokenize(src);
    node = new ExprParser(tokens).parse();
  } catch {
    node = { kind: 'number', value: 0 };
  }
  exprCache.set(src, node);
  return node;
}

// ---------------------------------------------------------------------------
// Evaluate
// ---------------------------------------------------------------------------

export function evalExpr(node: ExprNode, ctx: WmrVarContext): any {
  switch (node.kind) {
    case 'number': return node.value;
    case 'string': return node.value;
    case 'numVar': return ctx.getNum(node.name);
    case 'strVar': return ctx.getStr(node.name);
    case 'arrayAccess': {
      const arr = ctx.getArray(node.name);
      const idx = Math.floor(toNum(evalExpr(node.index, ctx)));
      return arr[idx] ?? '';
    }
    case 'propAccess':
      return ctx.getElementProp(node.element, node.prop);

    case 'unary': {
      const v = evalExpr(node.operand, ctx);
      if (node.op === '-') return -toNum(v);
      if (node.op === '!') return toNum(v) === 0 ? 1 : 0;
      return 0;
    }

    case 'binary': {
      // short-circuit for && and ||
      if (node.op === '&&') {
        const l = toNum(evalExpr(node.left, ctx));
        if (!l) return 0;
        return toNum(evalExpr(node.right, ctx)) ? 1 : 0;
      }
      if (node.op === '||') {
        const l = toNum(evalExpr(node.left, ctx));
        if (l) return 1;
        return toNum(evalExpr(node.right, ctx)) ? 1 : 0;
      }
      const left = evalExpr(node.left, ctx);
      const right = evalExpr(node.right, ctx);
      // string concatenation
      if (node.op === '+' && (typeof left === 'string' || typeof right === 'string')) {
        return String(left) + String(right);
      }
      const ln = toNum(left);
      const rn = toNum(right);
      switch (node.op) {
        case '+': return ln + rn;
        case '-': return ln - rn;
        case '*': return ln * rn;
        case '/': return rn === 0 ? 0 : ln / rn;
        case '%': return rn === 0 ? 0 : ln % rn;
        case '==': return left == right ? 1 : 0; // intentional loose equality for string/number
        case '!=': return left != right ? 1 : 0;
        case '>': return ln > rn ? 1 : 0;
        case '<': return ln < rn ? 1 : 0;
        case '>=': return ln >= rn ? 1 : 0;
        case '<=': return ln <= rn ? 1 : 0;
      }
      return 0;
    }

    case 'call':
      return evalCall(node.fn, node.args, ctx);
  }
}

function evalCall(fn: string, args: ExprNode[], ctx: WmrVarContext): unknown {
  switch (fn) {
    case 'ifelse': {
      // ifelse(c1,v1[,c2,v2,...][,else])
      for (let i = 0; i + 1 < args.length; i += 2) {
        const cond = toNum(evalExpr(args[i], ctx));
        if (cond) return evalExpr(args[i + 1], ctx);
      }
      if (args.length % 2 === 1) return evalExpr(args[args.length - 1], ctx);
      return 0;
    }
    case 'int': return Math.floor(toNum(evalExpr(args[0], ctx)));
    case 'ceil': return Math.ceil(toNum(evalExpr(args[0], ctx)));
    case 'max': return Math.max(...args.map(a => toNum(evalExpr(a, ctx))));
    case 'min': return Math.min(...args.map(a => toNum(evalExpr(a, ctx))));
    case 'abs': return Math.abs(toNum(evalExpr(args[0], ctx)));
    case 'sin': return Math.sin(toNum(evalExpr(args[0], ctx)));
    case 'cos': return Math.cos(toNum(evalExpr(args[0], ctx)));
    case 'rand': return Math.random();
    case 'eq': {
      const a = evalExpr(args[0], ctx);
      const b = evalExpr(args[1], ctx);
      return a == b ? 1 : 0;
    }
    case 'eqs': return String(evalExpr(args[0], ctx)) === String(evalExpr(args[1], ctx)) ? 1 : 0;
    case 'ne': return evalExpr(args[0], ctx) != evalExpr(args[1], ctx) ? 1 : 0;
    case 'not': return toNum(evalExpr(args[0], ctx)) === 0 ? 1 : 0;
    case 'num': return toNum(evalExpr(args[0], ctx));
    case 'round': return Math.round(toNum(evalExpr(args[0], ctx)));
    case 'strContains': {
      const haystack = String(evalExpr(args[0], ctx));
      const needle = String(evalExpr(args[1], ctx));
      return haystack.includes(needle) ? 1 : 0;
    }
    case 'strIsEmpty': {
      const s = String(evalExpr(args[0], ctx));
      return s === '' ? 1 : 0;
    }
    case 'strlen': return String(evalExpr(args[0], ctx)).length;
    case 'ge': return toNum(evalExpr(args[0], ctx)) >= toNum(evalExpr(args[1], ctx)) ? 1 : 0;
    case 'le': return toNum(evalExpr(args[0], ctx)) <= toNum(evalExpr(args[1], ctx)) ? 1 : 0;
    case 'gt': return toNum(evalExpr(args[0], ctx)) > toNum(evalExpr(args[1], ctx)) ? 1 : 0;
    case 'lt': return toNum(evalExpr(args[0], ctx)) < toNum(evalExpr(args[1], ctx)) ? 1 : 0;
    case 'isnull': {
      const v = evalExpr(args[0], ctx);
      return (v === '' || v === 0) ? 1 : 0;
    }
    case 'strReplaceAll': {
      const s = String(evalExpr(args[0], ctx));
      const from = String(evalExpr(args[1], ctx));
      const to = String(evalExpr(args[2], ctx));
      return s.split(from).join(to);
    }
    case 'strReplaceFirst': {
      const s = String(evalExpr(args[0], ctx));
      const from = String(evalExpr(args[1], ctx));
      const to = String(evalExpr(args[2], ctx));
      const idx = s.indexOf(from);
      return idx < 0 ? s : `${s.slice(0, idx)}${to}${s.slice(idx + from.length)}`;
    }
    case 'substr': {
      const s = String(evalExpr(args[0], ctx));
      const start = Math.floor(toNum(evalExpr(args[1], ctx)));
      const length = args.length > 2 ? Math.floor(toNum(evalExpr(args[2], ctx))) : undefined;
      return length === undefined
        ? s.slice(start)
        : s.slice(start, start + Math.max(0, length));
    }
    case 'strIndexOf': {
      const s = String(evalExpr(args[0], ctx));
      const search = String(evalExpr(args[1], ctx));
      return s.indexOf(search);
    }
    case 'len': {
      const value = evalExpr(args[0], ctx);
      if (Array.isArray(value)) return value.length;
      if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length;
      return String(value).length;
    }
    case 'preciseeval': {
      const exprStr = String(evalExpr(args[0], ctx));
      const digits = args.length > 1 ? Math.max(0, Math.floor(toNum(evalExpr(args[1], ctx)))) : 0;
      let result: number;
      try {
        result = toNum(evalExpr(compileExpr(exprStr), ctx));
      } catch {
        result = 0;
      }
      return parseFloat(result.toFixed(digits));
    }
    case 'eval': {
      const exprStr = String(evalExpr(args[0], ctx));
      try {
        return evalExpr(compileExpr(exprStr), ctx);
      } catch {
        return 0;
      }
    }
    case 'formatDate': {
      const fmt = String(evalExpr(args[0], ctx));
      const ms = toNum(evalExpr(args[1], ctx));
      const d = TimeService.fromTimestamp(ms);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dow = d.getDay();
      const h24 = d.getHours();
      const h12 = h24 % 12 || 12;
      const m = d.getMinutes();
      const s = d.getSeconds();
      const weekFull = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const weekShort = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      if (localeApi.getLocale() === 'en') {
        weekFull.splice(0, weekFull.length, 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday');
        weekShort.splice(0, weekShort.length, 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat');
      }
      return fmt
        .replace(/yyyy/g, String(year))
        .replace(/yy/g, String(year % 100).padStart(2, '0'))
        .replace(/EEEE/g, weekFull[dow])
        .replace(/EEE/g, weekShort[dow])
        .replace(/EE/g, weekShort[dow])
        .replace(/E(?!E)/g, weekShort[dow])
        .replace(/MM/g, String(month).padStart(2, '0'))
        .replace(/M(?!M)/g, String(month))
        .replace(/dd/g, String(day).padStart(2, '0'))
        .replace(/d(?!d)/g, String(day))
        .replace(/HH/g, String(h24).padStart(2, '0'))
        .replace(/H(?!H)/g, String(h24))
        .replace(/hh/g, String(h12).padStart(2, '0'))
        .replace(/h(?!h)/g, String(h12))
        .replace(/mm/g, String(m).padStart(2, '0'))
        .replace(/m(?!m)/g, String(m))
        .replace(/ss/g, String(s).padStart(2, '0'))
        .replace(/s(?!s)/g, String(s));
    }
    case 'rgb': {
      const r = clampColorChannel(toNum(evalExpr(args[0], ctx)));
      const g = clampColorChannel(toNum(evalExpr(args[1], ctx)));
      const b = clampColorChannel(toNum(evalExpr(args[2], ctx)));
      return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
    }
    case 'argb': {
      const a = clampColorChannel(toNum(evalExpr(args[0], ctx)));
      const r = clampColorChannel(toNum(evalExpr(args[1], ctx)));
      const g = clampColorChannel(toNum(evalExpr(args[2], ctx)));
      const b = clampColorChannel(toNum(evalExpr(args[3], ctx)));
      return `#${toHex2(a)}${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
    }
    case 'strToJson': {
      const raw = toStr(evalExpr(args[0], ctx));
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    case 'jsonGetBoolean': {
      const source = evalExpr(args[0], ctx);
      const key = toStr(evalExpr(args[1], ctx));
      const value = getJsonMember(source, key);
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'string') return value === 'true' ? 1 : 0;
      return toNum(value) !== 0 ? 1 : 0;
    }
    case 'jsonGetString': {
      const source = evalExpr(args[0], ctx);
      const key = toStr(evalExpr(args[1], ctx));
      const value = getJsonMember(source, key);
      return value == null ? '' : toStr(value);
    }
    case 'jsonGetArray': {
      const source = evalExpr(args[0], ctx);
      const key = toStr(evalExpr(args[1], ctx));
      const value = getJsonMember(source, key);
      return Array.isArray(value) ? value : [];
    }
    case 'jsonGetObject': {
      const source = evalExpr(args[0], ctx);
      const key = toStr(evalExpr(args[1], ctx));
      const value = getJsonMember(source, key);
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    case 'jsonArrayGetIndex': {
      const value = evalExpr(args[0], ctx);
      const index = Math.max(0, Math.floor(toNum(evalExpr(args[1], ctx))));
      return Array.isArray(value) ? (value[index] ?? '') : '';
    }
    case 'jsonGetNumber': {
      const source = evalExpr(args[0], ctx);
      const key = toStr(evalExpr(args[1], ctx));
      return toNum(getJsonMember(source, key));
    }
    case 'jsonGetInt': {
      const source = evalExpr(args[0], ctx);
      const key = toStr(evalExpr(args[1], ctx));
      return Math.floor(toNum(getJsonMember(source, key)));
    }
    case 'getJsonArrayLength': {
      const value = evalExpr(args[0], ctx);
      return Array.isArray(value) ? value.length : 0;
    }
    case 'newJsonObject':
    case 'JsonObject':
      return {};
    case 'newJsonArray':
      return [];
    case 'get':
      return args.length > 1 ? evalExpr(args[1], ctx) : 0;
    case 'formatFloat': {
      const first = args.length > 0 ? evalExpr(args[0], ctx) : 0;
      const firstStr = toStr(first);
      const specMatch = firstStr.match(/%[-+0-9# ]*(?:\.(\d+))?f/);
      if (specMatch && args.length > 1) {
        const value = toNum(evalExpr(args[1], ctx));
        const digits = specMatch[1] != null ? Math.max(0, parseInt(specMatch[1], 10) || 0) : 6;
        const formatted = value.toFixed(digits);
        return firstStr.replace(specMatch[0], formatted);
      }

      const value = toNum(first);
      const digits = args.length > 1 ? Math.max(0, Math.floor(toNum(evalExpr(args[1], ctx)))) : 0;
      return value.toFixed(digits);
    }
    default: return 0;
  }
}

function getJsonMember(source: unknown, key: string): unknown {
  if (!source || typeof source !== 'object') return undefined;
  return (source as Record<string, unknown>)[key];
}

function clampColorChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function toHex2(value: number): string {
  return value.toString(16).padStart(2, '0');
}

export function toNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

export function toStr(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v == null) return '';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return '';
    }
  }
  return String(v);
}

/** Convenience: compile + eval in one call. */
export function evalExprStr(src: string | undefined, ctx: WmrVarContext): any {
  if (!src) return 0;
  return evalExpr(compileExpr(src), ctx);
}

export function evalNum(src: string | undefined, ctx: WmrVarContext): number {
  return toNum(evalExprStr(src, ctx));
}

export function evalStr(src: string | undefined, ctx: WmrVarContext): string {
  return toStr(evalExprStr(src, ctx));
}
