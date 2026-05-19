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
 *
 * 设计文档：docs/platform/declarative-navigation.md ("Actions" 章节)
 */
export interface ActionDeclaration {
  /** app 内唯一的动作标识，用于 data-action 打标 */
  id: string;

  /** 人类可读标签 */
  label: string;

  /** 可选：更详细的语义说明 */
  description?: string;

  /** 动作行为类型 */
  behavior: 'toggle' | 'select' | 'submit' | 'input' | 'open' | 'close' | 'modify' | 'other';

  /** 动作作用范围（不声明则为全局/页面级） */
  scope?: 'item';

  /** 参数 schema（scope='item' 时对象标识字段只允许 'string' | 'number'） */
  paramsSchema?: Record<string, 'string' | 'number' | 'boolean'>;

  /** 可选：入口显示条件（复用 StateCondition） */
  condition?: StateCondition;

  /**
   * 可选：动作副作用（仅语义，不改变 URL）
   * 典型：点击“关注” -> 关注成功 + 打开“你可能感兴趣”非阻塞面板
   */
  effects?: ActionEffect[];
}

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
  /** 滚动容器声明（可选，仅用于文档，运行时通过 DOM 属性自动发现） */
  scrollContainers?: readonly ScrollContainerDeclaration[];
  uiStates: Array<{
    id: string;
    search: Record<string, string | null>;
    description: string;
    /** 节点上的原地动作清单（可选） */
    actions?: ActionDeclaration[];
    /** 本地子状态（可选，不进入 URL / 不形成图节点） */
    localStates?: LocalStateDeclaration[];
    /**
     * 状态存在条件（可选）
     *
     * 描述该 UI 状态在什么数据条件下存在。
     * Schema 模式：节点存在，标注条件
     * Data 模式：根据条件评估决定节点是否生成
     */
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
    /**
     * 入口显示条件（可选）
     *
     * 描述触发此跳转的 UI 入口在什么数据条件下显示。
     * Schema 模式：边存在，标注条件
     * Data 模式：根据条件评估决定边是否生成
     */
    condition?: StateCondition;
  };

  /**
   * 数据源声明（可选）
   *
   * 描述动态参数的值从哪个数据集合获取。
   * 用于静态分析时将图展开为具体节点。
   */
  dataSource?: DataSourceDeclaration | DataSourceDeclaration[];
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

// ============================================================
// DataSource & StateCondition（v0.4+ 设计）
// ============================================================

/**
 * 数据源声明
 *
 * 描述 transition 的动态参数值从哪个数据集合获取。
 * 用于静态分析时将图展开为具体节点。
 */
export interface DataSourceDeclaration {
  /**
   * 适用的来源约束
   *
   * 复用 FromConstraint 语法。
   * 当 transition 有多个 from 时，使用此字段精确匹配。
   */
  from?: '*' | string | FromConstraint;

  /**
   * 数据引用路径（点分隔）
   *
   * 指向配置文件中的数据集合。
   * 示例：'chats', 'contacts', 'moments'
   */
  ref: string;

  /**
   * 参数映射（仅限 path params）
   *
   * key: transition 的 params 中的参数名
   * value: 数据对象中的字段名，或 '$value' 表示元素本身
   */
  paramMapping: Record<string, string>;

  /**
   * 标签字段（可选）
   *
   * 用于在展开的图中显示有意义的标签。
   */
  labelField?: string;

  /**
   * 过滤函数（可选）
   *
   * 用于复杂的跨数据源过滤逻辑。
   * 函数签名：(item: any, data: ConfigData) => boolean
   */
  filterFn?: string;
}

/**
 * 状态条件声明（v0.5）
 *
 * 描述 UI 状态/入口在什么数据条件下存在/显示。
 * 所有条件都基于配置数据，使用统一的 ref 语法。
 *
 * 应用位置：
 * - uiStates[].stateCondition: 状态节点是否存在
 * - ui.condition: 跳转入口是否显示
 */
export type StateCondition =
  // v0.8: 组合条件（推荐写法：用 not + paramEq 表达“不等于”）
  | { op: 'always'; text?: string }
  | { op: 'and'; items: StateCondition[]; text?: string }
  | { op: 'or'; items: StateCondition[]; text?: string }
  | { op: 'not'; item: StateCondition; text?: string }
  // v0.5: 基础条件（保持兼容）
  | {
      /** 参数在集合中时显示（典型：入口条件） */
      op: 'memberOf';
      ref: string;
      param: string;
      field?: string;
      filterFn?: string;
      text?: string;
    }
  | {
      /** 数据 ref 的值等于常量 */
      op: 'eq';
      ref: string;
      equals: Primitive;
      text?: string;
    }
  | {
      /** 集合非空（可选 filterFn 过滤后判断） */
      op: 'notEmpty';
      ref: string;
      filterFn?: string;
      text?: string;
    }
  // v0.8: 参数 vs 数据 ref 比较（用于“自己/他人”这种入口条件）
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

