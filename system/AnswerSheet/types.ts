/** 答题卡表单字段定义 */
export interface Field {
  label: string;
  type: 'choice' | 'number' | 'text';
  options?: string[];
  hint?: string;
  repeatable?: boolean;
  /** 判定语义（前端不使用，仅透传给 bench_env judge） */
  matcher?: 'exact' | 'number' | 'date' | 'time' | 'duration';
  /** repeatable 时的比较方式（前端不使用） */
  compare?: 'sequence' | 'set';
}

/** 答题卡应用状态 */
export interface AnswerSheetState {
  question: string | null;
  hint: string | null;
  fields: Field[];
  answers: Record<string, string | string[]>;
  submitted: boolean;
}
