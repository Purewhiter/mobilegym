import React, { useCallback, useState, useEffect, useRef } from 'react';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { MemoryRouter, useLocation, UNSAFE_NavigationContext } from 'react-router-dom';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { useCalculatorGestures } from './hooks/useCalculatorGestures';

// 导航处理器 - 统一的返回逻辑
const CalculatorNavigationHandler: React.FC = () => {
  const location = useLocation();
  const { back } = useCalculatorGestures();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);

  // 跟踪历史索引
  const historyIndexRef = useRef(0);

  useEffect(() => {
    const memoryNavigator = navigator as any;
    if (typeof memoryNavigator.index === 'number') {
      historyIndexRef.current = memoryNavigator.index;
    }
  }, [location, navigator]);

  const handleBackPress = useCallback((): boolean => {
    const memoryNavigator = navigator as any;
    const currentIndex = typeof memoryNavigator.index === 'number'
      ? memoryNavigator.index
      : historyIndexRef.current;

    if (currentIndex > 0) {
      back();
      return true;
    }
    return false;
  }, [back, navigator]);

  useAppNavigationHandler('calculator', { onBack: handleBackPress });

  return null;
};

const CalculatorContent: React.FC = () => {
  const [display, setDisplay] = useState('0');
  // 存储第一个操作数、当前运算符
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);

  const handleInput = (val: string) => {
    if (waitingForSecondOperand) {
      setDisplay(val);
      setWaitingForSecondOperand(false);
    } else if (display === '0' || display === 'Error') {
      setDisplay(val);
    } else {
      setDisplay(display + val);
    }
  };

  const handleOp = (op: string) => {
    const current = parseFloat(display);

    if (firstOperand !== null && operator && !waitingForSecondOperand) {
      // 连续运算：先计算之前的结果
      const result = performCalculation(firstOperand, current, operator);
      setDisplay(formatNumber(result));
      setFirstOperand(result);
    } else {
      setFirstOperand(current);
    }
    setOperator(op);
    setWaitingForSecondOperand(true);
  };

  const performCalculation = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? a / b : NaN;
      default: return b;
    }
  };

  const formatNumber = (num: number): string => {
    if (isNaN(num) || !isFinite(num)) return 'Error';
    // 去掉末尾多余的0
    const str = parseFloat(num.toPrecision(10)).toString();
    return str;
  };

  const calculate = () => {
    if (operator === null || firstOperand === null) return;
    const current = parseFloat(display);
    const result = performCalculation(firstOperand, current, operator);
    setDisplay(formatNumber(result));
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
  };

  const clear = () => {
    setDisplay('0');
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
  };

  // +/- 正负号切换
  const toggleSign = () => {
    if (display === '0' || display === 'Error') return;
    const num = parseFloat(display);
    setDisplay(formatNumber(-num));
  };

  // % 百分比 — 苹果计算器逻辑
  const handlePercent = () => {
    const current = parseFloat(display);
    if (firstOperand !== null && operator) {
      // 有前置运算符：计算 firstOperand × (current / 100)
      const percentValue = firstOperand * (current / 100);
      setDisplay(formatNumber(percentValue));
    } else {
      // 没有前置运算符：单纯除以 100
      setDisplay(formatNumber(current / 100));
    }
  };

  const getDisplayClass = (text: string) => {
    const len = text.length;
    if (len < 8) return 'text-6xl';
    if (len < 11) return 'text-5xl';
    if (len < 14) return 'text-4xl';
    if (len < 17) return 'text-3xl';
    return 'text-2xl';
  };

  const Btn = ({ label, onClick, className = '' }: any) => (
    <button
      onClick={onClick}
      className={`h-16 w-16 rounded-full text-xl font-medium flex items-center justify-center transition-opacity active:opacity-60 ${className}`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-full bg-app-bg text-app-text flex flex-col p-6 pt-16">
      <div className="flex-1 flex flex-col justify-end pb-8 overflow-hidden w-full">
        <div className={`w-full flex overflow-x-auto no-scrollbar items-end ${getDisplayClass(display)}`}>
          <div className="ml-auto font-light whitespace-nowrap">
            {display}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <Btn label="AC" onClick={clear} className="bg-gray-400 text-black" />
        <Btn label="+/-" onClick={toggleSign} className="bg-gray-400 text-black" />
        <Btn label="%" onClick={handlePercent} className="bg-gray-400 text-black" />
        <Btn label="÷" onClick={() => handleOp('/')} className="bg-app-primary" />

        <Btn label="7" onClick={() => handleInput('7')} className="bg-gray-800" />
        <Btn label="8" onClick={() => handleInput('8')} className="bg-gray-800" />
        <Btn label="9" onClick={() => handleInput('9')} className="bg-gray-800" />
        <Btn label="×" onClick={() => handleOp('*')} className="bg-app-primary" />

        <Btn label="4" onClick={() => handleInput('4')} className="bg-gray-800" />
        <Btn label="5" onClick={() => handleInput('5')} className="bg-gray-800" />
        <Btn label="6" onClick={() => handleInput('6')} className="bg-gray-800" />
        <Btn label="-" onClick={() => handleOp('-')} className="bg-app-primary" />

        <Btn label="1" onClick={() => handleInput('1')} className="bg-gray-800" />
        <Btn label="2" onClick={() => handleInput('2')} className="bg-gray-800" />
        <Btn label="3" onClick={() => handleInput('3')} className="bg-gray-800" />
        <Btn label="+" onClick={() => handleOp('+')} className="bg-app-primary" />

        <div className="col-span-2">
          <button
            onClick={() => handleInput('0')}
            className="h-16 w-full rounded-full bg-gray-800 text-xl font-medium px-8 flex items-center justify-start transition-opacity active:opacity-60"
          >
            0
          </button>
        </div>
        <Btn label="." onClick={() => handleInput('.')} className="bg-gray-800" />
        <Btn label="=" onClick={calculate} className="bg-app-primary" />
      </div>
    </div>
  );
};

export const CalculatorApp: React.FC = () => {
  const { isDark } = useDarkMode();
  const themeColors = isDark
    ? { ...manifest.theme.colors, ...(manifest.theme.colorsDark ?? {}) }
    : manifest.theme.colors;
  const appColors = isDark ? { ...colors, ...colorsDark } : colors;
  const appColorStates = isDark ? { ...colorStates, ...colorStatesDark } : colorStates;
  const cssVars = {
    ...themeToCssVars(applySkinToThemeColors(themeColors)),
    ...dimensToCssVars(appColors, { prefix: '--app-c-' }),
    ...dimensToCssVars(appColorStates, { prefix: '--app-cs-' }),
    ...dimensToCssVars(dimens),
    ...dimensToCssVars(anim, { prefix: '--app-' }),
  };
  return (
    <div className="h-full w-full" style={cssVars as React.CSSProperties}>
    <MemoryRouter>
      <CalculatorNavigationHandler />
      <CalculatorContent />
    </MemoryRouter>
    </div>
  );
};

export default CalculatorApp;
