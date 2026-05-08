import { cdn } from '../utils/cdn';

const THEME_CDN = cdn('themes');

export type WmrWidgetVariant = {
  entry: string;
  spanX: number;
  spanY: number;
  /** Relative filename under the widget dir, or absolute URL if starts with '/' */
  preview: string;
};

export type WmrWidgetMeta = {
  id: string;
  title: string;
  author: string;
  description: string;
  source?: 'theme' | 'standalone';
  themeId?: string;
  variants: WmrWidgetVariant[];
};

let _cache: WmrWidgetMeta[] | null = null;

export async function listWmrWidgets(): Promise<WmrWidgetMeta[]> {
  if (_cache) return _cache;
  try {
    const res = await fetch(`${THEME_CDN}/manifest.json`);
    if (!res.ok) return [];
    const manifest = await res.json();
    const raw: any[] = manifest.widgets ?? [];
    const metas: WmrWidgetMeta[] = [];
    for (const w of raw) {
      if (!w.id || !Array.isArray(w.variants) || w.variants.length === 0) continue;
      metas.push({
        id: w.id,
        title: w.title ?? w.id,
        author: w.author ?? '',
        description: w.description ?? '',
        source: w.source === 'theme' ? 'theme' : 'standalone',
        themeId: w.themeId,
        variants: w.variants.map((v: any) => ({
          entry: v.entry,
          spanX: v.spanX,
          spanY: v.spanY,
          preview: v.preview ?? '',
        })),
      });
    }
    metas.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
    _cache = metas;
    return metas;
  } catch {
    return [];
  }
}

export function getWidgetPreviewUrl(widgetId: string, variant: WmrWidgetVariant): string {
  if (variant.preview) {
    // 老 manifest 里 preview 形如 /themes/<uuid>/preview.png，迁移后这部分直接走 THEME_CDN
    if (variant.preview.startsWith('/themes/')) {
      return `${THEME_CDN}${variant.preview.slice('/themes'.length)}`;
    }
    if (variant.preview.startsWith('/') || variant.preview.startsWith('http')) {
      return variant.preview;
    }
    return `${THEME_CDN}/${widgetId}/${variant.preview}`;
  }
  return `${THEME_CDN}/${widgetId}/preview/${variant.entry}.png`;
}

/**
 * Get the XML base URL for a WMR widget variant's manifest.xml.
 * For theme clock widgets: ${THEME_CDN}/<themeId>/clock_2x4/
 * For standalone widgets:  ${THEME_CDN}/<widgetId>/<variant>/
 */
export function getWidgetXmlBaseUrl(widget: WmrWidgetMeta, variant: WmrWidgetVariant): string | undefined {
  if (widget.source === 'theme' && widget.themeId) {
    return `${THEME_CDN}/${widget.themeId}/${variant.entry}/`;
  }
  return `${THEME_CDN}/${widget.id}/${variant.entry}/`;
}

export function invalidateCache(): void {
  _cache = null;
}
