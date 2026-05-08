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
 * 原地动作声明
 *
 * 描述页面上不引起导航的可执行动作。
 * actionId 在 app 内全局唯一。
 */
export interface ActionDeclaration {
  /** app 内唯一的动作标识 */
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

  /** 可选：入口显示条件 */
  condition?: StateCondition;

  /**
   * 可选：动作副作用（仅语义，不改变 URL）
   * 典型：点击“关注” -> 关注成功 + 打开“你可能感兴趣”非阻塞面板
   */
  effects?: ActionEffect[];
}

export type StateCondition =
  // v0.8: 组合条件
  | { op: 'always'; text?: string }
  | { op: 'and'; items: StateCondition[]; text?: string }
  | { op: 'or'; items: StateCondition[]; text?: string }
  | { op: 'not'; item: StateCondition; text?: string }
  // v0.5: 基础条件（历史兼容）
  | { op: 'equals'; ref: string; value: Primitive; text?: string }
  | { op: 'notEquals'; ref: string; value: Primitive; text?: string }
  | { op: 'notEmpty'; ref: string; filterFn?: string; text?: string }
  | { op: 'empty'; ref: string; filterFn?: string; text?: string }
  | { op: 'memberOf'; ref: string; param: string; field?: string; filterFn?: string; text?: string }
  // v0.8: 参数 vs 数据 ref 比较
  | { op: 'paramEq'; param: string; ref: string; text?: string }
  | { op: 'paramNeq'; param: string; ref: string; text?: string };

export interface RouteDeclaration {
  path: string;
  component: string;
  params: Record<string, 'string' | 'number'>;
  /**
   * 入口声明（向后兼容 boolean）：
   * - 'home'：应用首页入口（用于图的默认起点）
   * - 'deepLink'：允许外部链接直达（Deep Link）
   * - 'both'：既是首页入口，又允许外部链接直达
   * - 'none'：都不允许
   * - boolean：历史写法；true 等价于 'deepLink'，false 等价于 'none'
   */
  entryPoint: EntryPointDeclaration;
  scrollContainers: ScrollContainerDeclaration[];
  uiStates: Array<{
    id: string;
    search: Record<string, string | null>;
    description: string;
    stateCondition?: StateCondition;
    actions?: ActionDeclaration[];
    /** 本地子状态（可选，不进入 URL / 不形成图节点） */
    localStates?: LocalStateDeclaration[];
  }>;
  queryParams: Record<string, 'string' | 'number'>;
  description: string;
}

export type EntryPointDeclaration = 'none' | 'home' | 'deepLink' | 'both';

export interface ScrollContainerDeclaration {
  name: string;
  direction: 'vertical' | 'horizontal';
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
  /**
   * 可选：边可用性（仅语义）
   * - always：总可用（默认）
   * - requires_prior_visit：依赖“此前访问记忆/曾经到达过”的恢复入口（图中保留但默认不用于首次路径）
   */
  availability?: EdgeAvailability;
  /** 可选：可用性备注（仅语义） */
  availabilityNote?: string;
  ui: {
    placement: 'topbar' | 'tabbar' | 'content' | 'fab' | 'none';
    icon: string;
    gesture: GestureType;
  };
}

export interface CaseDeclaration {
  to: string;
  search: Record<string, string | null>;
  searchParams?: Record<string, 'string' | 'number'>;
  when: Condition;
  /** 可选：分支边可用性（仅语义） */
  availability?: EdgeAvailability;
  /** 可选：分支可用性备注（仅语义） */
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
