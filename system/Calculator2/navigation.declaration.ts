/**
 * Calculator2 导航声明 — 单页应用
 *
 * 路由结构：只有一个主页面，两个 UI 状态（基本面板/科学面板）
 */

export const navigationDeclaration = {
  appId: 'calculator2' as const,
  routes: [
    {
      path: '/',
      component: 'CalculatorPage',
      entryPoint: 'home' as const,
      uiStates: [
        {
          id: 'calc.basic',
          search: {},
          description: '基本计算',
          actions: [
            { id: 'digit.0', label: '输入0', behavior: 'input' as const },
            { id: 'digit.1', label: '输入1', behavior: 'input' as const },
            { id: 'digit.2', label: '输入2', behavior: 'input' as const },
            { id: 'digit.3', label: '输入3', behavior: 'input' as const },
            { id: 'digit.4', label: '输入4', behavior: 'input' as const },
            { id: 'digit.5', label: '输入5', behavior: 'input' as const },
            { id: 'digit.6', label: '输入6', behavior: 'input' as const },
            { id: 'digit.7', label: '输入7', behavior: 'input' as const },
            { id: 'digit.8', label: '输入8', behavior: 'input' as const },
            { id: 'digit.9', label: '输入9', behavior: 'input' as const },
            { id: 'decimal', label: '输入小数点', behavior: 'input' as const },
            { id: 'op.add', label: '加法', behavior: 'input' as const },
            { id: 'op.sub', label: '减法', behavior: 'input' as const },
            { id: 'op.mul', label: '乘法', behavior: 'input' as const },
            { id: 'op.div', label: '除法', behavior: 'input' as const },
            { id: 'delete', label: '退格', behavior: 'other' as const },
            { id: 'clear', label: '清空', behavior: 'other' as const },
            { id: 'evaluate', label: '等号-求值', behavior: 'submit' as const },
          ],
        },
        {
          id: 'calc.advanced',
          search: { panel: 'advanced' },
          description: '科学计算面板',
          actions: [
            { id: 'fun.sin', label: 'sin', behavior: 'input' as const },
            { id: 'fun.cos', label: 'cos', behavior: 'input' as const },
            { id: 'fun.tan', label: 'tan', behavior: 'input' as const },
            { id: 'fun.ln', label: 'ln', behavior: 'input' as const },
            { id: 'fun.log', label: 'log', behavior: 'input' as const },
            { id: 'op.fact', label: '阶乘', behavior: 'input' as const },
            { id: 'const.pi', label: 'π', behavior: 'input' as const },
            { id: 'const.e', label: 'e', behavior: 'input' as const },
            { id: 'op.pow', label: '幂', behavior: 'input' as const },
            { id: 'paren.left', label: '左括号', behavior: 'input' as const },
            { id: 'paren.right', label: '右括号', behavior: 'input' as const },
            { id: 'op.sqrt', label: '根号', behavior: 'input' as const },
          ],
        },
      ],
    },
  ],
  transitions: [],
  capabilities: { historyBack: true },
};
