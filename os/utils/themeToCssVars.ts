import type { AppThemeColors } from '../types/manifest';

type DimenValue = number | string;

function toKebabCase(key: string): string {
  return (
    key
      // camelCase -> camel-Case
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      // snake_case / spaces -> kebab-case
      .replace(/[_\s]+/g, '-')
      .toLowerCase()
  );
}

function isUnitlessDimenKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.endsWith('weight') || k.endsWith('_weight') || k.endsWith('-weight');
}

// ============================================================================
// Tailwind v4 CSS 变量类名修复
// 
// 问题：Tailwind v4 对 text-(--var) 的处理不符合预期
// - text-(--app-xxx-size) 期望生成 font-size，实际可能生成 color
// - text-(--app-c-xxx) 期望生成 color，实际可能不一致
// 
// 注意：h-(--var) / w-(--var) 等布局类 Tailwind v4 处理正常，无需额外注入
// 
// 解决：运行时注入 CSS 规则修复 text-() 类的行为
// ============================================================================

const injectedRules = new Set<string>();
let pendingRules: string[] = [];
let styleTag: HTMLStyleElement | null = null;

function flushPendingRules(): void {
  if (typeof document === 'undefined' || pendingRules.length === 0) return;
  
  if (!styleTag) {
    styleTag = document.getElementById('tailwind-css-var-fixes') as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'tailwind-css-var-fixes';
      document.head.appendChild(styleTag);
    }
  }
  
  // 批量追加，避免多次 DOM 操作
  styleTag.textContent += pendingRules.join('\n') + '\n';
  pendingRules = [];
}

function injectRule(ruleKey: string, cssRule: string): void {
  if (injectedRules.has(ruleKey)) return;
  injectedRules.add(ruleKey);
  pendingRules.push(cssRule);
}

/**
 * 为 *_size 变量注入 font-size 规则
 * text-(--app-xxx-size) → font-size: var(--app-xxx-size)
 */
function injectFontSizeRule(cssVar: string): void {
  const className = `text-\\(${cssVar}\\)`;
  injectRule(`font-size:${cssVar}`, `.${className} { font-size: var(${cssVar}); }`);
}

/**
 * 为尺寸变量注入 width/height 等布局规则
 * Tailwind v4 对 w-(--var) / h-(--var) 可能不生成规则，导致头像等尺寸失效
 */
function injectLayoutRules(cssVar: string): void {
  injectRule(`width:${cssVar}`, `.w-\\(${cssVar}\\) { width: var(${cssVar}); }`);
  injectRule(`height:${cssVar}`, `.h-\\(${cssVar}\\) { height: var(${cssVar}); }`);
  injectRule(`min-width:${cssVar}`, `.min-w-\\(${cssVar}\\) { min-width: var(${cssVar}); }`);
  injectRule(`max-width:${cssVar}`, `.max-w-\\(${cssVar}\\) { max-width: var(${cssVar}); }`);
  injectRule(`min-height:${cssVar}`, `.min-h-\\(${cssVar}\\) { min-height: var(${cssVar}); }`);
  injectRule(`max-height:${cssVar}`, `.max-h-\\(${cssVar}\\) { max-height: var(${cssVar}); }`);
}

/**
 * 为颜色变量注入 color / background-color / border-color / placeholder 规则
 */
function injectColorRules(cssVar: string): void {
  injectRule(`color:${cssVar}`, `.text-\\(${cssVar}\\) { color: var(${cssVar}); }`);
  injectRule(`bg-color:${cssVar}`, `.bg-\\(${cssVar}\\) { background-color: var(${cssVar}); }`);
  injectRule(`border-color:${cssVar}`, `.border-\\(${cssVar}\\) { border-color: var(${cssVar}); }`);
  injectRule(`active:bg-color:${cssVar}`, `.active\\:bg-\\(${cssVar}\\):active { background-color: var(${cssVar}); }`);
  injectRule(`hover:bg-color:${cssVar}`, `.hover\\:bg-\\(${cssVar}\\):hover { background-color: var(${cssVar}); }`);
  injectRule(`placeholder:${cssVar}`, `.placeholder-\\(${cssVar}\\)::placeholder { color: var(${cssVar}); }`);
}

export function dimensToCssVars(
  dimens: Record<string, DimenValue>,
  options?: { prefix?: string },
): Record<string, string> {
  const prefix = options?.prefix ?? '--app-';
  const out: Record<string, string> = {};
  
  // 检测是否是颜色前缀（--app-c- 或 --app-cs-）
  const isColorPrefix = prefix === '--app-c-' || prefix === '--app-cs-';
  
  for (const [key, raw] of Object.entries(dimens)) {
    const cssVar = `${prefix}${toKebabCase(key)}`;
    if (typeof raw === 'number') {
      out[cssVar] = isUnitlessDimenKey(key) ? String(raw) : `${raw}px`;
    } else {
      out[cssVar] = raw;
    }
    
    // 只为有问题的 text-() 类注入修复规则
    // 布局类（h/w/p/m/gap 等）Tailwind v4 处理正常，无需注入
    if (isColorPrefix) {
      // 颜色变量：注入 color / background-color / border-color
      injectColorRules(cssVar);
    } else {
      // 尺寸变量：为字体大小相关的变量注入 font-size；为所有尺寸注入 w/h 布局规则
      const k = key.toLowerCase();
      if (k.endsWith('_size') || k.endsWith('size') || 
          k.includes('text_size') || k.includes('textsize')) {
        injectFontSizeRule(cssVar);
      }
      injectLayoutRules(cssVar);
    }
  }
  
  // 批量写入 DOM，避免多次重解析
  flushPendingRules();
  
  return out;
}

export function themeToCssVars(
  colors: AppThemeColors,
  options?: { dimens?: Record<string, DimenValue> },
): Record<string, string> {
  const primary = colors.primary;
  const base = {
    '--app-primary': primary,
    '--app-primary-dark': colors.primaryDark ?? primary,
    '--app-on-primary': colors.onPrimary ?? '#ffffff',
    '--app-secondary': colors.secondary ?? '#666666',
    '--app-accent': colors.accent ?? colors.secondary ?? primary,
    '--app-bg': colors.background,
    '--app-surface': colors.surface ?? '#ffffff',
    '--app-on-surface': colors.onSurface ?? colors.textPrimary,
    '--app-text': colors.textPrimary,
    '--app-text-muted': colors.textSecondary,
    '--app-border': colors.border ?? '#e5e7eb',
    '--app-tab-bar-bg': colors.tabBarBg ?? colors.surface ?? '#ffffff',
  };

  if (!options?.dimens) return base;
  return { ...base, ...dimensToCssVars(options.dimens) };
}
