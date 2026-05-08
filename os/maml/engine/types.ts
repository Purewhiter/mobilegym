/**
 * MAML (Markup Animation Markup Language) engine types.
 * Covers the XML element model, expression AST, and runtime variable context.
 */

// ---------------------------------------------------------------------------
// XML element model (output of parser)
// ---------------------------------------------------------------------------

export type MamlAlign = 'left' | 'center' | 'right';
export type MamlAlignV = 'top' | 'center' | 'bottom';
export type MamlRootTag = 'Clock' | 'Widget';

/** Common positional / visual attributes shared by most layout elements. */
export interface MamlBaseAttrs {
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
  align?: MamlAlign;
  alignV?: MamlAlignV;
  alpha?: string;    // expression (0-255)
  visibility?: string; // expression – truthy = visible
  pivotX?: string;
  pivotY?: string;
  scaleX?: string;
  scaleY?: string;
  rotation?: string;
  animations?: MamlPropertyAnimation[];
}

export interface MamlRoot {
  tag: MamlRootTag;
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
  children: MamlNode[];
  externalTriggers?: MamlTrigger[];
}

export interface MamlGroup extends MamlBaseAttrs {
  tag: 'Group';
  layered?: boolean;
  clip?: boolean;
  triggers?: MamlTrigger[];
  children: MamlNode[];
}

export interface MamlImage extends MamlBaseAttrs {
  tag: 'Image';
  src?: string;
  srcExp?: string;
  srcid?: string;    // expression – sprite frame index
  tint?: string;
  xfermode?: string;
  xfermodeNum?: string;
}

export interface MamlText extends MamlBaseAttrs {
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

export interface MamlDateTime extends MamlBaseAttrs {
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

export interface MamlRectangle extends MamlBaseAttrs {
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
  triggers?: MamlTrigger[];
}

export interface MamlArc extends MamlBaseAttrs {
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

export interface MamlCircle extends MamlBaseAttrs {
  tag: 'Circle';
  r?: string;
  fillColor?: string;
  strokeColor?: string;
  weight?: string;
  xfermode?: string;
  xfermodeNum?: string;
}

export interface MamlLine extends MamlBaseAttrs {
  tag: 'Line';
  x1?: string;
  y1?: string;
  strokeColor?: string;
  weight?: string;
  cap?: string;
}

export interface MamlButton extends MamlBaseAttrs {
  tag: 'Button';
  triggers: MamlTrigger[];
  children: MamlNode[];
  normalChildren?: MamlNode[];
  pressedChildren?: MamlNode[];
}

export interface MamlTrigger {
  action: string; // 'up' | 'double'
  condition?: string;
  commands: MamlCommand[];
}

export interface MamlIntentExtra {
  name: string;
  type?: string;
  expression?: string;
}

export type MamlCommand =
  | { type: 'intent'; action?: string; actionExp?: string; package?: string; packageExp?: string; class?: string; classExp?: string; broadcast?: boolean; condition?: string; delay?: number; extras?: MamlIntentExtra[]; fallback?: MamlCommand[] }
  | { type: 'variable'; name: string; expression: string; persist?: boolean; delay?: number; condition?: string; index?: string; valueType?: string }
  | { type: 'animation'; target: string; command: string; tags?: string; delay?: number; condition?: string }
  | { type: 'frameRate'; rate: string; delay?: number; condition?: string }
  | { type: 'binder'; name: string; command: string; delay?: number; condition?: string }
  | { type: 'function'; target: string; delay?: number; condition?: string }
  | { type: 'method'; target: string; targetType?: string; method: string; params?: string; paramTypes?: string; delay?: number; condition?: string }
  | { type: 'folme'; target: string; states?: string; config?: string; command: string; delay?: number; condition?: string }
  | { type: 'multi'; condition?: string; commands: MamlCommand[] }
  | { type: 'if'; condition?: string; consequent: MamlCommand[]; alternate?: MamlCommand[] }
  | { type: 'loop'; count: string; indexName?: string; condition?: string; commands: MamlCommand[] }
  | { type: 'extern'; command: string; condition?: string; delay?: number };

export interface MamlAniFrame {
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

export interface MamlVariableAnimation {
  name?: string;
  tag?: string;
  frames: MamlAniFrame[];
  loop?: boolean;
  initPause?: boolean;
  triggers?: MamlTrigger[];
}

export interface MamlPropertyAnimation {
  kind: 'position' | 'scale' | 'alpha' | 'rotation';
  name?: string;
  tag?: string;
  frames: MamlAniFrame[];
  loop?: boolean;
  initPause?: boolean;
  triggers?: MamlTrigger[];
}

export interface MamlVar {
  tag: 'Var';
  name: string;
  expression: string;
  type?: string;    // 'string' | 'number' | 'int'
  const?: boolean;
  index?: string;   // expression – for VarArray indexing
  values?: string[];
  persist?: boolean;
  threshold?: string;
  triggers?: MamlTrigger[];
  animation?: MamlVariableAnimation;
  animations?: MamlVariableAnimation[];
}

export interface MamlVarArray {
  tag: 'VarArray';
  name?: string;
  type?: string;
  vars: MamlVar[];
  items: string[];
}

export interface MamlContentProviderBinder {
  tag: 'ContentProviderBinder';
  name?: string;
  uri?: string;
  uriFormat?: string;
  uriParas?: string;
  columns?: string;
  countName?: string;
  dependency?: string;
  variables: MamlProviderVariable[];
  triggers: MamlProviderTrigger[];
}

export interface MamlProviderVariable {
  column: string;
  name: string;
  type: string;
  extra?: string;
  row?: string;
}

export interface MamlProviderTrigger {
  commands: MamlCommand[];
}

export interface MamlImageNumber extends MamlBaseAttrs {
  tag: 'ImageNumber';
  src?: string;
  textExp?: string;
}

export interface MamlMask extends MamlBaseAttrs {
  tag: 'Mask';
  children: MamlNode[];
}

export interface MamlArray extends MamlBaseAttrs {
  tag: 'Array';
  count?: string;
  indexName?: string;
  children: MamlNode[];
}

export interface MamlTime extends MamlBaseAttrs {
  tag: 'Time';
  src?: string;        // static sprite base path, e.g. "time/0/t.png"
  srcExp?: string;     // expression → sprite base path
  format?: string;     // static format, e.g. "HH:mm"
  formatExp?: string;  // expression → format
  space?: string;      // expression: spacing between character images
}

export interface MamlMusicControl extends MamlBaseAttrs {
  tag: 'MusicControl';
  children: MamlNode[];
}

export interface MamlFunction {
  tag: 'Function';
  name: string;
  commands: MamlCommand[];
}

export interface MamlVirtualElement extends MamlBaseAttrs {
  tag: 'VirtualElement';
  folmeMode?: boolean;
}

export interface MamlFolmeState {
  tag: 'FolmeState';
  name: string;
  x?: string;
  y?: string;
  alpha?: string;
  scaleX?: string;
  scaleY?: string;
  rotation?: string;
}

export interface MamlFolmeConfigSpecial {
  property: string;
  ease?: string;
}

export interface MamlFolmeConfig {
  tag: 'FolmeConfig';
  name: string;
  ease?: string;
  delay?: string;
  onComplete?: string;
  specials: MamlFolmeConfigSpecial[];
}

export interface MamlBroadcastBinder {
  tag: 'BroadcastBinder';
  action?: string;
  variables: MamlProviderVariable[];
  triggers?: MamlTrigger[];
}

export type MamlNode =
  | MamlGroup
  | MamlImage
  | MamlText
  | MamlDateTime
  | MamlRectangle
  | MamlArc
  | MamlCircle
  | MamlLine
  | MamlButton
  | MamlVar
  | MamlVarArray
  | MamlContentProviderBinder
  | MamlBroadcastBinder
  | MamlImageNumber
  | MamlMask
  | MamlArray
  | MamlTime
  | MamlMusicControl
  | MamlFunction
  | MamlVirtualElement
  | MamlFolmeState
  | MamlFolmeConfig;

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

export interface MamlVarContext {
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
// Parsed MAML document
// ---------------------------------------------------------------------------

export interface MamlFramerateControlPoint {
  time: number;
  frameRate: number;
}

export interface MamlFramerateController {
  name: string;
  loop?: boolean;
  initPause?: boolean;
  controlPoints: MamlFramerateControlPoint[];
}

export interface MamlProviderDependencies {
  weather: boolean;
  device: boolean;
  clock: boolean;
  music: boolean;
  hostFlags: boolean;
}

export interface MamlDocument {
  root: MamlRoot;
  designWidth: number;
  designHeight?: number;
  frameRate: number;
  useVariableUpdater: string[];
  framerateControllers: MamlFramerateController[];
}
