export type Primitive = string | number | boolean | null;

/**
 * Local UI State（本地子状态）
 *
 * 描述“不进入 URL / 不形成导航图节点”的局部 UI 状态（如：非阻塞面板、toast、tooltip）。
 * 该状态通常与“某个 uiState 的动作/交互副作用”关联，用于文档/训练语义标注。
 */
export interface LocalStateDeclaration {
  /** app 内唯一标识（建议带父 uiState 前缀） */
  id: string;
  description: string;
  /** 是否阻塞底层交互：modal=true；非阻塞面板/气泡=false */
  blocking?: boolean;
  /**
   * 生命周期/记忆范围（可选，仅语义）
   * - routeEntry：绑定到 history entry（location.key），push/back 仍保留；entry 被 pop 后消失
   * - session：应用挂载期间保留
   * - none：不保留（一次性）
   */
  persistence?: 'none' | 'routeEntry' | 'session';
  /** 进入方式（纯语义，不参与路由/图生成） */
  enterBy?: Array<{ kind: 'action' | 'transition'; id: string }>;
  /** 退出方式（纯语义，不参与路由/图生成） */
  exitBy?: Array<{ kind: 'action' | 'transition'; id: string }>;
  notes?: string;
}

/**
 * Action 产生的可观测 UI 副作用（可选，仅语义）
 */
export type ActionEffect =
  | { kind: 'localState.open'; id: string }
  | { kind: 'localState.close'; id: string };

export interface NavigationDeclaration {
  app: string;
  routes: RouteDeclaration[];
  transitions: TransitionDeclaration[];
  capabilities: {
    historyBack: boolean;
  };
}

/**
 * 原地动作声明（Actions）
 *
 * 描述页面上不引起导航（不改变 URL/route）的可执行动作。
 * actionId 在 app 内全局唯一，并用于 UI 上的 data-action 打标。
 */
export interface ActionDeclaration {
  /** app 内唯一的动作标识，用于 data-action 打标 */
  id: string;
  /** 人类可读标签 */
  label: string;
  /** 可选：更详细的语义说明 */
  description?: string;
  /** 动作行为类型 */
  behavior: 'toggle' | 'select' | 'submit' | 'input' | 'other';
  /** 动作作用范围（不声明则为全局/页面级） */
  scope?: 'item';
  /** 参数 schema（scope='item' 时对象标识字段只允许 'string' | 'number'） */
  paramsSchema?: Record<string, 'string' | 'number' | 'boolean'>;
  /** 可选：入口显示条件（复用 StateCondition） */
  condition?: StateCondition;
  /** 可选：动作副作用（仅语义，不改变 URL） */
  effects?: ActionEffect[];
}

export interface RouteDeclaration {
  path: string;
  component: string;
  params: Record<string, 'string' | 'number'>;
  entryPoint: EntryPointDeclaration;
  /** 滚动容器声明（可选，仅用于文档，运行时通过 DOM 属性自动发现） */
  scrollContainers?: ScrollContainerDeclaration[];
  uiStates: Array<{
    id: string;
    search: Record<string, string | null>;
    description: string;
    /** 节点上的原地动作清单（可选） */
    actions?: ActionDeclaration[];
    /** 本地子状态（可选，不进入 URL / 不形成图节点） */
    localStates?: LocalStateDeclaration[];
    /** 状态存在条件（可选） */
    stateCondition?: StateCondition;
  }>;
  queryParams: Record<string, 'string' | 'number'>;
  description: string;
}

export type EntryPointDeclaration = 'none' | 'home' | 'deepLink' | 'both';

/**
 * 滚动容器声明（可选，仅用于文档）
 *
 * 运行时通过 DOM 的 data-scroll-container 属性自动发现，
 * 此声明仅用于静态分析和文档目的。
 */
export interface ScrollContainerDeclaration {
  /** 容器标识，对应 DOM 上的 data-scroll-container 属性值 */
  name: string;
  /** 滚动方向，对应 DOM 上的 data-scroll-direction 属性值 */
  direction: 'vertical' | 'horizontal';
  /** 描述 */
  description: string;
}

export type GestureType = 'tap' | 'longPress' | 'doubleTap' | 'back';

/**
 * Edge availability（边可用性语义）
 *
 * 用于表达“边存在，但并非总可用”（例如依赖历史访问记忆的恢复入口）。
 * 仅用于图/任务生成与可视化，不参与运行时判断。
 */
export type EdgeAvailability = 'always' | 'requires_prior_visit';

export interface TransitionDeclaration {
  id: string;
  from: '*' | string | FromConstraint | Array<'*' | string | FromConstraint>;
  to: string;
  search: Record<string, string | null>;
  searchParams: Record<string, 'string' | 'number'>;
  preserveParams?: string[];
  cases?: CaseDeclaration[];
  mode: 'push' | 'replace';
  params: Record<string, 'string' | 'number'>;
  label: string;
  availability?: EdgeAvailability;
  availabilityNote?: string;
  ui: {
    placement: 'topbar' | 'tabbar' | 'content' | 'fab' | 'none' | 'drawer';
    icon: string;
    gesture: GestureType;
    condition?: StateCondition;
  };
  dataSource?: DataSourceDeclaration | DataSourceDeclaration[];
}

export interface CaseDeclaration {
  to: string;
  search: Record<string, string | null>;
  searchParams?: Record<string, 'string' | 'number'>;
  when: Condition;
  availability?: EdgeAvailability;
  availabilityNote?: string;
}

export type Condition =
  | { op: 'always' }
  | { op: 'and'; items: Condition[] }
  | { op: 'or'; items: Condition[] }
  | { op: 'not'; item: Condition }
  | { op: 'exists'; ref: ValueRef }
  | { op: 'eq'; left: ValueRef; right: Primitive }
  | { op: 'in'; left: ValueRef; right: Primitive[] }
  | { op: 'match'; left: ValueRef; right: string }
  | { op: 'gt' | 'gte' | 'lt' | 'lte'; left: ValueRef; right: number };

export type ValueRef =
  | { ref: 'search'; key: string }
  | { ref: 'param'; key: string }
  | { ref: 'appState'; key: string };

export interface FromConstraint {
  path: string;
  search?: Record<string, string | '*' | null>;
}

// ============================================================
// DataSource & StateCondition（v0.4+ 设计）
// ============================================================

export interface DataSourceDeclaration {
  from?: '*' | string | FromConstraint;
  ref: string;
  paramMapping: Record<string, string>;
  labelField?: string;
  filterFn?: string;
}

export type StateCondition =
  | { op: 'always'; text?: string }
  | { op: 'and'; items: StateCondition[]; text?: string }
  | { op: 'or'; items: StateCondition[]; text?: string }
  | { op: 'not'; item: StateCondition; text?: string }
  | {
      op: 'memberOf';
      ref: string;
      param: string;
      field?: string;
      filterFn?: string;
      text?: string;
    }
  | {
      op: 'eq';
      ref: string;
      equals: Primitive;
      text?: string;
    }
  | {
      op: 'notEmpty';
      ref: string;
      filterFn?: string;
      text?: string;
    }
  | {
      op: 'paramEq';
      param: string;
      ref: string;
      text?: string;
    }
  | {
      op: 'paramNeq';
      param: string;
      ref: string;
      text?: string;
    };
