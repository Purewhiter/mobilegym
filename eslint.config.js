import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const DATE_NOW_BAN = {
  selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
  message: 'Use TimeService.now() for simulated time or realNow() for real wall-clock time. See os/TimeService.ts.',
};

const NEW_DATE_BAN = {
  selector: 'NewExpression[callee.name="Date"]',
  message: 'Use TimeService.getDate() / fromTimestamp(ts) / fromLocalParts(y,m,d) instead of new Date(...). See os/TimeService.ts.',
};

const LINT_FILES = ['os/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}', 'system/**/*.{ts,tsx}'];

export default [
  // typescript-eslint recommended（base + eslint-recommended + recommended），
  // 收敛到与自定义规则相同的文件范围，避免波及 scripts/ 等未纳管目录
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: LINT_FILES,
  })),
  {
    name: 'mobilegym/custom',
    files: LINT_FILES,
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'no-restricted-syntax': ['error', DATE_NOW_BAN, NEW_DATE_BAN],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // 存量显式 any 约 890 处，先以 warn 建立基线防回潮；
      // 按 docs 清偿计划分批收窄后再升 error
      '@typescript-eslint/no-explicit-any': 'warn',
      // 保持 error：`_` 前缀是显式弃用约定（对齐存量 ~40 处写法）
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // 【临时降级】以下目录由并行编队占用中，存量 error 暂降为 warn 以保证
    // npm run lint 可用；待对应分支收敛后删除本块并清偿（清单见 dev-health 报告）
    name: 'mobilegym/parallel-owned-temp',
    files: [
      'os/launcher/**/*.{ts,tsx}',
      'os/simInput.ts',
      'apps/Bilibili/**/*.{ts,tsx}',
      'apps/WechatReading/**/*.{ts,tsx}',
      'apps/Map/**/*.{ts,tsx}',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      'prefer-const': 'warn',
    },
  },
  {
    files: ['os/TimeService.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
