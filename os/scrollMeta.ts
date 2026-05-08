/**
 * 滚动状态观测模块
 *
 * 提供 window.__getScrollMeta__() 函数，供 Agent 按需读取当前页面的滚动容器状态。
 *
 * 使用方式：
 * 1. 在滚动容器上添加 data-scroll-container="name" 和 data-scroll-direction="vertical|horizontal"
 * 2. Agent 调用 window.__getScrollMeta__() 自动发现并读取所有滚动容器状态
 *
 * 示例：
 * <div data-scroll-container="main" data-scroll-direction="vertical" className="overflow-auto">
 */

export interface ScrollMeta {
  /** 当前滚动位置 (scrollTop 或 scrollLeft) */
  position: number;
  /** 最大可滚动距离 */
  max: number;
  /** 可视区域大小 */
  viewport: number;
  /** 内容总高度/宽度 */
  total: number;
}

export type ScrollMetaMap = Record<string, ScrollMeta>;

/**
 * 检查元素是否可见
 */
function isElementVisible(el: HTMLElement): boolean {
  // visibility: hidden 是继承属性；app 容器设为 hidden 后，其后代 computedStyle.visibility 也会是 hidden
  const computedStyle = getComputedStyle(el);
  if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
    return false;
  }

  // offsetParent 为 null 表示元素或其祖先可能是 display: none
  // 但 position: fixed 的元素 offsetParent 也为 null，需要额外检查
  if (el.offsetParent === null) {
    let parent = el.parentElement;
    while (parent) {
      if (getComputedStyle(parent).display === 'none') return false;
      parent = parent.parentElement;
    }
  }

  return true;
}

/**
 * 获取当前页面的滚动状态
 * 自动发现所有带 data-scroll-container 属性的可见元素
 */
export function getScrollMeta(): ScrollMetaMap {
  const meta: ScrollMetaMap = {};

  try {
    const containers = document.querySelectorAll('[data-scroll-container]');

    containers.forEach((el) => {
      if (!(el instanceof HTMLElement)) return;

      // 跳过不可见的元素
      if (!isElementVisible(el)) return;

      const name = el.getAttribute('data-scroll-container');
      if (!name) return;

      const direction = el.getAttribute('data-scroll-direction') || 'vertical';

      if (direction === 'vertical') {
        meta[name] = {
          position: el.scrollTop,
          max: el.scrollHeight - el.clientHeight,
          viewport: el.clientHeight,
          total: el.scrollHeight,
        };
      } else {
        meta[name] = {
          position: el.scrollLeft,
          max: el.scrollWidth - el.clientWidth,
          viewport: el.clientWidth,
          total: el.scrollWidth,
        };
      }
    });
  } catch (e) {
    console.error('[scrollMeta] Error getting scroll meta:', e);
  }

  return meta;
}


/**
 * 初始化滚动状态观测
 *
 * 调用后会在 window 上暴露：
 * - __getScrollMeta__() - 读取当前页面的滚动状态（自动发现）
 */
export function initScrollMeta(): void {
  if (typeof window !== 'undefined') {
    window.__getScrollMeta__ = getScrollMeta;
  }
}
