/**
 * WMR variable context.
 * Maintains built-in time/system variables and user-defined Var/VarArray.
 */
import type {
  WmrVarContext, WmrNode, WmrVar, WmrVarArray,
  WmrContentProviderBinder, VarValue, WmrBroadcastBinder, WmrCommand,
  WmrTrigger, WmrVariableAnimation, WmrFramerateController, WmrFunction,
  WmrFolmeState, WmrFolmeConfig, WmrVirtualElement, WmrPropertyAnimation,
  WmrBaseAttrs, ExprNode,
} from './types';
import { compileExpr, evalExpr, toNum, toStr } from './expression';
import localeApi from '../../locale';
import BroadcastBus from '../../BroadcastBus';
import * as TimeService from '../../TimeService';
import { applyBinderData } from './contentProviders';

// ---------------------------------------------------------------------------
// Built-in variable names
// ---------------------------------------------------------------------------

const LUNAR_HEAVENLY = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const LUNAR_EARTHLY  = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const LUNAR_ANIMALS  = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const LUNAR_MONTHS   = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
const LUNAR_DAYS_P   = ['初','初','初','初','初','初','初','初','初','初','十','十','十','十','十','十','十','十','十','二','廿','廿','廿','廿','廿','廿','廿','廿','廿','三'];
const LUNAR_DAYS_S   = ['','一','二','三','四','五','六','七','八','九','十','一','二','三','四','五','六','七','八','九','十','一','二','三','四','五','六','七','八','九','十'];

const CN_WEEK = ['日','一','二','三','四','五','六'];

type TimelineState = {
  fromTime: number;
  toTime: number;
  startedAt: number;
  duration: number;
  playing: boolean;
  currentTime: number;
  completed: boolean;
};

type RegisteredPropertyAnimation = {
  key: string;
  target: string;
  animation: WmrPropertyAnimation;
  state: TimelineState;
};

type RegisteredVarAnimation = {
  key: string;
  target: string;
  slot: string;
  index?: number;
  animation: WmrVariableAnimation;
  state: TimelineState;
};

type CompiledAnimationFrame = {
  relative?: boolean;
  time: ExprNode;
  value?: ExprNode;
  x?: ExprNode;
  y?: ExprNode;
  scaleX?: ExprNode;
  scaleY?: ExprNode;
  alpha?: ExprNode;
  rotation?: ExprNode;
  easeType?: string;
};

type EvaluatedAnimationFrame = {
  time: number;
  easeType?: string;
  value?: ExprNode;
  x?: ExprNode;
  y?: ExprNode;
  scaleX?: ExprNode;
  scaleY?: ExprNode;
  alpha?: ExprNode;
  rotation?: ExprNode;
};

type PreparedAnimationTimeline = {
  frames: CompiledAnimationFrame[];
  staticTimeline?: EvaluatedAnimationFrame[];
};

type FolmeProp = 'x' | 'y' | 'alpha' | 'scaleX' | 'scaleY' | 'rotation';

type FolmeTransitionProp = {
  prop: FolmeProp;
  from: number;
  to: number;
  duration: number;
  easing: (t: number) => number;
};

type RegisteredFolmeTransition = {
  target: string;
  startedAt: number;
  props: FolmeTransitionProp[];
  onComplete?: string;
};

function isStaticExprNode(node: ExprNode): boolean {
  switch (node.kind) {
    case 'number':
    case 'string':
      return true;
    case 'numVar':
    case 'strVar':
    case 'arrayAccess':
    case 'propAccess':
      return false;
    case 'unary':
      return isStaticExprNode(node.operand);
    case 'binary':
      return isStaticExprNode(node.left) && isStaticExprNode(node.right);
    case 'call':
      if (node.fn === 'rand') return false;
      return node.args.every(isStaticExprNode);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Easing functions — standard Robert Penner equations used by WMR
// ---------------------------------------------------------------------------

function easeLinear(t: number): number { return t; }
function easeQuadIn(t: number): number { return t * t; }
function easeQuadOut(t: number): number { return t * (2 - t); }
function easeQuadInOut(t: number): number { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
function easeCubicIn(t: number): number { return t * t * t; }
function easeCubicOut(t: number): number { const u = t - 1; return u * u * u + 1; }
function easeCubicInOut(t: number): number { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; }
function easeSineIn(t: number): number { return 1 - Math.cos((t * Math.PI) / 2); }
function easeSineOut(t: number): number { return Math.sin((t * Math.PI) / 2); }
function easeSineInOut(t: number): number { return 0.5 * (1 - Math.cos(Math.PI * t)); }
function easeBackIn(t: number): number { const s = 1.70158; return t * t * ((s + 1) * t - s); }
function easeBackOut(t: number): number { const s = 1.70158; const u = t - 1; return u * u * ((s + 1) * u + s) + 1; }
function easeBackInOut(t: number): number {
  const s = 1.70158 * 1.525;
  if (t < 0.5) { const u = 2 * t; return 0.5 * (u * u * ((s + 1) * u - s)); }
  const u = 2 * t - 2; return 0.5 * (u * u * ((s + 1) * u + s) + 2);
}
function easeElasticIn(t: number): number {
  if (t === 0 || t === 1) return t;
  return -Math.pow(2, 10 * (t - 1)) * Math.sin(((t - 1.1) * 5) * Math.PI);
}
function easeElasticOut(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin(((t - 0.1) * 5) * Math.PI) + 1;
}
function easeElasticInOut(t: number): number {
  if (t === 0 || t === 1) return t;
  if (t < 0.5) return -0.5 * Math.pow(2, 10 * (2 * t - 1)) * Math.sin(((2 * t - 1.1) * 5) * Math.PI);
  return 0.5 * Math.pow(2, -10 * (2 * t - 1)) * Math.sin(((2 * t - 1.1) * 5) * Math.PI) + 1;
}
function easeBounceOut(t: number): number {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) { const u = t - 1.5 / 2.75; return 7.5625 * u * u + 0.75; }
  if (t < 2.5 / 2.75) { const u = t - 2.25 / 2.75; return 7.5625 * u * u + 0.9375; }
  const u = t - 2.625 / 2.75; return 7.5625 * u * u + 0.984375;
}
function easeBounceIn(t: number): number { return 1 - easeBounceOut(1 - t); }
function easeBounceInOut(t: number): number {
  return t < 0.5 ? 0.5 * easeBounceIn(t * 2) : 0.5 * easeBounceOut(t * 2 - 1) + 0.5;
}

const EASE_MAP: Record<string, (t: number) => number> = {
  linear: easeLinear,
  QuadEaseIn: easeQuadIn, QuadEaseOut: easeQuadOut, QuadEaseInOut: easeQuadInOut,
  CubicEaseIn: easeCubicIn, CubicEaseOut: easeCubicOut, CubicEaseInOut: easeCubicInOut,
  SineEaseIn: easeSineIn, SineEaseOut: easeSineOut, SineEaseInOut: easeSineInOut,
  BackEaseIn: easeBackIn, BackEaseOut: easeBackOut, BackEaseInOut: easeBackInOut,
  ElasticEaseIn: easeElasticIn, ElasticEaseOut: easeElasticOut, ElasticEaseInOut: easeElasticInOut,
  BounceEaseIn: easeBounceIn, BounceEaseOut: easeBounceOut, BounceEaseInOut: easeBounceInOut,
};

function resolveEasing(easeType: string | undefined): (t: number) => number {
  if (!easeType) return easeLinear;
  const normalized = easeType.trim().replace(/^['"]|['"]$/g, '');
  const baseName = normalized.replace(/\([^)]*\)\s*$/, '');
  return EASE_MAP[normalized] ?? EASE_MAP[baseName] ?? easeLinear;
}

function is24HourFormatPreferred(): boolean {
  const locale = localeApi.getLocale() === 'en' ? 'en-US' : 'zh-Hans-CN';
  try {
    const resolved = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions();
    if (typeof resolved.hour12 === 'boolean') return !resolved.hour12;
    return resolved.hourCycle === 'h23' || resolved.hourCycle === 'h24';
  } catch {
    return true;
  }
}

function splitMethodParams(raw: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      current += ch;
      if (ch === quote && raw[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth = Math.max(0, depth - 1);
      current += ch;
      continue;
    }
    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function getFolmeDuration(spec: string | undefined): number {
  if (!spec) return 300;
  const parts = spec
    .replace(/^['"]|['"]$/g, '')
    .split(',')
    .map((part) => parseFloat(part.trim()))
    .filter((value) => Number.isFinite(value));
  if (parts.length >= 2 && parts[0] >= 0 && Math.abs(parts[1]) >= 20) {
    return Math.max(1, Math.round(parts[1]));
  }
  if (parts[0] != null && parts[0] < 0) return 350;
  return 300;
}

function getFolmeEasing(spec: string | undefined): (t: number) => number {
  if (!spec) return easeCubicOut;
  const normalized = spec.replace(/^['"]|['"]$/g, '').trim();
  if (!normalized) return easeCubicOut;
  if (/^[A-Za-z]/.test(normalized)) return resolveEasing(normalized);
  const parts = normalized
    .split(',')
    .map((part) => parseFloat(part.trim()))
    .filter((value) => Number.isFinite(value));
  const code = parts[0] ?? 0;
  if (code < 0) return easeCubicOut;
  if (code === 1) return easeLinear;
  if (code === 3) return easeCubicOut;
  if (code === 15) return easeSineInOut;
  return easeCubicOut;
}

function getCycleIndex(value: number, size: number): number {
  return ((value % size) + size) % size;
}

const PERSIST_STORAGE_PREFIX = 'wmr_persist_v1:';
const ACTIVE_ANIMATION_FRAME_RATE = 30;

type VarContextOptions = {
  onAsyncCommand?: () => void;
};

export class VarContext implements WmrVarContext {
  private vars = new Map<string, VarValue>();
  private arrays = new Map<string, VarValue[]>();
  private elementProps = new Map<string, number>(); // "el.prop" → number
  private persistStore = new Map<string, VarValue>();
  private varDefs = new Map<string, WmrVar>();
  private triggerLastValues = new WeakMap<WmrVar, VarValue>();
  private variableAnimations = new Map<string, RegisteredVarAnimation>();
  private variableAnimationTargets = new Map<string, RegisteredVarAnimation[]>();
  private variableAnimationAliases = new Map<string, RegisteredVarAnimation[]>();
  private activeVarAnimationBySlot = new Map<string, string>();
  private framerateControllers = new Map<string, WmrFramerateController>();
  private framerateStates = new Map<string, TimelineState>();
  private functions = new Map<string, WmrFunction>();
  private folmeStates = new Map<string, WmrFolmeState>();
  private folmeConfigs = new Map<string, WmrFolmeConfig>();
  private folmeTransitions = new Map<string, RegisteredFolmeTransition>();
  private propertyAnimations = new Map<string, RegisteredPropertyAnimation>();
  private propertyAnimationTargets = new Map<string, RegisteredPropertyAnimation[]>();
  private preparedAnimationTimelines = new WeakMap<WmrVariableAnimation | WmrPropertyAnimation, PreparedAnimationTimeline>();
  private methodHandlers = new Map<string, (...args: VarValue[]) => void>();
  private namedElements = new Map<string, WmrBaseAttrs>();
  private actionTargets = new Map<string, WmrTrigger[]>();
  private contentProviders = new Map<string, WmrContentProviderBinder>();
  private intentHandler: ((pkg: string, cls?: string) => boolean | void) | null = null;
  private frameRateOverride = 0;
  private defaultFrameRate = 0;
  private persistStorageKey: string;
  private onAsyncCommand?: () => void;

  constructor(namespace = 'global', options: VarContextOptions = {}) {
    this.persistStorageKey = `${PERSIST_STORAGE_PREFIX}${namespace}`;
    this.onAsyncCommand = options.onAsyncCommand;
    this.restorePersistedVars();
    this.vars.set('touch_begin_x', 0);
    this.vars.set('touch_begin_y', 0);
    this.vars.set('touch_x', 0);
    this.vars.set('touch_y', 0);
    this.initSystemFallbacks();
  }

  private initSystemFallbacks(): void {
    this.vars.set('battery_level', 78);
    this.vars.set('battery_state', 0);
    this.vars.set('ChargeSpeed', 0);
    this.vars.set('applied_light_wallpaper', 0);
    this.vars.set('__miui_version_code', 14);
    this.vars.set('frame_rate', this.defaultFrameRate);
    this.vars.set('music_control.music_state', 0);
    this.vars.set('music_control.music_position', 0);
    this.vars.set('music_control.music_duration', 1);
    this.vars.set('music_control.title', '');
    this.vars.set('music_control.artist', '');
    this.vars.set('music_control.package', '');
    this.vars.set('music_control.class', '');
  }

  /** Refresh time-derived built-in variables from TimeService. */
  refreshBuiltins(): void {
    const d = TimeService.getDate();
    const h24 = d.getHours();
    const h12 = h24 % 12 || 12;
    const m = d.getMinutes();
    const s = d.getSeconds();
    const is24Hour = is24HourFormatPreferred();

    this.vars.set('hour24', h24);
    this.vars.set('hour12', h12);
    this.vars.set('minute', m);
    this.vars.set('second', s);
    this.vars.set('ampm', h24 < 12 ? 0 : 1);
    this.vars.set('time', TimeService.now());
    this.vars.set('time_format', is24Hour ? 1 : 0);
    this.vars.set('month', d.getMonth()); // 0-based
    this.vars.set('date', d.getDate());
    this.vars.set('year', d.getFullYear());
    this.vars.set('day_of_week', d.getDay() + 1);

    this.vars.set('time_sys', TimeService.now());
  }

  setDefaultFrameRate(rate: number): void {
    this.defaultFrameRate = Math.max(0, Math.round(rate));
    this.vars.set('frame_rate', this.defaultFrameRate);
  }

  setScreenSize(w: number, h: number): void {
    this.vars.set('view_width', w);
    this.vars.set('view_height', h);
  }

  private registerNamedNode(node: WmrNode): void {
    const attrs = node as WmrBaseAttrs & { triggers?: WmrTrigger[] };
    if (attrs.name) {
      this.namedElements.set(attrs.name, attrs);
      if (attrs.triggers?.length) {
        this.actionTargets.set(attrs.name, attrs.triggers);
      }
    }
    if (node.tag === 'ContentProviderBinder' && node.name) {
      this.contentProviders.set(node.name, node);
    }
  }

  /** Walk the AST to initialize user-defined Var/VarArray and ContentProviderBinder variables. */
  initFromNodes(nodes: WmrNode[]): void {
    for (const node of nodes) {
      this.registerNamedNode(node);
      this.registerNodeAnimations(node);
      switch (node.tag) {
        case 'Var':
          this.initVar(node);
          break;
        case 'VarArray':
          this.initVarArray(node);
          break;
        case 'ContentProviderBinder':
          this.initContentProvider(node);
          break;
        case 'BroadcastBinder':
          this.initBroadcastBinder(node);
          break;
        case 'Function':
          if (node.name) this.functions.set(node.name, node);
          break;
        case 'FolmeState':
          if (node.name) this.folmeStates.set(node.name, node);
          break;
        case 'FolmeConfig':
          if (node.name) this.folmeConfigs.set(node.name, node);
          break;
        case 'VirtualElement':
          this.initVirtualElement(node);
          break;
        case 'Group':
        case 'Button':
        case 'Mask':
        case 'MusicControl':
          if ('children' in node) this.initFromNodes(node.children);
          if ('normalChildren' in node && Array.isArray((node as any).normalChildren)) {
            this.initFromNodes((node as any).normalChildren);
          }
          if ('pressedChildren' in node && Array.isArray((node as any).pressedChildren)) {
            this.initFromNodes((node as any).pressedChildren);
          }
          break;
        case 'Array': {
          const count = this.getRepeatCount(node.count);
          const indexName = node.indexName ?? '__index';
          for (let i = 0; i < count; i++) {
            this.set(indexName, i);
            this.initFromNodes(node.children);
          }
          break;
        }
      }
    }
  }

  private registerNodeAnimations(node: WmrNode): void {
    const attrs = node as WmrBaseAttrs;
    if (!attrs.name || !attrs.animations?.length) return;
    for (let i = 0; i < attrs.animations.length; i++) {
      const animation = attrs.animations[i];
      const key = animation.name || `${attrs.name}:${animation.kind}:${i}`;
      const autoStart = !animation.tag && !animation.initPause;
      const state: TimelineState = {
        fromTime: 0,
        toTime: this.getAnimationTimeline(animation).slice(-1)[0]?.time ?? 0,
        startedAt: TimeService.realNow(),
        duration: 0,
        playing: autoStart,
        currentTime: 0,
        completed: !autoStart,
      };
      const registered: RegisteredPropertyAnimation = { key, target: attrs.name, animation, state };
      this.propertyAnimations.set(key, registered);
      const bucket = this.propertyAnimationTargets.get(attrs.name) ?? [];
      bucket.push(registered);
      this.propertyAnimationTargets.set(attrs.name, bucket);
      this.applyPropertyAnimationFrame(registered, 0);
      this.syncAnimationStatus(key, animation.name, state);
      if (autoStart) {
        this.scheduleTimeline(state.toTime, state, 'play');
      }
    }
  }

  private initVirtualElement(node: WmrVirtualElement): void {
    if (!node.name) return;
    this.setRuntimeProp(node.name, 'x', node.x);
    this.setRuntimeProp(node.name, 'y', node.y);
    this.setRuntimeProp(node.name, 'alpha', node.alpha);
    this.setRuntimeProp(node.name, 'scaleX', node.scaleX ?? node.scale);
    this.setRuntimeProp(node.name, 'scaleY', node.scaleY ?? node.scale);
    this.setRuntimeProp(node.name, 'rotation', node.rotation);
  }

  private initVar(v: WmrVar): void {
    if (v.name) this.varDefs.set(v.name, v);
    const animations = v.animations?.length ? v.animations : (v.animation ? [v.animation] : []);

    if (v.values && v.name && v.index == null) {
      this.updateVarValues(v);
    }

    const persisted = (v.persist || v.const) && v.name && this.persistStore.has(v.name)
      ? this.persistStore.get(v.name)
      : undefined;
    const fallback = v.type?.startsWith('number') ? 0 : '';
    let value: VarValue = persisted ?? fallback;
    if (persisted === undefined && (!v.values || v.index != null)) {
      try {
        value = evalExpr(compileExpr(v.expression), this);
      } catch {
        value = fallback;
      }
    }

    if (v.index != null) {
      if (!v.name) return;
      const index = this.resolveIndex(v.index);
      this.setIndexedVarValue(v.name, index, value, v.type);
      if (animations.length) this.registerVarAnimations(v.name, animations, index, value);
      return;
    }

    if (v.name && (!v.values || animations.length || persisted !== undefined)) {
      this.vars.set(v.name, value);
    }
    if (v.name && animations.length) {
      this.registerVarAnimations(v.name, animations, undefined, value);
    }
  }

  private resolveIndex(indexExpr: string | undefined): number {
    if (!indexExpr) return 0;
    try {
      return Math.max(0, Math.floor(toNum(evalExpr(compileExpr(indexExpr), this))));
    } catch {
      return 0;
    }
  }

  private setIndexedVarValue(name: string, index: number, value: VarValue, valueType?: string): void {
    const next = [...this.getArray(name)];
    while (next.length <= index) next.push(valueType?.startsWith('number') ? 0 : '');
    next[index] = value;
    this.arrays.set(name, next);
  }

  private makeVarAnimationKey(target: string, animation: WmrVariableAnimation, index?: number, ordinal = 0): string {
    const parts = [target];
    if (index !== undefined) parts.push(`[${index}]`);
    if (animation.tag) parts.push(`#${animation.tag}`);
    else if (animation.name) parts.push(`:${animation.name}`);
    else parts.push(`:${ordinal}`);
    return parts.join('');
  }

  private getVarAnimationSlot(target: string, index?: number): string {
    return index === undefined ? target : `${target}[${index}]`;
  }

  private registerVarAnimations(target: string, animations: WmrVariableAnimation[], index: number | undefined, baseValue: VarValue): void {
    const slot = this.getVarAnimationSlot(target, index);
    animations.forEach((animation, ordinal) => {
      const key = this.makeVarAnimationKey(target, animation, index, ordinal);
      const timeline = this.getAnimationTimeline(animation);
      const autoStart = !animation.tag && !animation.initPause;
      const state: TimelineState = {
        fromTime: 0,
        toTime: timeline[timeline.length - 1]?.time ?? 0,
        startedAt: TimeService.realNow(),
        duration: 0,
        playing: autoStart,
        currentTime: 0,
        completed: !autoStart,
      };
      const registered: RegisteredVarAnimation = { key, target, slot, index, animation, state };
      this.variableAnimations.set(key, registered);

      const targetBucket = this.variableAnimationTargets.get(target) ?? [];
      targetBucket.push(registered);
      this.variableAnimationTargets.set(target, targetBucket);

      if (animation.name) {
        const aliasBucket = this.variableAnimationAliases.get(animation.name) ?? [];
        aliasBucket.push(registered);
        this.variableAnimationAliases.set(animation.name, aliasBucket);
      }

      this.syncAnimationStatus(key, animation.name, state);

      if (autoStart) {
        this.activeVarAnimationBySlot.set(slot, key);
        const initial = this.evaluateAnimationValue(animation, 0);
        if (index === undefined) this.vars.set(target, initial);
        else this.setIndexedVarValue(target, index, initial);
        this.scheduleTimeline(state.toTime, state, 'play');
      } else if (index === undefined) {
        this.vars.set(target, baseValue);
      } else {
        this.setIndexedVarValue(target, index, baseValue);
      }
    });
  }

  private updateVarValues(v: WmrVar): void {
    if (!v.name || !v.values) return;
    const values = v.values.map((entry) => {
      try {
        return evalExpr(compileExpr(entry), this);
      } catch {
        return v.type?.startsWith('number') ? 0 : '';
      }
    });
    this.arrays.set(v.name, values);
    if (values.length > 0) {
      this.vars.set(v.name, values[0]);
    }
  }

  private initVarArray(va: WmrVarArray): void {
    // Items define the array data
    if (va.items.length > 0) {
      if (va.name) {
        this.arrays.set(va.name, va.items);
      }
      // VarArray with Items: maps index → value
      for (const sub of va.vars) {
        const indexExpr = sub.index ?? sub.expression;
        try {
          const idx = Math.floor(toNum(evalExpr(compileExpr(indexExpr), this)));
          const val = va.items[idx] ?? '';
          this.vars.set(sub.name, val);
        } catch {
          this.vars.set(sub.name, '');
        }
      }
      // Also store the items array itself for @arr[idx] access
      if (va.vars.length > 0) {
        this.arrays.set(va.vars[0].name, va.items);
      }
    }
  }

  private initContentProvider(cpb: WmrContentProviderBinder): void {
    // Initialize variable slots with defaults
    for (const v of cpb.variables) {
      if (!this.vars.has(v.name)) {
        const isNumeric = v.type === 'int' || v.type === 'long' || v.type === 'number' || v.type === 'float' || v.type === 'double';
        if (isNumeric) this.vars.set(v.name, 0);
        else if (v.type.endsWith('[]')) this.arrays.set(v.name, []);
        else this.vars.set(v.name, '');
      }
    }
    // countName → 0 (no data yet)
    if (cpb.countName) this.vars.set(cpb.countName, 0);
    // Execute trigger commands to compute derived variables
    for (const t of cpb.triggers) {
      this.executeCommands(t.commands);
    }
  }

  private initBroadcastBinder(binder: WmrBroadcastBinder): void {
    for (const v of binder.variables) {
      if (v.type === 'int' || v.type === 'number') this.vars.set(v.name, this.getNum(v.name));
      else if (v.type.endsWith('[]')) this.arrays.set(v.name, this.getArray(v.name));
      else this.vars.set(v.name, this.getStr(v.name));
    }
    if (binder.triggers?.length) {
      this.executeTriggerList(binder.triggers, 'up');
    }
  }

  /** Re-evaluate all non-const Var nodes (call after refreshBuiltins). */
  reevaluateVars(
    nodes: WmrNode[],
    options: {
      includeAnimations?: boolean;
      includeBinders?: boolean;
    } = {},
  ): void {
    const includeAnimations = options.includeAnimations !== false;
    const includeBinders = options.includeBinders !== false;
    if (includeAnimations) {
      this.refreshAnimations();
    }
    const childOptions = includeAnimations ? { ...options, includeAnimations: false } : options;
    for (const node of nodes) {
      if (node.tag === 'Var') {
        if (node.const) continue;
        if (node.values && node.name && node.index == null) {
          this.updateVarValues(node);
          continue;
        }
        if (node.animations?.length || node.animation) {
          continue;
        }
        try {
          const val = evalExpr(compileExpr(node.expression), this);
          if (node.index != null && node.name) {
            const index = this.resolveIndex(node.index);
            const previous = this.getArray(node.name)[index];
            this.setIndexedVarValue(node.name, index, val, node.type);
            this.maybeRunVarTriggers(node, previous, val);
          } else {
            const previous = node.name ? this.vars.get(node.name) : undefined;
            this.vars.set(node.name, val);
            this.maybeRunVarTriggers(node, previous, val);
          }
        } catch { /* keep old value */ }
      }
      if (node.tag === 'VarArray') {
        for (const sub of node.vars) {
          const indexExpr = sub.index ?? sub.expression;
          try {
            const idx = Math.floor(toNum(evalExpr(compileExpr(indexExpr), this)));
            const val = node.items[idx] ?? '';
            this.vars.set(sub.name, val);
          } catch { /* keep old value */ }
        }
      }
      if (node.tag === 'BroadcastBinder') {
        this.initBroadcastBinder(node);
      }
      if (includeBinders && node.tag === 'ContentProviderBinder') {
        for (const t of node.triggers) {
          this.executeCommands(t.commands);
        }
      }
      if (node.tag === 'Group' || node.tag === 'Button' || node.tag === 'Mask' || node.tag === 'MusicControl') {
        if ('children' in node) this.reevaluateVars(node.children, childOptions);
        if ('normalChildren' in node && Array.isArray((node as any).normalChildren)) {
          this.reevaluateVars((node as any).normalChildren, childOptions);
        }
        if ('pressedChildren' in node && Array.isArray((node as any).pressedChildren)) {
          this.reevaluateVars((node as any).pressedChildren, childOptions);
        }
      }
      if (node.tag === 'Array') {
        const count = this.getRepeatCount(node.count);
        const indexName = node.indexName ?? '__index';
        for (let i = 0; i < count; i++) {
          this.set(indexName, i);
          this.reevaluateVars(node.children, childOptions);
        }
      }
    }
  }

  private getRepeatCount(countExpr: string | undefined): number {
    if (!countExpr) return 0;
    try {
      return Math.max(0, Math.floor(toNum(evalExpr(compileExpr(countExpr), this))));
    } catch {
      return 0;
    }
  }

  registerFramerateControllers(controllers: WmrFramerateController[]): void {
    for (const controller of controllers) {
      this.framerateControllers.set(controller.name, controller);
      const lastTime = controller.controlPoints[controller.controlPoints.length - 1]?.time ?? 0;
      this.framerateStates.set(controller.name, {
        fromTime: 0,
        toTime: lastTime,
        startedAt: TimeService.realNow(),
        duration: 0,
        playing: !controller.initPause,
        currentTime: 0,
        completed: !!controller.initPause,
      });
      this.syncAnimationStatus(controller.name, undefined, this.framerateStates.get(controller.name)!);
      if (!controller.initPause) {
        this.scheduleTimeline(lastTime, this.framerateStates.get(controller.name), 'play');
      }
    }
  }

  executeTriggerList(triggers: WmrTrigger[] | undefined, action = 'up'): void {
    if (!triggers?.length) return;
    for (const trigger of triggers) {
      if (!this.matchesTriggerAction(trigger.action, action)) continue;
      if (!this.evalCondition(trigger.condition)) continue;
      this.executeCommands(trigger.commands);
    }
  }

  executeCommands(commands: WmrCommand[]): void {
    for (const command of commands) {
      if (command.type !== 'if' && !this.evalCondition(command.condition)) continue;
      const delay = 'delay' in command ? command.delay : undefined;
      if (delay && delay > 0 && typeof window !== 'undefined') {
        window.setTimeout(() => {
          try {
            this.executeCommands([{ ...command, delay: undefined } as WmrCommand]);
          } finally {
            this.onAsyncCommand?.();
          }
        }, delay);
        continue;
      }

      switch (command.type) {
        case 'variable':
          this.executeVariableCommand(command);
          break;
        case 'animation':
          this.playAnimation(command.target, command.command, command.tags);
          break;
        case 'frameRate':
          this.frameRateOverride = Math.max(0, Math.round(toNum(evalExpr(compileExpr(command.rate), this))));
          this.vars.set('frame_rate', this.frameRateOverride || this.getRecommendedFrameRate(this.defaultFrameRate));
          break;
        case 'intent': {
          const action = command.actionExp ? toStr(evalExpr(compileExpr(command.actionExp), this)) : (command.action ?? '');
          const extras = Object.fromEntries((command.extras ?? []).map((extra) => {
            try {
              return [extra.name, extra.expression ? evalExpr(compileExpr(extra.expression), this) : ''];
            } catch {
              return [extra.name, ''];
            }
          }));
          if (command.broadcast && action) {
            BroadcastBus.sendBroadcast({ action, extras });
            break;
          }
          const pkg = command.packageExp ? toStr(evalExpr(compileExpr(command.packageExp), this)) : (command.package ?? '');
          const cls = command.classExp ? toStr(evalExpr(compileExpr(command.classExp), this)) : command.class;
          if (pkg && this.intentHandler) {
            const handled = this.intentHandler(pkg, cls);
            if (handled === false && command.fallback?.length) this.executeCommands(command.fallback);
          } else if (command.fallback?.length) {
            this.executeCommands(command.fallback);
          }
          break;
        }
        case 'binder':
          if (command.command === 'refresh') {
            this.refreshContentProvider(command.name);
          }
          break;
        case 'function':
          this.executeFunction(command.target);
          break;
        case 'method':
          this.executeMethod(command.target, command.method, this.evaluateMethodParams(command.params));
          break;
        case 'folme':
          this.executeFolmeCommand(command);
          break;
        case 'multi':
          this.executeCommands(command.commands);
          break;
        case 'if':
          if (this.evalCondition(command.condition)) this.executeCommands(command.consequent);
          else if (command.alternate?.length) this.executeCommands(command.alternate);
          break;
        case 'loop': {
          const count = Math.max(0, Math.floor(toNum(evalExpr(compileExpr(command.count), this))));
          const indexName = command.indexName ?? '__i';
          for (let i = 0; i < count; i++) {
            this.set(indexName, i);
            this.executeCommands(command.commands);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  private executeVariableCommand(command: Extract<WmrCommand, { type: 'variable' }>): void {
    try {
      const value = evalExpr(compileExpr(command.expression), this);
      if (command.index) {
        const index = Math.max(0, Math.floor(toNum(evalExpr(compileExpr(command.index), this))));
        const next = [...this.getArray(command.name)];
        while (next.length <= index) next.push(command.valueType?.startsWith('number') ? 0 : '');
        next[index] = value;
        this.arrays.set(command.name, next);
      } else if (command.persist) {
        this.persistVar(command.name, value);
      } else {
        this.set(command.name, value);
      }
    } catch {
      // ignore malformed command expressions
    }
  }

  private maybeRunVarTriggers(node: WmrVar, previous: VarValue | undefined, next: VarValue): void {
    if (!node.triggers?.length) return;
    const prev = this.triggerLastValues.has(node) ? this.triggerLastValues.get(node) : previous;
    this.triggerLastValues.set(node, next);
    if (prev === undefined) return;

    const threshold = node.threshold ? Math.abs(toNum(evalExpr(compileExpr(node.threshold), this))) : 0;
    let changed = false;
    if (typeof next === 'number' || typeof prev === 'number') {
      changed = Math.abs(toNum(next) - toNum(prev)) >= (threshold || 1);
    } else {
      changed = next !== prev;
    }
    if (changed) {
      this.executeTriggerList(node.triggers, 'up');
    }
  }

  private evalCondition(condition: string | undefined): boolean {
    if (!condition) return true;
    try {
      return toNum(evalExpr(compileExpr(condition), this)) !== 0;
    } catch {
      return false;
    }
  }

  private executeFunction(name: string): void {
    const fn = this.functions.get(name);
    if (!fn) return;
    this.executeCommands(fn.commands);
  }

  private evaluateMethodParams(rawParams: string | undefined): VarValue[] {
    if (!rawParams) return [];
    return splitMethodParams(rawParams).map((expr) => {
      try {
        return evalExpr(compileExpr(expr), this);
      } catch {
        return this.stripQuoted(expr);
      }
    });
  }

  private refreshContentProvider(name: string): void {
    const binder = this.contentProviders.get(name);
    if (!binder) return;
    applyBinderData(this, binder);
    for (const trigger of binder.triggers) {
      this.executeCommands(trigger.commands);
    }
  }

  registerMethodHandler(target: string, method: string, handler: (...args: VarValue[]) => void): void {
    this.methodHandlers.set(`${target}:${method}`, handler);
  }

  registerIntentHandler(handler: (pkg: string, cls?: string) => boolean | void): void {
    this.intentHandler = handler;
  }

  private executeMethod(target: string, method: string, args: VarValue[] = []): void {
    const handler = this.methodHandlers.get(`${target}:${method}`);
    if (handler) {
      handler(...args);
      return;
    }
    if (method === 'performAction') {
      const action = args.length > 0 ? toStr(args[0]) : 'up';
      const triggers = this.actionTargets.get(target);
      if (triggers?.length) {
        this.executeTriggerList(triggers, action);
      }
    }
  }

  private executeFolmeCommand(command: Extract<WmrCommand, { type: 'folme' }>): void {
    const apply = () => {
      const states = this.parseFolmeStates(command.states);
      const config = command.config ? this.folmeConfigs.get(this.stripQuoted(command.config)) : undefined;
      const fromState = states.length >= 2 ? this.folmeStates.get(states[0]) : undefined;
      const toState = states.length > 0 ? this.folmeStates.get(states[states.length - 1]) : undefined;

      if (command.command === 'setTo') {
        if (toState) this.applyFolmeState(command.target, toState);
        if (config?.onComplete) this.executeFunction(this.stripQuoted(config.onComplete));
        return;
      }

      if (command.command === 'fromTo') {
        this.startFolmeTransition(command.target, fromState, toState ?? fromState, config);
        return;
      }

      this.startFolmeTransition(command.target, undefined, toState, config);
    };

    const configName = command.config ? this.stripQuoted(command.config) : '';
    const config = configName ? this.folmeConfigs.get(configName) : undefined;
    const configDelay = config?.delay
      ? Math.max(0, Math.round(toNum(evalExpr(compileExpr(config.delay), this))))
      : 0;
    const totalDelay = Math.max(0, (command.delay ?? 0) + configDelay);

    if (totalDelay > 0 && typeof window !== 'undefined') {
      window.setTimeout(apply, totalDelay);
    } else {
      apply();
    }
  }

  private applyFolmeState(target: string, state: WmrFolmeState): void {
    if (!state) return;
    this.setRuntimeProp(target, 'x', state.x);
    this.setRuntimeProp(target, 'y', state.y);
    this.setRuntimeProp(target, 'alpha', state.alpha);
    this.setRuntimeProp(target, 'scaleX', state.scaleX);
    this.setRuntimeProp(target, 'scaleY', state.scaleY);
    this.setRuntimeProp(target, 'rotation', state.rotation);
  }

  private setRuntimeProp(target: string, prop: string, expression: string | undefined): void {
    if (!target || !prop || !expression) return;
    try {
      const value = toNum(evalExpr(compileExpr(expression), this));
      this.setNumericRuntimeProp(target, prop as FolmeProp, value);
    } catch {
      // ignore malformed runtime property expressions
    }
  }

  private setNumericRuntimeProp(target: string, prop: FolmeProp, value: number): void {
    this.set(`${target}.${prop}`, value);
    this.setElementProp(target, prop, value);
  }

  private getBaseRuntimeProp(target: string, prop: FolmeProp): number {
    const node = this.namedElements.get(target);
    if (!node) {
      if (prop === 'alpha') return 255;
      if (prop === 'scaleX' || prop === 'scaleY') return 1;
      return 0;
    }
    try {
      switch (prop) {
        case 'x':
          return node.x != null ? toNum(evalExpr(compileExpr(node.x), this)) : 0;
        case 'y':
          return node.y != null ? toNum(evalExpr(compileExpr(node.y), this)) : 0;
        case 'alpha':
          return node.alpha != null ? toNum(evalExpr(compileExpr(node.alpha), this)) : 255;
        case 'scaleX':
          return node.scaleX != null
            ? toNum(evalExpr(compileExpr(node.scaleX), this))
            : node.scale != null
              ? toNum(evalExpr(compileExpr(node.scale), this))
              : 1;
        case 'scaleY':
          return node.scaleY != null
            ? toNum(evalExpr(compileExpr(node.scaleY), this))
            : node.scale != null
              ? toNum(evalExpr(compileExpr(node.scale), this))
              : 1;
        case 'rotation':
          return node.rotation != null ? toNum(evalExpr(compileExpr(node.rotation), this)) : 0;
      }
    } catch {
      // fall through to safe defaults below
    }
    if (prop === 'alpha') return 255;
    if (prop === 'scaleX' || prop === 'scaleY') return 1;
    return 0;
  }

  private getCurrentRuntimeProp(target: string, prop: FolmeProp): number {
    const key = `${target}.${prop}`;
    if (this.vars.has(key)) return this.getNum(key);
    return this.getBaseRuntimeProp(target, prop);
  }

  private evalRuntimeProp(expression: string | undefined, fallback: number): number {
    if (!expression) return fallback;
    try {
      return toNum(evalExpr(compileExpr(expression), this));
    } catch {
      return fallback;
    }
  }

  private getFolmeStateProp(state: WmrFolmeState | undefined, prop: FolmeProp): string | undefined {
    if (!state) return undefined;
    switch (prop) {
      case 'x': return state.x;
      case 'y': return state.y;
      case 'alpha': return state.alpha;
      case 'scaleX': return state.scaleX;
      case 'scaleY': return state.scaleY;
      case 'rotation': return state.rotation;
    }
  }

  private getFolmeTransitionSpec(config: WmrFolmeConfig | undefined, prop: FolmeProp): string | undefined {
    const special = config?.specials.find((item) => this.stripQuoted(item.property) === prop);
    return special?.ease ?? config?.ease;
  }

  private startFolmeTransition(
    target: string,
    fromState: WmrFolmeState | undefined,
    toState: WmrFolmeState | undefined,
    config: WmrFolmeConfig | undefined,
  ): void {
    const props: FolmeTransitionProp[] = [];
    const allProps: FolmeProp[] = ['x', 'y', 'alpha', 'scaleX', 'scaleY', 'rotation'];

    for (const prop of allProps) {
      const current = this.getCurrentRuntimeProp(target, prop);
      const from = this.evalRuntimeProp(this.getFolmeStateProp(fromState, prop), current);
      const to = this.evalRuntimeProp(this.getFolmeStateProp(toState, prop), from);
      const hasExplicitValue = this.getFolmeStateProp(fromState, prop) != null || this.getFolmeStateProp(toState, prop) != null;
      if (!hasExplicitValue) continue;
      const spec = this.getFolmeTransitionSpec(config, prop);
      props.push({
        prop,
        from,
        to,
        duration: getFolmeDuration(spec),
        easing: getFolmeEasing(spec),
      });
      this.setNumericRuntimeProp(target, prop, from);
    }

    if (props.length === 0) {
      if (config?.onComplete) this.executeFunction(this.stripQuoted(config.onComplete));
      return;
    }

    this.folmeTransitions.set(target, {
      target,
      startedAt: TimeService.realNow(),
      props,
      onComplete: config?.onComplete ? this.stripQuoted(config.onComplete) : undefined,
    });
  }

  private parseFolmeStates(states: string | undefined): string[] {
    if (!states) return [];
    return states
      .split(',')
      .map((state) => this.stripQuoted(state.trim()))
      .filter(Boolean);
  }

  private stripQuoted(value: string): string {
    return value.replace(/^['"]|['"]$/g, '');
  }

  private matchesTriggerAction(actions: string | undefined, action: string): boolean {
    if (!actions) return action === 'up';
    return actions.split(',').map((item) => item.trim()).includes(action);
  }

  private refreshAnimations(): void {
    for (const registered of this.variableAnimations.values()) {
      const timeline = this.getAnimationTimeline(registered.animation);
      const currentTime = this.advanceTimeline(timeline[timeline.length - 1]?.time ?? 0, registered.state, registered.animation.loop);
      registered.state.currentTime = currentTime;
      this.syncAnimationStatus(registered.key, registered.animation.name, registered.state);
      if (this.activeVarAnimationBySlot.get(registered.slot) === registered.key) {
        const value = this.evaluateAnimationValue(registered.animation, currentTime);
        if (registered.index === undefined) this.vars.set(registered.target, value);
        else this.setIndexedVarValue(registered.target, registered.index, value);
      }
      this.maybeFireAnimationEnd(registered.animation.triggers, registered.state);
    }

    for (const [name, controller] of this.framerateControllers.entries()) {
      const state = this.framerateStates.get(name);
      if (!state) continue;
      state.currentTime = this.advanceTimeline(controller.controlPoints[controller.controlPoints.length - 1]?.time ?? 0, state, controller.loop);
      this.syncAnimationStatus(name, undefined, state);
    }

    for (const registered of this.propertyAnimations.values()) {
      const timeline = this.getAnimationTimeline(registered.animation);
      registered.state.currentTime = this.advanceTimeline(timeline[timeline.length - 1]?.time ?? 0, registered.state, registered.animation.loop);
      this.applyPropertyAnimationFrame(registered, registered.state.currentTime);
      this.syncAnimationStatus(registered.key, registered.animation.name, registered.state);
      this.maybeFireAnimationEnd(registered.animation.triggers, registered.state);
    }

    this.refreshFolmeTransitions();
    this.vars.set('frame_rate', this.getRecommendedFrameRate(this.defaultFrameRate));
  }

  private refreshFolmeTransitions(): void {
    const now = TimeService.realNow();
    for (const [target, transition] of [...this.folmeTransitions.entries()]) {
      let completed = true;
      for (const prop of transition.props) {
        const progress = prop.duration <= 0 ? 1 : Math.min(1, (now - transition.startedAt) / prop.duration);
        const value = prop.from + (prop.to - prop.from) * prop.easing(progress);
        this.setNumericRuntimeProp(target, prop.prop, value);
        if (progress < 1) completed = false;
      }
      if (!completed) continue;
      this.folmeTransitions.delete(target);
      if (transition.onComplete) {
        this.executeFunction(transition.onComplete);
      }
    }
  }

  private advanceTimeline(totalDuration: number, state: TimelineState, loop = false): number {
    if (!state.playing || state.duration <= 0) {
      return state.currentTime;
    }
    const elapsed = TimeService.realNow() - state.startedAt;
    const progress = Math.min(1, elapsed / state.duration);
    const currentTime = state.fromTime + (state.toTime - state.fromTime) * progress;
    if (progress >= 1) {
      if (loop && totalDuration > 0) {
        state.startedAt = TimeService.realNow();
        state.currentTime = 0;
        state.completed = false;
        return 0;
      }
      state.playing = false;
      state.currentTime = state.toTime;
      state.completed = true;
      return state.toTime;
    }
    state.completed = false;
    return currentTime;
  }

  private prepareAnimationTimeline(animation: WmrVariableAnimation | WmrPropertyAnimation): PreparedAnimationTimeline {
    const cached = this.preparedAnimationTimelines.get(animation);
    if (cached) return cached;

    const frames: CompiledAnimationFrame[] = animation.frames.map((frame) => ({
      relative: frame.relative,
      time: compileExpr(frame.time),
      value: frame.value ? compileExpr(frame.value) : undefined,
      x: frame.x ? compileExpr(frame.x) : undefined,
      y: frame.y ? compileExpr(frame.y) : undefined,
      scaleX: frame.scaleX ? compileExpr(frame.scaleX) : undefined,
      scaleY: frame.scaleY ? compileExpr(frame.scaleY) : undefined,
      alpha: frame.alpha ? compileExpr(frame.alpha) : undefined,
      rotation: frame.rotation ? compileExpr(frame.rotation) : undefined,
      easeType: frame.easeType,
    }));

    const prepared: PreparedAnimationTimeline = { frames };
    if (frames.every((frame) => isStaticExprNode(frame.time))) {
      prepared.staticTimeline = this.buildEvaluatedAnimationFrames(frames);
    }
    this.preparedAnimationTimelines.set(animation, prepared);
    return prepared;
  }

  private buildEvaluatedAnimationFrames(frames: CompiledAnimationFrame[]): EvaluatedAnimationFrame[] {
    const timeline: EvaluatedAnimationFrame[] = [];
    let currentTime = 0;
    for (const frame of frames) {
      const evaluated = Math.max(0, toNum(evalExpr(frame.time, this)));
      currentTime = frame.relative ? currentTime + evaluated : evaluated;
      timeline.push({
        value: frame.value,
        x: frame.x,
        y: frame.y,
        scaleX: frame.scaleX,
        scaleY: frame.scaleY,
        alpha: frame.alpha,
        rotation: frame.rotation,
        time: currentTime,
        easeType: frame.easeType,
      });
    }
    return timeline;
  }

  private getAnimationTimeline(animation: WmrVariableAnimation | WmrPropertyAnimation): EvaluatedAnimationFrame[] {
    const prepared = this.prepareAnimationTimeline(animation);
    return prepared.staticTimeline ?? this.buildEvaluatedAnimationFrames(prepared.frames);
  }

  private evaluateAnimationValue(animation: WmrVariableAnimation, currentTime: number): VarValue {
    const frames = this.getAnimationTimeline(animation);
    if (frames.length === 0) return 0;
    if (currentTime <= frames[0].time) {
      return frames[0].value ? evalExpr(frames[0].value, this) : 0;
    }
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1];
      const next = frames[i];
      if (currentTime > next.time) continue;
      const prevValue = prev.value ? evalExpr(prev.value, this) : 0;
      const nextValue = next.value ? evalExpr(next.value, this) : 0;
      const span = Math.max(1, next.time - prev.time);
      const linearT = (currentTime - prev.time) / span;
      const easeFn = resolveEasing(next.easeType);
      const t = easeFn(linearT);
      if (typeof prevValue === 'number' && typeof nextValue === 'number') {
        return prevValue + (nextValue - prevValue) * t;
      }
      return t < 0.5 ? prevValue : nextValue;
    }
    return frames[frames.length - 1].value
      ? evalExpr(frames[frames.length - 1].value!, this)
      : 0;
  }

  playAnimation(name: string, command: string, tags?: string): void {
    const requestedTags = this.parseAnimationTags(tags);
    const variableAnimations = this.getVarAnimationRegistrations(name, requestedTags);
    if (variableAnimations.length > 0) {
      for (const registered of variableAnimations) {
        const timeline = this.getAnimationTimeline(registered.animation);
        this.activeVarAnimationBySlot.set(registered.slot, registered.key);
        this.scheduleTimeline(timeline[timeline.length - 1]?.time ?? 0, registered.state, command);
        if (!registered.state.playing) {
          const value = this.evaluateAnimationValue(registered.animation, registered.state.currentTime);
          if (registered.index === undefined) this.vars.set(registered.target, value);
          else this.setIndexedVarValue(registered.target, registered.index, value);
          this.syncAnimationStatus(registered.key, registered.animation.name, registered.state);
        }
      }
      return;
    }
    const propertyAnimations = (this.propertyAnimationTargets.get(name) ?? [])
      .filter((registered) => this.matchesAnimationTag(registered.animation.tag, requestedTags));
    if (propertyAnimations?.length) {
      for (const registered of propertyAnimations) {
        const timeline = this.getAnimationTimeline(registered.animation);
        this.scheduleTimeline(timeline[timeline.length - 1]?.time ?? 0, registered.state, command);
        if (!registered.state.playing) {
          this.applyPropertyAnimationFrame(registered, registered.state.currentTime);
          this.syncAnimationStatus(registered.key, registered.animation.name, registered.state);
        }
      }
      return;
    }
    const directPropertyAnimation = this.propertyAnimations.get(name);
    if (directPropertyAnimation) {
      const timeline = this.getAnimationTimeline(directPropertyAnimation.animation);
      this.scheduleTimeline(timeline[timeline.length - 1]?.time ?? 0, directPropertyAnimation.state, command);
      if (!directPropertyAnimation.state.playing) {
        this.applyPropertyAnimationFrame(directPropertyAnimation, directPropertyAnimation.state.currentTime);
        this.syncAnimationStatus(directPropertyAnimation.key, directPropertyAnimation.animation.name, directPropertyAnimation.state);
      }
      return;
    }
    const controller = this.framerateControllers.get(name);
    if (controller) {
      this.scheduleTimeline(controller.controlPoints[controller.controlPoints.length - 1]?.time ?? 0, this.framerateStates.get(name), command);
    }
  }

  private scheduleTimeline(totalDuration: number, state: TimelineState | undefined, command: string): void {
    if (!state) return;
    const commandName = command.split('(')[0]?.trim() || 'play';
    if (commandName === 'pause') {
      state.playing = false;
      state.completed = false;
      return;
    }
    if (commandName === 'resume') {
      if (!state.playing && state.currentTime < state.toTime) {
        state.fromTime = state.currentTime;
        state.duration = Math.abs(state.toTime - state.currentTime);
        state.startedAt = TimeService.realNow();
        state.playing = state.duration > 0;
        state.completed = false;
      }
      return;
    }
    if (commandName === 'stop') {
      state.playing = false;
      state.currentTime = 0;
      state.fromTime = 0;
      state.toTime = totalDuration;
      state.duration = totalDuration;
      state.completed = false;
      return;
    }

    const args = /\(([^)]*)\)/.exec(command)?.[1]
      ?.split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        try {
          return toNum(evalExpr(compileExpr(item), this));
        } catch {
          return parseFloat(item);
        }
      });

    let fromTime = 0;
    let toTime = totalDuration;
    if (args && args.length > 0) {
      fromTime = args[0] === -1 ? state.currentTime : Math.max(0, args[0] ?? 0);
      toTime = args.length > 1 ? Math.max(0, args[1] ?? totalDuration) : totalDuration;
    }

    state.fromTime = fromTime;
    state.toTime = toTime;
    state.duration = Math.abs(toTime - fromTime);
    state.startedAt = TimeService.realNow();
    state.playing = state.duration > 0;
    state.currentTime = fromTime;
    state.completed = false;
    if (!state.playing) {
      state.currentTime = toTime;
      // WMR 里的 play(0,0) 常用于“瞬时复位”动画，不应该在下一帧再次触发 end。
      state.completed = false;
    }
  }

  private parseAnimationTags(tags: string | undefined): string[] {
    if (!tags) return [];
    return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  }

  private matchesAnimationTag(tag: string | undefined, requestedTags: string[]): boolean {
    if (requestedTags.length === 0) return true;
    return !!tag && requestedTags.includes(tag);
  }

  private getVarAnimationRegistrations(name: string, requestedTags: string[]): RegisteredVarAnimation[] {
    const direct = this.variableAnimationTargets.get(name) ?? [];
    const aliased = this.variableAnimationAliases.get(name) ?? [];
    const combined = [...direct, ...aliased];
    if (combined.length === 0) return [];
    return combined.filter((registered) => this.matchesAnimationTag(registered.animation.tag, requestedTags));
  }

  getRecommendedFrameRate(defaultRate: number): number {
    let result = this.frameRateOverride > 0 ? this.frameRateOverride : defaultRate;
    for (const [name, controller] of this.framerateControllers.entries()) {
      const state = this.framerateStates.get(name);
      if (!state) continue;
      if (!state.playing) continue;
      const currentTime = state.currentTime;
      let currentRate = controller.controlPoints[controller.controlPoints.length - 1]?.frameRate ?? defaultRate;
      for (const point of controller.controlPoints) {
        if (currentTime <= point.time) {
          currentRate = point.frameRate;
          break;
        }
      }
      result = Math.max(result, currentRate);
    }
    if (this.hasActiveTimelineAnimations()) {
      result = Math.max(result, defaultRate > 0 ? defaultRate : ACTIVE_ANIMATION_FRAME_RATE);
    }
    if (this.folmeTransitions.size > 0) {
      result = Math.max(result, 60);
    }
    this.vars.set('frame_rate', result);
    return result;
  }

  private hasActiveTimelineAnimations(): boolean {
    for (const registered of this.variableAnimations.values()) {
      if (registered.state.playing) return true;
    }
    for (const registered of this.propertyAnimations.values()) {
      if (registered.state.playing) return true;
    }
    return false;
  }

  private maybeFireAnimationEnd(triggers: WmrTrigger[] | undefined, state: TimelineState): void {
    if (!triggers?.length || !state.completed) return;
    state.completed = false;
    this.executeTriggerList(triggers, 'end');
  }

  private syncAnimationStatus(key: string, alias: string | undefined, state: TimelineState): void {
    const currentFrame = !state.playing && state.currentTime === state.toTime ? -1 : state.currentTime;
    this.set(`${key}.current_frame`, currentFrame);
    this.setElementProp(key, 'current_frame', currentFrame);
    if (alias) {
      this.set(`${alias}.current_frame`, currentFrame);
      this.setElementProp(alias, 'current_frame', currentFrame);
    }
  }

  private applyPropertyAnimationFrame(registered: RegisteredPropertyAnimation, currentTime: number): void {
    const values = this.evaluatePropertyAnimationValues(registered.animation, currentTime);
    if (registered.animation.kind === 'position') {
      // PositionAnimation values are OFFSETS from the base position, not absolute coords.
      if (values.x !== undefined) this.setElementProp(registered.target, 'posAnimOffsetX', values.x);
      if (values.y !== undefined) this.setElementProp(registered.target, 'posAnimOffsetY', values.y);
    } else {
      if (values.x !== undefined) {
        this.set(`${registered.target}.x`, values.x);
        this.setElementProp(registered.target, 'x', values.x);
      }
      if (values.y !== undefined) {
        this.set(`${registered.target}.y`, values.y);
        this.setElementProp(registered.target, 'y', values.y);
      }
    }
    if (values.scaleX !== undefined) {
      this.set(`${registered.target}.scaleX`, values.scaleX);
      this.setElementProp(registered.target, 'scaleX', values.scaleX);
    }
    if (values.scaleY !== undefined) {
      this.set(`${registered.target}.scaleY`, values.scaleY);
      this.setElementProp(registered.target, 'scaleY', values.scaleY);
    }
    if (values.alpha !== undefined) {
      this.set(`${registered.target}.alpha`, values.alpha);
      this.setElementProp(registered.target, 'alpha', values.alpha);
    }
    if (values.rotation !== undefined) {
      this.set(`${registered.target}.rotation`, values.rotation);
      this.setElementProp(registered.target, 'rotation', values.rotation);
    }
  }

  private evaluatePropertyAnimationValues(animation: WmrPropertyAnimation, currentTime: number): {
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
    alpha?: number;
    rotation?: number;
  } {
    const frames = this.getAnimationTimeline(animation);
    if (frames.length === 0) return {};
    const current = currentTime <= frames[0].time
      ? frames[0]
      : frames.find((frame) => currentTime <= frame.time) ?? frames[frames.length - 1];
    const prevIndex = Math.max(0, frames.indexOf(current) - 1);
    const prev = frames[prevIndex];
    const span = Math.max(1, current.time - prev.time);
    const linearT = current === prev ? 0 : Math.max(0, Math.min(1, (currentTime - prev.time) / span));
    const easeFn = resolveEasing(current.easeType);
    const t = easeFn(linearT);
    const interpolate = (fromExpr: ExprNode | undefined, toExpr: ExprNode | undefined) => {
      if (fromExpr === undefined && toExpr === undefined) return undefined;
      const from = fromExpr === undefined ? toNum(evalExpr(toExpr ?? compileExpr('0'), this)) : toNum(evalExpr(fromExpr, this));
      const to = toExpr === undefined ? from : toNum(evalExpr(toExpr, this));
      return from + (to - from) * t;
    };
    if (animation.kind === 'position') {
      return {
        x: interpolate(prev.x, current.x),
        y: interpolate(prev.y, current.y),
      };
    }
    if (animation.kind === 'scale') {
      return {
        scaleX: interpolate(prev.scaleX ?? prev.value, current.scaleX ?? current.value),
        scaleY: interpolate(prev.scaleY ?? prev.value, current.scaleY ?? current.value),
      };
    }
    if (animation.kind === 'alpha') {
      return {
        alpha: interpolate(prev.alpha ?? prev.value, current.alpha ?? current.value),
      };
    }
    return {
      rotation: interpolate(prev.rotation ?? prev.value, current.rotation ?? current.value),
    };
  }

  /** Inject weather / external data variables. */
  setProviderData(data: Record<string, VarValue>): void {
    for (const [k, v] of Object.entries(data)) {
      this.vars.set(k, v);
    }
  }

  setProviderArrayData(data: Record<string, VarValue[]>): void {
    for (const [k, v] of Object.entries(data)) {
      this.arrays.set(k, v);
    }
  }

  // ---- WmrVarContext interface ----

  get(name: string): VarValue {
    return this.vars.get(name) ?? 0;
  }

  has(name: string): boolean {
    return this.vars.has(name);
  }

  getStr(name: string): string {
    const v = this.vars.get(name);
    if (v === undefined) return '';
    return toStr(v);
  }

  getNum(name: string): number {
    const v = this.vars.get(name);
    if (v === undefined) return 0;
    return toNum(v);
  }

  set(name: string, value: VarValue): void {
    this.vars.set(name, value);
  }

  setArray(name: string, value: VarValue[]): void {
    this.arrays.set(name, value);
  }

  getElementProp(element: string, prop: string): number {
    return this.elementProps.get(`${element}.${prop}`) ?? 0;
  }

  setElementProp(element: string, prop: string, value: number): void {
    this.elementProps.set(`${element}.${prop}`, value);
  }

  getArray(name: string): VarValue[] {
    return this.arrays.get(name) ?? [];
  }

  persistVar(name: string, value: VarValue): void {
    this.persistStore.set(name, value);
    this.vars.set(name, value);
    this.flushPersistedVars();
  }

  private restorePersistedVars(): void {
    if (typeof window === 'undefined' || !('localStorage' in window)) return;
    try {
      const raw = window.localStorage.getItem(this.persistStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, VarValue>;
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' || typeof value === 'number') {
          this.persistStore.set(key, value);
        }
      }
    } catch {
      // 忽略坏数据，避免阻塞小组件渲染。
    }
  }

  private flushPersistedVars(): void {
    if (typeof window === 'undefined' || !('localStorage' in window)) return;
    try {
      const payload = Object.fromEntries(this.persistStore.entries());
      window.localStorage.setItem(this.persistStorageKey, JSON.stringify(payload));
    } catch {
      // localStorage 不可用时保持内存态即可。
    }
  }
}

// ---------------------------------------------------------------------------
// DateTime format helper  (Java SimpleDateFormat subset used by WMR)
// ---------------------------------------------------------------------------

/**
 * Format a Date using WMR's DateTime format strings.
 * Supports: HH, hh, H, h, mm, ss, M, d, yyyy, yy, EEEE, E, aa, a,
 *           A (生肖年), YY (干支年), N (lunar month), NNNN (农历), e (lunar day), D (day of year)
 */
export function formatDateTime(fmt: string, date: Date): string {
  const h24 = date.getHours();
  const h12 = h24 % 12 || 12;
  const m = date.getMinutes();
  const s = date.getSeconds();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const dow = date.getDay();

  const weekFull = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
  const weekShort = ['周日','周一','周二','周三','周四','周五','周六'];
  const ampm = h24 < 12 ? '上午' : '下午';

  const localizedAmpm = localeApi.getLocale() === 'en' ? (h24 < 12 ? 'AM' : 'PM') : ampm;
  if (localeApi.getLocale() === 'en') {
    weekFull.splice(0, weekFull.length, 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday');
    weekShort.splice(0, weekShort.length, 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat');
  }

  // Day of year
  const startOfYearDate = TimeService.fromTimestamp(date.getTime());
  startOfYearDate.setMonth(0, 1);
  startOfYearDate.setHours(0, 0, 0, 0);
  const startOfYear = startOfYearDate.getTime();
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86400000) + 1;

  // Approximate lunar calendar (simplified, good enough for display)
  const zodiacYear = getZodiacYearName(year);
  const lunarYear = getLunarYearName(year);
  const lunarInfo = getLunarInfo(date);

  let result = fmt;
  // Order matters: longer patterns first
  result = result.replace(/yyyy/g, String(year));
  result = result.replace(/yy/g, String(year % 100).padStart(2, '0'));
  result = result.replace(/EEEE/g, weekFull[dow]);
  result = result.replace(/EE/g, weekShort[dow]);
  result = result.replace(/E(?!E)/g, weekShort[dow]);
  result = result.replace(/NNNN/g, lunarInfo.full);
  result = result.replace(/N(?!N)/g, lunarInfo.monthName);
  result = result.replace(/A/g, zodiacYear);
  result = result.replace(/YY/g, lunarYear);
  result = result.replace(/HH/g, String(h24).padStart(2, '0'));
  result = result.replace(/H(?!H)/g, String(h24));
  result = result.replace(/hh/g, String(h12).padStart(2, '0'));
  result = result.replace(/h(?!h)/g, String(h12));
  result = result.replace(/mm/g, String(m).padStart(2, '0'));
  result = result.replace(/ss/g, String(s).padStart(2, '0'));
  result = result.replace(/dd/g, String(day).padStart(2, '0'));
  result = result.replace(/d(?!d)/g, String(day));
  result = result.replace(/MM/g, String(month).padStart(2, '0'));
  result = result.replace(/M(?!M)/g, String(month));
  result = result.replace(/aa/g, localizedAmpm);
  result = result.replace(/a(?!a)/g, localizedAmpm);
  result = result.replace(/D/g, String(dayOfYear));
  result = result.replace(/e/g, lunarInfo.dayStr);

  return result;
}

function getLunarYearName(year: number): string {
  const idx = getCycleIndex(year - 4, 60);
  return LUNAR_HEAVENLY[idx % 10] + LUNAR_EARTHLY[idx % 12];
}

function getZodiacYearName(year: number): string {
  return LUNAR_ANIMALS[getCycleIndex(year - 4, 12)];
}

function getApproxLunar(date: Date): { monthName: string; dayStr: string; full: string } {
  // 回退方案：仅在 Intl 农历不可用时启用
  const base = TimeService.fromLocalParts(2024, 1, 10).getTime();
  let diff = Math.floor((date.getTime() - base) / 86400000);
  if (diff < 0) diff = 0;
  const lunarMonthLen = 29.5;
  const totalMonths = Math.floor(diff / lunarMonthLen);
  const lunarMonth = totalMonths % 12;
  const lunarDay = Math.floor(diff - totalMonths * lunarMonthLen);

  const monthName = LUNAR_MONTHS[lunarMonth];
  const dayIdx = Math.max(0, Math.min(lunarDay, 29));
  const dayStr = (dayIdx === 0 ? '初一' : LUNAR_DAYS_P[dayIdx] + LUNAR_DAYS_S[dayIdx]);
  const yearName = getLunarYearName(date.getFullYear());
  return { monthName, dayStr, full: `${yearName}年 ${monthName}月${dayStr}` };
}

function getLunarDayText(day: number): string {
  const clamped = Math.max(1, Math.min(day, 30));
  if (clamped === 10) return '初十';
  if (clamped === 20) return '二十';
  if (clamped === 30) return '三十';
  return LUNAR_DAYS_P[clamped - 1] + LUNAR_DAYS_S[clamped - 1];
}

function getLunarInfo(date: Date): { monthName: string; dayStr: string; full: string } {
  try {
    const formatter = new Intl.DateTimeFormat('zh-Hans-CN-u-ca-chinese', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const parts = formatter.formatToParts(date);
    const yearName = parts.find((part) => String(part.type) === 'yearName')?.value ?? getLunarYearName(date.getFullYear());
    const rawMonth = parts.find((part) => part.type === 'month')?.value ?? '正月';
    const dayValue = parts.find((part) => part.type === 'day')?.value ?? '1';
    const monthName = rawMonth.endsWith('月') ? rawMonth.slice(0, -1) : rawMonth;
    const dayNum = parseInt(dayValue, 10);
    const dayStr = Number.isFinite(dayNum) ? getLunarDayText(dayNum) : '初一';
    return {
      monthName,
      dayStr,
      full: `${yearName}年 ${monthName}月${dayStr}`,
    };
  } catch {
    return getApproxLunar(date);
  }
}
