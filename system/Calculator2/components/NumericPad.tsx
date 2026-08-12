import React from 'react';
import { CalcButton } from './CalcButton';
import { useCalculator2Store } from '../state';
import { useCalculator2Gestures } from '../hooks/useCalculator2Gestures';
import { colors } from '../res/colors';
import { strings } from '../res/strings';

/**
 * 数字键盘 — 3列4行 grid
 * 翻译自 AOSP pad_numeric.xml
 *
 * 7 8 9
 * 4 5 6
 * 1 2 3
 * . 0 =
 */
interface NumericPadProps {
  style?: React.CSSProperties;
}

export const NumericPad: React.FC<NumericPadProps> = ({ style }) => {
  const inputDigit = useCalculator2Store(s => s.inputDigit);
  const inputDecimal = useCalculator2Store(s => s.inputDecimal);
  const onEvaluate = useCalculator2Store(s => s.onEvaluate);
  const { bindAction } = useCalculator2Gestures();

  // actionId 必须是字面量（供导航声明一致性检查扫描），不能动态拼接
  const digits: Array<{ d: string; actionId: string }> = [
    { d: '7', actionId: 'calc.pad.digit7' },
    { d: '8', actionId: 'calc.pad.digit8' },
    { d: '9', actionId: 'calc.pad.digit9' },
    { d: '4', actionId: 'calc.pad.digit4' },
    { d: '5', actionId: 'calc.pad.digit5' },
    { d: '6', actionId: 'calc.pad.digit6' },
    { d: '1', actionId: 'calc.pad.digit1' },
    { d: '2', actionId: 'calc.pad.digit2' },
    { d: '3', actionId: 'calc.pad.digit3' },
  ];

  return (
    <div
      style={{
        backgroundColor: 'var(--app-surface)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(4, 1fr)',
        paddingTop: 'var(--app-pad-numeric-padding-top)',
        paddingBottom: 'var(--app-pad-numeric-padding-bottom)',
        paddingLeft: 'var(--app-pad-numeric-padding-sides)',
        paddingRight: 'var(--app-pad-numeric-padding-sides)',
        ...style,
      }}
    >
      {digits.map(({ d, actionId }) => (
        <CalcButton
          key={d}
          label={d}
          fontSize="var(--app-numeric-button-text)"
          textColor="var(--app-on-surface)"
          rippleColor={colors.ripple}
          onTrigger={() => inputDigit(d)}
          {...bindAction(actionId)}
        />
      ))}
      {/* 底行: . 0 = */}
      <CalcButton
        label={strings.decimal}
        fontSize="var(--app-numeric-button-text)"
        textColor="var(--app-on-surface)"
        rippleColor={colors.ripple}
        onTrigger={inputDecimal}
        {...bindAction('calc.pad.decimal')}
      />
      <CalcButton
        label="0"
        fontSize="var(--app-numeric-button-text)"
        textColor="var(--app-on-surface)"
        rippleColor={colors.ripple}
        onTrigger={() => inputDigit('0')}
        {...bindAction('calc.pad.digit0')}
      />
      <CalcButton
        label={strings.equals}
        fontSize="var(--app-equals-button-text)"
        textColor="var(--app-on-surface)"
        rippleColor={colors.ripple}
        onTrigger={onEvaluate}
        {...bindAction('calc.pad.evaluate')}
      />
    </div>
  );
};
