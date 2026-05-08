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

export default [
  {
    files: ['os/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}', 'system/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'no-restricted-syntax': ['error', DATE_NOW_BAN, NEW_DATE_BAN],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['os/TimeService.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
