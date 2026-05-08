import React from 'react';
import { CalcButton } from './CalcButton';
import { useCalculator2Store } from '../state';
import { useCalculator2Gestures } from '../hooks/useCalculator2Gestures';
import { colors } from '../res/colors';
import { strings } from '../res/strings';

/**
 * 科学计算面板 — 3列4行 grid
 * 翻译自 AOSP pad_advanced.xml
 *
 * sin  cos  tan
 * ln   log  !
 * π    e    ^
 * (    )    √
 */
interface AdvancedPadProps {
  className?: string;
}

export const AdvancedPad: React.FC<AdvancedPadProps> = ({ className = '' }) => {
  const inputFunction = useCalculator2Store(s => s.inputFunction);
  const inputConstant = useCalculator2Store(s => s.inputConstant);
  const inputOperator = useCalculator2Store(s => s.inputOperator);
  const inputParen = useCalculator2Store(s => s.inputParen);
  const { bindAction } = useCalculator2Gestures();

  const buttons = [
    { label: strings.fun_sin, action: () => inputFunction('sin'), actionId: 'fun.sin' },
    { label: strings.fun_cos, action: () => inputFunction('cos'), actionId: 'fun.cos' },
    { label: strings.fun_tan, action: () => inputFunction('tan'), actionId: 'fun.tan' },

    { label: strings.fun_ln, action: () => inputFunction('ln'), actionId: 'fun.ln' },
    { label: strings.fun_log, action: () => inputFunction('log'), actionId: 'fun.log' },
    { label: strings.op_fact, action: () => inputOperator('!'), actionId: 'op.fact' },

    { label: strings.const_pi, action: () => inputConstant(strings.const_pi), actionId: 'const.pi' },
    { label: strings.const_e, action: () => inputConstant(strings.const_e), actionId: 'const.e' },
    { label: strings.op_pow, action: () => inputOperator('^'), actionId: 'op.pow' },

    { label: strings.paren_left, action: () => inputParen('('), actionId: 'paren.left' },
    { label: strings.paren_right, action: () => inputParen(')'), actionId: 'paren.right' },
    { label: strings.op_sqrt, action: () => inputFunction('sqrt'), actionId: 'op.sqrt' },
  ];

  return (
    <div
      className={className}
      style={{
        backgroundColor: colors.pad_advanced_background,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(4, 1fr)',
        paddingTop: 'var(--app-pad-advanced-padding-top)',
        paddingBottom: 'var(--app-pad-advanced-padding-bottom)',
        paddingLeft: 'var(--app-pad-advanced-padding-sides)',
        paddingRight: 'var(--app-pad-advanced-padding-sides)',
      }}
    >
      {buttons.map(({ label, action, actionId }) => (
        <CalcButton
          key={actionId}
          label={label}
          fontSize="var(--app-advanced-button-text)"
          textColor={colors.pad_button_advanced_text}
          rippleColor={colors.ripple_advanced}
          onTrigger={action}
          {...bindAction(actionId)}
        />
      ))}
    </div>
  );
};
