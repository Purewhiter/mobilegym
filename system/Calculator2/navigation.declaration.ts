/**
 * Calculator2 导航声明 — 单页应用
 *
 * 路由结构：只有一个主页面。基本键盘与科学面板的切换由 SwipeablePads
 * 以本地手势状态实现（不经 URL），因此只声明一个 uiState；
 * 所有按键都是原地 actions（behavior: 'other'，对照 Alipay 键盘按键范式），
 * 不产生 transitions。
 */

export const NAVIGATION_DECLARATION = {
  app: 'calculator2',

  routes: [
    {
      path: '/',
      component: 'CalculatorPage',
      params: {},
      entryPoint: 'home',
      queryParams: {},
      uiStates: [
        {
          id: 'calc.base',
          search: {},
          description: '计算器主界面（基本键盘 + 滑出科学面板）',
          actions: [
            // ── 基本键盘（数字 + 运算符区） ──
            { id: 'calc.pad.digit0', label: '输入0', behavior: 'other' },
            { id: 'calc.pad.digit1', label: '输入1', behavior: 'other' },
            { id: 'calc.pad.digit2', label: '输入2', behavior: 'other' },
            { id: 'calc.pad.digit3', label: '输入3', behavior: 'other' },
            { id: 'calc.pad.digit4', label: '输入4', behavior: 'other' },
            { id: 'calc.pad.digit5', label: '输入5', behavior: 'other' },
            { id: 'calc.pad.digit6', label: '输入6', behavior: 'other' },
            { id: 'calc.pad.digit7', label: '输入7', behavior: 'other' },
            { id: 'calc.pad.digit8', label: '输入8', behavior: 'other' },
            { id: 'calc.pad.digit9', label: '输入9', behavior: 'other' },
            { id: 'calc.pad.decimal', label: '输入小数点', behavior: 'other' },
            { id: 'calc.pad.opAdd', label: '加法', behavior: 'other' },
            { id: 'calc.pad.opSub', label: '减法', behavior: 'other' },
            { id: 'calc.pad.opMul', label: '乘法', behavior: 'other' },
            { id: 'calc.pad.opDiv', label: '除法', behavior: 'other' },
            { id: 'calc.pad.delete', label: '退格', behavior: 'other' },
            { id: 'calc.pad.clear', label: '清空', behavior: 'other' },
            { id: 'calc.pad.evaluate', label: '等号-求值', behavior: 'other' },

            // ── 科学面板（右滑滑出） ──
            { id: 'calc.advanced.funSin', label: 'sin', behavior: 'other' },
            { id: 'calc.advanced.funCos', label: 'cos', behavior: 'other' },
            { id: 'calc.advanced.funTan', label: 'tan', behavior: 'other' },
            { id: 'calc.advanced.funLn', label: 'ln', behavior: 'other' },
            { id: 'calc.advanced.funLog', label: 'log', behavior: 'other' },
            { id: 'calc.advanced.opFact', label: '阶乘', behavior: 'other' },
            { id: 'calc.advanced.constPi', label: 'π', behavior: 'other' },
            { id: 'calc.advanced.constE', label: 'e', behavior: 'other' },
            { id: 'calc.advanced.opPow', label: '幂', behavior: 'other' },
            { id: 'calc.advanced.parenLeft', label: '左括号', behavior: 'other' },
            { id: 'calc.advanced.parenRight', label: '右括号', behavior: 'other' },
            { id: 'calc.advanced.opSqrt', label: '根号', behavior: 'other' },
          ],
        },
      ],
      description: '计算器',
    },
  ],

  transitions: [],

  capabilities: {
    historyBack: true,
  },
};
