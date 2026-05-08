/**
 * WMR (Markup Animation Markup Language) engine types.
 * Covers the XML element model, expression AST, and runtime variable context.
 */

// ---------------------------------------------------------------------------
// XML element model (output of parser)
// ---------------------------------------------------------------------------

export type WmrAlign = 'left' | 'center' | 'right';
export type WmrAlignV = 'top' | 'center' | 'bottom';
export type WmrRootTag = 'Clock' | 'Widget';

/** Common positional / visual attributes shared by most layout elements. */
export interface WmrBaseAttrs {
  name?: string;
  x?: string;       // expression
  y?: string;       // expression
  centerX?: string; // expression
  centerY?: string; // expression
  w?: string;       // expression
  h?: string;       // expression
  width?: string;   // alias of w
  height?: string;  // alias of h
  scale?: string;
  align?: WmrAlign;
  alignV?: WmrAlignV;
  alpha?: string;    // expression (0-255)
  visibility?: string; // expression – truthy = visible
  pivotX?: string;
  pivotY?: string;
  scaleX?: string;
  scaleY?: string;
  rotation?: string;
  animations?: WmrPropertyAnimation[];
}

export interface WmrRoot {
  tag: WmrRootTag;
  attrs: {
    frameRate?: string;
    screenWidth?: string;
    width?: string;
    height?: string;
    resDensity?: string;
    scaleByDensity?: string;
    useVariableUpdater?: string;
    version?: string;
  };
  children: WmrNode[];
  externalTriggers?: WmrTrigger[];
}

export interface WmrGroup extends WmrBaseAttrs {
  tag: 'Group';
  layered?: boolean;
  clip?: boolean;
  triggers?: WmrTrigger[];
  children: WmrNode[];
}

export interface WmrImage extends WmrBaseAttrs {
  tag: 'Image';
  src?: string;
  srcExp?: string;
  srcid?: string;    // expression – sprite frame index
  tint?: string;
  xfermode?: string;
  xfermodeNum?: string;
}

export interface WmrText extends WmrBaseAttrs {
  tag: 'Text';
  text?: string;     // static text
  textExp?: string;  // expression
  color?: string;
  size?: string;
  format?: string;
  paras?: string;
  bold?: boolean;
  fontFamily?: string;
  marqueeSpeed?: string;
  multiLine?: boolean;
}

export interface WmrDateTime extends WmrBaseAttrs {
  tag: 'DateTime';
  format?: string;
  formatExp?: string;  // expression
  value?: string;      // expression – epoch ms for non-current times
  color?: string;
  size?: string;
  bold?: boolean;
  fontFamily?: string;
  marqueeSpeed?: string;
}

export interface WmrRectangle extends WmrBaseAttrs {
  tag: 'Rectangle';
  fillColor?: string;
  fillShader?: {
    type: 'linearGradient';
    x?: string;
    y?: string;
    x1?: string;
    y1?: string;
    stops: Array<{
      color: string;
      position: string;
    }>;
  };
  cornerRadius?: string;
  strokeColor?: string;
  strokeWidth?: string;
  weight?: string;
  strokeAlign?: string;
  xfermodeNum?: string;
  triggers?: WmrTrigger[];
}

export interface WmrArc extends WmrBaseAttrs {
  tag: 'Arc';
  startAngle?: string;
  sweep?: string;
  strokeColor?: string;
  weight?: string;
  cap?: string;
  close?: string;
  strokeAlign?: string;
  fillColor?: string;
  xfermode?: string;
  xfermodeNum?: string;
}

export interface WmrCircle extends WmrBaseAttrs {
  tag: 'Circle';
  r?: string;
  fillColor?: string;
  strokeColor?: string;
  weight?: string;
  xfermode?: string;
  xfermodeNum?: string;
}

export interface WmrLine extends WmrBaseAttrs {
  tag: 'Line';
  x1?: string;
  y1?: string;
  strokeColor?: string;
  weight?: string;
  cap?: string;
}

export interface WmrButton extends WmrBaseAttrs {
  tag: 'Button';
  triggers: WmrTrigger[];
  children: WmrNode[];
  normalChildren?: WmrNode[];
  pressedChildren?: WmrNode[];
}

export interface WmrTrigger {
  action: string; // 'up' | 'double'
  condition?: string;
  commands: WmrCommand[];
}

export interface WmrIntentExtra {
  name: string;
  type?: string;
  expression?: string;
}

export type WmrCommand =
  | { type: 'intent'; action?: string; actionExp?: string; package?: string; packageExp?: string; class?: string; classExp?: string; broadcast?: boolean; condition?: string; delay?: number; extras?: WmrIntentExtra[]; fallback?: WmrCommand[] }
  | { type: 'variable'; name: string; expression: string; persist?: boolean; delay?: number; condition?: string; index?: string; valueType?: string }
  | { type: 'animation'; target: string; command: string; tags?: string; delay?: number; condition?: string }
  | { type: 'frameRate'; rate: string; delay?: number; condition?: string }
  | { type: 'binder'; name: string; command: string; delay?: number; condition?: string }
  | { type: 'function'; target: string; delay?: number; condition?: string }
  | { type: 'method'; target: string; targetType?: string; method: string; params?: string; paramTypes?: string; delay?: number; condition?: string }
  | { type: 'folme'; target: string; states?: string; config?: string; command: string; delay?: number; condition?: string }
  | { type: 'multi'; condition?: string; commands: WmrCommand[] }
  | { type: 'if'; condition?: string; consequent: WmrCommand[]; alternate?: WmrCommand[] }
  | { type: 'loop'; count: string; indexName?: string; condition?: string; commands: WmrCommand[] }
  | { type: 'extern'; command: string; condition?: string; delay?: number };

export interface WmrAniFrame {
  time: string;
  relative?: boolean;
  value?: string;
  x?: string;
  y?: string;
  scaleX?: string;
  scaleY?: string;
  alpha?: string;
  rotation?: string;
  easeType?: string;
}

export interface WmrVariableAnimation {
  name?: string;
  tag?: string;
  frames: WmrAniFrame[];
  loop?: boolean;
  initPause?: boolean;
  triggers?: WmrTrigger[];
}

export interface WmrPropertyAnimation {
  kind: 'position' | 'scale' | 'alpha' | 'rotation';
  name?: string;
  tag?: string;
  frames: WmrAniFrame[];
  loop?: boolean;
  initPause?: boolean;
  triggers?: WmrTrigger[];
}

export interface WmrVar {
  tag: 'Var';
  name: string;
  expression: string;
  type?: string;    // 'string' | 'number' | 'int'
  const?: boolean;
  index?: string;   // expression – for VarArray indexing
  values?: string[];
  persist?: boolean;
  threshold?: string;
  triggers?: WmrTrigger[];
  animation?: WmrVariableAnimation;
  animations?: WmrVariableAnimation[];
}

export interface WmrVarArray {
  tag: 'VarArray';
  name?: string;
  type?: string;
  vars: WmrVar[];
  items: string[];
}

export interface WmrContentProviderBinder {
  tag: 'ContentProviderBinder';
  name?: string;
  uri?: string;
  uriFormat?: string;
  uriParas?: string;
  columns?: string;
  countName?: string;
  dependency?: string;
  variables: WmrProviderVariable[];
  triggers: WmrProviderTrigger[];
}

export interface WmrProviderVariable {
  column: string;
  name: string;
  type: string;
  extra?: string;
  row?: string;
}

export interface WmrProviderTrigger {
  commands: WmrCommand[];
}

export interface WmrImageNumber extends WmrBaseAttrs {
  tag: 'ImageNumber';
  src?: string;
  textExp?: string;
}

export interface WmrMask extends WmrBaseAttrs {
  tag: 'Mask';
  children: WmrNode[];
}

export interface WmrArray extends WmrBaseAttrs {
  tag: 'Array';
  count?: string;
  indexName?: string;
  children: WmrNode[];
}

export interface WmrTime extends WmrBaseAttrs {
  tag: 'Time';
  src?: string;        // static sprite base path, e.g. "time/0/t.png"
  srcExp?: string;     // expression → sprite base path
  format?: string;     // static format, e.g. "HH:mm"
  formatExp?: string;  // expression → format
  space?: string;      // expression: spacing between character images
}

export interface WmrMusicControl extends WmrBaseAttrs {
  tag: 'MusicControl';
  children: WmrNode[];
}

export interface WmrFunction {
  tag: 'Function';
  name: string;
  commands: WmrCommand[];
}

export interface WmrVirtualElement extends WmrBaseAttrs {
  tag: 'VirtualElement';
  folmeMode?: boolean;
}

export interface WmrFolmeState {
  tag: 'FolmeState';
  name: string;
  x?: string;
  y?: string;
  alpha?: string;
  scaleX?: string;
  scaleY?: string;
  rotation?: string;
}

export interface WmrFolmeConfigSpecial {
  property: string;
  ease?: string;
}

export interface WmrFolmeConfig {
  tag: 'FolmeConfig';
  name: string;
  ease?: string;
  delay?: string;
  onComplete?: string;
  specials: WmrFolmeConfigSpecial[];
}

export interface WmrBroadcastBinder {
  tag: 'BroadcastBinder';
  action?: string;
  variables: WmrProviderVariable[];
  triggers?: WmrTrigger[];
}

export type WmrNode =
  | WmrGroup
  | WmrImage
  | WmrText
  | WmrDateTime
  | WmrRectangle
  | WmrArc
  | WmrCircle
  | WmrLine
  | WmrButton
  | WmrVar
  | WmrVarArray
  | WmrContentProviderBinder
  | WmrBroadcastBinder
  | WmrImageNumber
  | WmrMask
  | WmrArray
  | WmrTime
  | WmrMusicControl
  | WmrFunction
  | WmrVirtualElement
  | WmrFolmeState
  | WmrFolmeConfig;

// ---------------------------------------------------------------------------
// Expression AST
// ---------------------------------------------------------------------------

export type ExprNode =
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'numVar'; name: string }              // #varName
  | { kind: 'strVar'; name: string }              // @varName
  | { kind: 'arrayAccess'; name: string; index: ExprNode }  // @arr[idx]
  | { kind: 'propAccess'; element: string; prop: string }   // #el.prop
  | { kind: 'binary'; op: BinaryOp; left: ExprNode; right: ExprNode }
  | { kind: 'unary'; op: UnaryOp; operand: ExprNode }
  | { kind: 'call'; fn: string; args: ExprNode[] };

export type BinaryOp =
  | '+' | '-' | '*' | '/' | '%'
  | '==' | '!='
  | '>' | '<' | '>=' | '<='
  | '&&' | '||';

export type UnaryOp = '-' | '!';

// ---------------------------------------------------------------------------
// Runtime variable context
// ---------------------------------------------------------------------------

export type VarValue = number | string | boolean | null | Record<string, unknown> | unknown[];

export interface WmrVarContext {
  get(name: string): VarValue;
  has(name: string): boolean;
  getStr(name: string): string;
  getNum(name: string): number;
  set(name: string, value: VarValue): void;
  getElementProp(element: string, prop: string): number;
  setElementProp(element: string, prop: string, value: number): void;
  getArray(name: string): VarValue[];
  setArray(name: string, value: VarValue[]): void;
}

// ---------------------------------------------------------------------------
// Parsed WMR document
// ---------------------------------------------------------------------------

export interface WmrFramerateControlPoint {
  time: number;
  frameRate: number;
}

export interface WmrFramerateController {
  name: string;
  loop?: boolean;
  initPause?: boolean;
  controlPoints: WmrFramerateControlPoint[];
}

export interface WmrProviderDependencies {
  weather: boolean;
  device: boolean;
  clock: boolean;
  music: boolean;
  hostFlags: boolean;
}

export interface WmrDocument {
  root: WmrRoot;
  designWidth: number;
  designHeight?: number;
  frameRate: number;
  useVariableUpdater: string[];
  framerateControllers: WmrFramerateController[];
}
