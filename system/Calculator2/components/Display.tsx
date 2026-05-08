import React, { useEffect, useRef } from 'react';
import { useCalculator2Store } from '../state';
import { colors } from '../res/colors';
import { dimens } from '../res/dimens';

/**
 * 显示区 — 公式 + 结果预览
 * 翻译自 AOSP display.xml + CalculatorFormula.java + CalculatorResult.java
 *
 * - 白色背景，底部阴影 (elevation 4dp)
 * - 公式：右对齐，自适应文字大小 (36-64px)
 * - 结果：右对齐，固定 36px
 */
export const Display: React.FC = () => {
  const state = useCalculator2Store(s => s.state);
  const formula = useCalculator2Store(s => s.formula);
  const result = useCalculator2Store(s => s.result);
  const formulaRef = useRef<HTMLDivElement>(null);
  const isError = state === 'ERROR';

  // 自适应公式文字大小
  useEffect(() => {
    const el = formulaRef.current;
    if (!el) return;

    const container = el.parentElement;
    if (!container) return;
    const readPxVar = (cssVarName: string, fallbackPx: number): number => {
      const raw = getComputedStyle(el).getPropertyValue(cssVarName).trim();
      if (!raw) return fallbackPx;
      const n = parseFloat(raw);
      return Number.isFinite(n) ? n : fallbackPx;
    };

    const paddingSides = readPxVar('--app-display-formula-padding-sides', dimens.display_formula_padding_sides);
    const maxWidth = container.clientWidth - paddingSides * 2;

    // 从最大字号向下逐步缩小
    let fontSize = readPxVar('--app-formula-text-max', dimens.formula_text_max);
    const minFontSize = readPxVar('--app-formula-text-min', dimens.formula_text_min);
    const step = readPxVar('--app-formula-text-step', dimens.formula_text_step) || 1;
    el.style.fontSize = `${fontSize}px`;

    while (fontSize > minFontSize && el.scrollWidth > maxWidth) {
      fontSize -= step;
      el.style.fontSize = `${fontSize}px`;
    }
  }, [formula]);

  return (
    <div
      style={{
        backgroundColor: 'var(--app-bg)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        position: 'relative',
        zIndex: 1,
      }}
    >
      {/* 公式行 */}
      <div
        style={{
          paddingTop: 'var(--app-display-formula-padding-top)',
          paddingBottom: 'var(--app-display-formula-padding-bottom)',
          paddingLeft: 'var(--app-display-formula-padding-sides)',
          paddingRight: 'var(--app-display-formula-padding-sides)',
          textAlign: 'right',
          overflow: 'hidden',
        }}
      >
        <div
          ref={formulaRef}
          style={{
            color: isError ? colors.error : 'var(--app-text)',
            fontSize: 'var(--app-formula-text-max)',
            fontWeight: 300,
            fontFamily: 'sans-serif',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            display: 'inline-block',
            transition: 'transform 0.4s ease-in-out',
          }}
        >
          {formula || '\u00A0'}
        </div>
      </div>

      {/* 结果行 */}
      <div
        style={{
          paddingTop: 'var(--app-display-result-padding-top)',
          paddingBottom: 'var(--app-display-result-padding-bottom)',
          paddingLeft: 'var(--app-display-result-padding-sides)',
          paddingRight: 'var(--app-display-result-padding-sides)',
          textAlign: 'right',
        }}
      >
        <div
          style={{
            color: isError ? colors.error : 'var(--app-text-muted)',
            fontSize: 'var(--app-result-text)',
            fontWeight: 300,
            fontFamily: 'sans-serif',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {result || '\u00A0'}
        </div>
      </div>
    </div>
  );
};
