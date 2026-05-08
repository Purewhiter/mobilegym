export type Primitive = string | number | boolean | null;

export interface LocalStateDeclaration {
  id: string;
  description: string;
  blocking?: boolean;
  persistence?: 'none' | 'routeEntry' | 'session';
  enterBy?: Array<{ kind: 'action' | 'transition'; id: string }>;
  exitBy?: Array<{ kind: 'action' | 'transition'; id: string }>;
  notes?: string;
}

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

export interface ActionDeclaration {
  id: string;
  label: string;
  description?: string;
  behavior: 'toggle' | 'select' | 'submit' | 'input' | 'other';
  scope?: 'item';
  paramsSchema?: Record<string, 'string' | 'number' | 'boolean'>;
  condition?: StateCondition;
  effects?: ActionEffect[];
}

export interface RouteDeclaration {
  path: string;
  component: string;
  params: Record<string, 'string' | 'number'>;
  entryPoint: EntryPointDeclaration;
  scrollContainers?: readonly ScrollContainerDeclaration[];
  uiStates: Array<{
    id: string;
    search: Record<string, string | null>;
    description: string;
    actions?: ActionDeclaration[];
    localStates?: LocalStateDeclaration[];
    stateCondition?: StateCondition;
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
    placement: 'topbar' | 'tabbar' | 'content' | 'fab' | 'none';
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
