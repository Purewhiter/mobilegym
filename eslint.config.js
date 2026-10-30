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

const MATH_RANDOM_BAN = {
  selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
  message: 'Use RandomService (stream(key) / nextStream(scope)) so runs are reproducible from their seed. See os/RandomService.ts.',
};

const CRYPTO_RANDOM_BAN = {
  selector: 'CallExpression[callee.property.name=/^(randomUUID|getRandomValues)$/]',
  message: 'Use RandomService (base36(nextStream(scope), n) for ids) so runs are reproducible from their seed. See os/RandomService.ts.',
};

// A plain scroll div around routed pages survives navigation: the next page
// inherits the old scrollTop, clamped by frame timing. See os/components/RouteScrollContainer.tsx.
const OVERFLOW_SCROLL = '/overflow-(y-)?(auto|scroll)/';
const SCROLLER = 'JSXElement:not([openingElement.name.name="RouteScrollContainer"]):has(> JSXOpeningElement:has(> '
  + `:matches(JSXAttribute[name.name="data-scroll-container"], JSXAttribute[name.name="className"]:has(:matches(Literal[value=${OVERFLOW_SCROLL}], TemplateElement[value.raw=${OVERFLOW_SCROLL}])))))`;
const SHARED_ROUTE_SCROLLER_BAN = {
  selector: `:matches(${SCROLLER}) JSXElement[openingElement.name.name=/^(Outlet|Routes)$/]`,
  message: 'Wrap routed pages in <RouteScrollContainer> (os/components/RouteScrollContainer.tsx), not a plain scroll div: '
    + 'otherwise each page inherits the previous page\'s scroll position, and how far depends on frame timing.',
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
      'no-restricted-syntax': ['error', DATE_NOW_BAN, NEW_DATE_BAN, MATH_RANDOM_BAN, CRYPTO_RANDOM_BAN, SHARED_ROUTE_SCROLLER_BAN],
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
