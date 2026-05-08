import React from 'react';
import { CalcButton } from './CalcButton';
import { useCalculator2Store } from '../state';
import { useCalculator2Gestures } from '../hooks/useCalculator2Gestures';
import { colors } from '../res/colors';
import { strings } from '../res/strings';

/**
 * 运算符键盘 — 1列5行
 * 翻译自 AOSP pad_operator_one_col.xml
 *
 * del/clr
 * ÷
 * ×
 * −
 * +
 */
interface OperatorPadProps {
  style?: React.CSSProperties;
}

export const OperatorPad: React.FC<OperatorPadProps> = ({ style }) => {
  const state = useCalculator2Store(s => s.state);
  const inputOperator = useCalculator2Store(s => s.inputOperator);
  const onDelete = useCalculator2Store(s => s.onDelete);
  const onClear = useCalculator2Store(s => s.onClear);
  const { bindAction } = useCalculator2Gestures();

  // del/clr 切换：INPUT 态 → del; RESULT/ERROR 态 → clr
  const isDelMode = state === 'INPUT' || state === 'EVALUATE';

  const operators = [
    { label: strings.op_div, op: '/', actionId: 'op.div' },
    { label: strings.op_mul, op: '*', actionId: 'op.mul' },
    { label: strings.op_sub, op: '-', actionId: 'op.sub' },
    { label: strings.op_add, op: '+', actionId: 'op.add' },
  ];

  return (
    <div
      style={{
        backgroundColor: colors.pad_operator_background,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'var(--app-pad-operator-padding-top)',
        paddingBottom: 'var(--app-pad-operator-padding-bottom)',
        paddingLeft: 'var(--app-pad-operator-padding-start)',
        paddingRight: 'var(--app-pad-operator-padding-end)',
        ...style,
      }}
    >
      {/* del / clr */}
      <CalcButton
        label={isDelMode ? strings.del : strings.clr}
        fontSize="var(--app-operator-text-button)"
        textColor="var(--app-on-surface)"
        rippleColor={colors.ripple}
        uppercase
        className="flex-1"
        onTrigger={isDelMode ? onDelete : onClear}
        onLongPress={isDelMode ? onClear : undefined}
        {...bindAction(isDelMode ? 'delete' : 'clear')}
      />

      {/* ÷ × − + */}
      {operators.map(({ label, op, actionId }) => (
        <CalcButton
          key={op}
          label={label}
          fontSize="var(--app-operator-button-text)"
          textColor="var(--app-on-surface)"
          rippleColor={colors.ripple}
          className="flex-1"
          onTrigger={() => inputOperator(op)}
          {...bindAction(actionId)}
        />
      ))}
    </div>
  );
};
