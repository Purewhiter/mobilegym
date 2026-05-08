/**
 * 仿真环境布局导出：支持「仅当前视口」导出，与安卓单屏 dump 对齐便于对比。
 */

export interface GetSimLayoutHTMLOptions {
  /** 为 true 时只导出当前视口内可见的节点（含必要祖先），与真机单屏导出可比对 */
  visibleOnly?: boolean;
}

function viewportRect() {
  return {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };
}

function intersectsViewport(el: Element, vp: ReturnType<typeof viewportRect>): boolean {
  const r = el.getBoundingClientRect();
  return (
    r.right >= vp.left &&
    r.left <= vp.right &&
    r.bottom >= vp.top &&
    r.top <= vp.bottom
  );
}

/**
 * 将 HTML/CSS 中以 "/" 开头的资源 URL（在 file:// 里会失效）改写为同源绝对 URL。
 *
 * 例如：
 * - src="/assets/a.png"  -> src="http://localhost:3000/assets/a.png"
 * - url(/assets/a.png)   -> url(http://localhost:3000/assets/a.png)
 *
 * 注意：这里只处理「单斜杠」( /path )，不会改写协议相对 URL ( //cdn/... )。
 */
function absolutizeRootRelativeUrls(html: string): string {
  const origin = location.origin?.replace(/\/$/, '');
  if (!origin) return html;

  let out = html;

  // HTML 属性：src/href/poster="/..."
  out = out.replace(/\b(src|href|poster)=("|\')\/(?!\/)/g, (_m, attr: string, quote: string) => {
    return `${attr}=${quote}${origin}/`;
  });

  // CSS：url(/...)
  out = out.replace(/url\(\s*(['"]?)\/(?!\/)/g, (_m, quote: string) => {
    return `url(${quote}${origin}/`;
  });

  return out;
}

// 注意：
// 之前 visibleOnly 模式会“按元素 boundingClientRect 裁剪 DOM”，这在以下情况会丢内容：
// - SVG 内部子节点（path/clipPath/mask 等）经常拿不到靠谱的 rect → 被误删
// - 横向分页/滚动过程中，页面会处于半可见状态 → 被裁成“缺一半”
// 浏览器 Cmd+S 保存页面不会做这种裁剪，因此更“所见即所得”。

/**
 * 收集页面中所有生效的 CSS 规则，返回一个 <style> 字符串。
 * 覆盖 Vite dev 模式下通过 JS 动态注入的样式（document.styleSheets）。
 */
function collectAllCSS(): string {
  const cssTexts: string[] = [];
  try {
    for (const sheet of document.styleSheets) {
      try {
        // 有些跨域样式表无法读取 cssRules，跳过
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) continue;
        const parts: string[] = [];
        for (const rule of rules) {
          parts.push(rule.cssText);
        }
        if (parts.length > 0) {
          cssTexts.push(parts.join('\n'));
        }
      } catch {
        // CORS 限制，尝试用 href 标记来源
        if (sheet.href) {
          cssTexts.push(`/* [cross-origin] ${sheet.href} */`);
        }
      }
    }
  } catch {
    // fallback: 无法访问 styleSheets
  }
  return cssTexts.length > 0
    ? `<style data-snapshot="inlined-css">\n${cssTexts.join('\n')}\n</style>`
    : '';
}

/**
 * 将 HTML 中 <img src="/..."> 的本地资源转为 base64 data URI，使快照自包含。
 * 通过 fetch + canvas 实现，同步处理已加载的图片，跳过外部/跨域资源。
 */
function inlineImages(html: string): string {
  // 创建临时容器解析 HTML 中的 img
  const imgs = document.querySelectorAll('img[src]');
  const replacements: Array<[string, string]> = [];

  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) continue;
    // 只处理同源的本地资源
    if (src.startsWith('http') && !src.startsWith(location.origin)) continue;

    const imgEl = img as HTMLImageElement;
    if (!imgEl.complete || imgEl.naturalWidth === 0) continue;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth;
      canvas.height = imgEl.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(imgEl, 0, 0);
      // SVG 用 image/svg+xml，其他用 image/png
      const isSvg = src.endsWith('.svg') || src.includes('.svg');
      const dataUri = isSvg
        ? canvas.toDataURL('image/png') // SVG 渲染为 PNG 更可靠
        : canvas.toDataURL('image/png');
      replacements.push([src, dataUri]);
    } catch {
      // canvas tainted 或其他错误，跳过
    }
  }

  let result = html;
  for (const [src, dataUri] of replacements) {
    // 转义 src 中的特殊正则字符
    const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`src="${escaped}"`, 'g'), `src="${dataUri}"`);
  }
  return result;
}

/**
 * 返回当前页面布局 HTML。
 * @param options.visibleOnly - 为 true 时只导出当前视口内可见的 #root 子树，与安卓单屏导出可比对
 */
export function getSimLayoutHTML(options?: GetSimLayoutHTMLOptions): string {
  const visibleOnly = options?.visibleOnly === true;
  const inlinedCSS = collectAllCSS();

  if (!visibleOnly) {
    // 完整页面：在 </head> 前注入内联 CSS，内联图片
    let fullHTML = document.documentElement.outerHTML;
    if (inlinedCSS) {
      fullHTML = fullHTML.replace('</head>', inlinedCSS + '\n</head>');
    }
    // 先改写根路径资源，避免 file:// 打开时 404
    fullHTML = absolutizeRootRelativeUrls(fullHTML);
    return inlineImages(fullHTML);
  }

  const root = document.getElementById('root');
  if (!root) {
    let fullHTML = document.documentElement.outerHTML;
    if (inlinedCSS) {
      fullHTML = fullHTML.replace('</head>', inlinedCSS + '\n</head>');
    }
    fullHTML = absolutizeRootRelativeUrls(fullHTML);
    return inlineImages(fullHTML);
  }

  // visible_only 模式：返回完整 HTML 文档（含 CSS），但 body 只保留 #root（不再裁剪其内部 DOM）
  // 这样更接近浏览器 Cmd+S 保存后的效果，避免裁剪导致的"缺图标/缺元素"问题。

  // 保留 <html> 上的运行时内联样式（如 DeviceEffects 设置的 font-size、colorScheme 等），
  // 否则快照中 rem 基准与实时页面不同，导致布局偏移。
  const htmlStyle = document.documentElement.getAttribute('style') || '';
  const htmlStyleAttr = htmlStyle ? ` style="${htmlStyle.replace(/"/g, '&quot;')}"` : '';

  const html = `<!DOCTYPE html>
<html lang="zh-CN"${htmlStyleAttr}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>MobileGym Snapshot</title>
${inlinedCSS}
</head>
<body style="margin:0;padding:0;overflow:hidden">
${root.outerHTML}
</body>
</html>`;
  // visibleOnly 模式下不做 base64 图片内联（canvas toDataURL 很容易卡住 30s 超时）；
  // 仅把 "/xxx" 改写为同源绝对 URL，保证在 comparison.html(file://) 的 iframe 里还能加载资源。
  return absolutizeRootRelativeUrls(html);
}
