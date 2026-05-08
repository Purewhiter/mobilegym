import { createAppStoreWithActions } from '../../os/createAppStore';
import { evaluate } from './utils/evaluator';
import { appendToken, appendFunction, deleteLastChar, type CalcState } from './utils/expressionBuilder';
import { localize, normalize } from './utils/tokenizer';
import { ANIM_DURATION } from './constants';

// ========== Types ==========

interface AnimationCallbacks {
  onResultAnimation?: (result: string, formulaText: string) => void;
  onClearAnimation?: (sourceButton: 'del' | 'clr') => void;
  onErrorAnimation?: (errorMsg: string) => void;
}

interface Calculator2State {
  state: CalcState;
  formula: string;
  result: string;
}

interface Calculator2Actions {
  inputDigit: (digit: string) => void;
  inputDecimal: () => void;
  inputOperator: (op: string) => void;
  inputFunction: (name: string) => void;
  inputConstant: (value: string) => void;
  inputParen: (paren: '(' | ')') => void;
  onDelete: () => void;
  onClear: () => void;
  onEvaluate: () => void;
  setAnimCallbacks: (cbs: AnimationCallbacks) => void;
}

// ========== Mutable internal refs (non-reactive) ==========

let _isEdited = false;
let _animCallbacks: AnimationCallbacks = {};

// ========== Helpers ==========

/** 实时求值（INPUT 态每次公式变化时） */
function liveEvaluate(formula: string) {
  if (!formula) {
    useCalculator2Store.setState({ result: '' });
    return;
  }
  const evalResult = evaluate(formula);
  useCalculator2Store.setState({ result: evalResult.kind === 'success' ? evalResult.value : '' });
}

// ========== Store ==========

const initialState: Calculator2State = {
  state: 'INPUT' as CalcState,
  formula: '',
  result: '',
};

export const useCalculator2Store = createAppStoreWithActions<Calculator2State, Calculator2Actions>(
  'calculator2',
  initialState,
  (set, get) => ({
    inputDigit: (digit: string) => {
      const cur = get();
      const [newFormula, edited] = appendToken(cur.formula, digit, cur.state, _isEdited);
      _isEdited = edited;
      const newState = (cur.state === 'RESULT' || cur.state === 'ERROR') ? 'INPUT' as CalcState : cur.state;
      set({ formula: newFormula, state: newState });
      requestAnimationFrame(() => liveEvaluate(newFormula));
    },

    inputDecimal: () => {
      const cur = get();
      const [newFormula, edited] = appendToken(cur.formula, '.', cur.state, _isEdited);
      _isEdited = edited;
      const newState = (cur.state === 'RESULT' || cur.state === 'ERROR') ? 'INPUT' as CalcState : cur.state;
      set({ formula: newFormula, state: newState });
      requestAnimationFrame(() => liveEvaluate(newFormula));
    },

    inputOperator: (op: string) => {
      const cur = get();
      const [newFormula, edited] = appendToken(cur.formula, op, cur.state, _isEdited);
      _isEdited = edited;
      const newState = (cur.state === 'RESULT' || cur.state === 'ERROR') ? 'INPUT' as CalcState : cur.state;
      set({ formula: newFormula, state: newState });
      requestAnimationFrame(() => liveEvaluate(newFormula));
    },

    inputFunction: (name: string) => {
      const cur = get();
      const [newFormula, edited] = appendFunction(cur.formula, name, cur.state, _isEdited);
      _isEdited = edited;
      const newState = (cur.state === 'RESULT' || cur.state === 'ERROR') ? 'INPUT' as CalcState : cur.state;
      set({ formula: newFormula, state: newState });
      requestAnimationFrame(() => liveEvaluate(newFormula));
    },

    inputConstant: (value: string) => {
      const cur = get();
      const norm = normalize(cur.formula);
      let newNorm: string;
      if ((cur.state === 'RESULT' || cur.state === 'ERROR') && !_isEdited) {
        newNorm = value;
      } else {
        newNorm = norm + value;
      }
      _isEdited = true;
      const newState = (cur.state === 'RESULT' || cur.state === 'ERROR') ? 'INPUT' as CalcState : cur.state;
      const newFormula = localize(newNorm);
      set({ formula: newFormula, state: newState });
      requestAnimationFrame(() => liveEvaluate(newFormula));
    },

    inputParen: (paren: '(' | ')') => {
      const cur = get();
      const [newFormula, edited] = appendToken(cur.formula, paren, cur.state, _isEdited);
      _isEdited = edited;
      const newState = (cur.state === 'RESULT' || cur.state === 'ERROR') ? 'INPUT' as CalcState : cur.state;
      set({ formula: newFormula, state: newState });
      requestAnimationFrame(() => liveEvaluate(newFormula));
    },

    onDelete: () => {
      const cur = get();
      const newFormula = deleteLastChar(cur.formula);
      _isEdited = true;
      set({ formula: newFormula, state: 'INPUT' });
      requestAnimationFrame(() => liveEvaluate(newFormula));
    },

    onClear: () => {
      const cur = get();
      if (!cur.formula) return;
      const sourceButton = (cur.state === 'RESULT' || cur.state === 'ERROR') ? 'clr' as const : 'del' as const;
      _animCallbacks.onClearAnimation?.(sourceButton);
      set({ formula: '', result: '', state: 'INPUT' });
      _isEdited = false;
    },

    onEvaluate: () => {
      const cur = get();
      if (!cur.formula) return;
      set({ state: 'EVALUATE' });
      const evalResult = evaluate(cur.formula);
      if (evalResult.kind === 'success') {
        const resultValue = evalResult.value;
        const hasAnimation = !!_animCallbacks.onResultAnimation;
        _animCallbacks.onResultAnimation?.(resultValue, cur.formula);
        set({ result: resultValue });
        // 动画结束后切换到 RESULT 状态：公式变为结果值，结果行清空
        const delay = hasAnimation ? ANIM_DURATION.long + 50 : 0;
        setTimeout(() => {
          useCalculator2Store.setState({ formula: localize(normalize(resultValue)), result: '', state: 'RESULT' });
          _isEdited = false;
        }, delay);
      } else if (evalResult.kind === 'error') {
        const errorMsg = evalResult.message;
        const hasAnimation = !!_animCallbacks.onErrorAnimation;
        _animCallbacks.onErrorAnimation?.(errorMsg);
        set({ result: errorMsg });
        const delay = hasAnimation ? ANIM_DURATION.long + 50 : 0;
        setTimeout(() => {
          useCalculator2Store.setState({ state: 'ERROR' });
          _isEdited = false;
        }, delay);
      } else {
        // empty — 无法求值，回到 INPUT
        set({ state: 'INPUT' });
      }
    },

    setAnimCallbacks: (cbs: AnimationCallbacks) => {
      _animCallbacks = cbs;
    },
  }),
  { partialize: () => ({}) },
);
