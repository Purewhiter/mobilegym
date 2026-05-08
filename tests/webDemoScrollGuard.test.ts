import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('web landing demo scroll containment (same-origin patch)', () => {
  const html = readFileSync('web/index.html', 'utf8');

  it('redirects scrollIntoView to the nearest iframe-internal scrollable ancestor', () => {
    // 改写 iframe 内 Element.prototype.scrollIntoView，把滚动钳在 iframe 内最近的可滚祖先；
    // 走到 documentElement 就直接 return，不让浏览器再向父页冒泡。
    expect(html).toContain('function patchSimulatorScrollPropagation');
    expect(html).toContain('ElementCtor.prototype.scrollIntoView = function patchedScrollIntoView');
    expect(html).toContain('if (!target || target === ownerDoc.documentElement) return;');
    expect(html).toContain('target.scrollTo({');
  });

  it('forces preventScroll on focus so input focus does not scroll parent', () => {
    expect(html).toContain('HTMLElementCtor.prototype.focus = function patchedFocus');
    expect(html).toContain('preventScroll: true');
  });

  it('applies the patch on iframe load', () => {
    expect(html).toContain("iframe.addEventListener('load', () => patchSimulatorScrollPropagation(iframe));");
  });

  it('does not install a body-fixed parent scroll lock', () => {
    // 同源是部署约定；不再保留跨域 fallback，以免 demo 期间 paper 不能滚（包括失去 scroll chaining）。
    expect(html).not.toContain('installPageScrollLock');
    expect(html).not.toContain("body.style.position = 'fixed';");
  });
});
