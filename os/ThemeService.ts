import { THEME_CONFIG } from './data/themeConfig';
import BroadcastBus, { ACTION_THEME_CHANGED } from './BroadcastBus';
import { now as timeNow } from './TimeService';
import { debouncedSetItem } from './debouncedPersist';

export type ThemeId = string;
export type ThemeComponentCode = string;

export type ThemeMeta = {
  id: ThemeId;
  title: string;
  author: string;
  description: string;
  price: number | null;
  version: string | null;
  assemblyId: string | null;
  /** Preview file names (relative to /themes/{id}/preview/) */
  previews: string[];
  /** Backward-compat alias of `previews` */
  builtInPreviews: string[];
  subResources: Array<{ resourceCode: ThemeComponentCode; localId: string }>;

  /** Extra fields from manifest (optional) */
  type?: 'full' | 'font' | 'aod' | string;
  capabilities?: string[];
  iconPackageNames?: string[];
  statusbarIcons?: string[];
  statusbarDynamic?: {
    /** 例：5 -> wifi_0..4.png */
    wifiLevels?: number;
    /** 例：6 -> signal_0..5.png */
    signalLevels?: number;
    /** 电池帧数量（用于 battery_sprite.png） */
    batteryFrames?: number;
    /** 例如 "battery_sprite.png" */
    batterySprite?: string;
    /** 单帧边长（像素），例如 40 */
    batteryFrameSide?: number;
    /**
     * 主题烤色的充电变体 sprite（RGBA，body 是主题选定的绿/teal/蓝、bolt 已在
     * 帧内）。前端在充电时优先用这张图直接渲染，丢回退到 base sprite + 系统色 tint。
     */
    batteryChargeFrames?: number;
    batteryChargeSprite?: string;
    batteryChargeFrameSide?: number;
    /** 主题烤色的省电变体 sprite（RGBA，body 是主题黄/橙）。 */
    batteryPowerSaveFrames?: number;
    batteryPowerSaveSprite?: string;
    batteryPowerSaveFrameSide?: number;
    /** 主题烤色的"省电+充电"变体 sprite（RGBA，黄 body + bolt）。 */
    batteryPowerSaveChargeFrames?: number;
    batteryPowerSaveChargeSprite?: string;
    batteryPowerSaveChargeFrameSide?: number;
    /**
     * 充电闪电单帧 overlay（仅 alpha，由前端 tint）。仅在系统兜底渲染路径
     * （主题没有提供 `_charge` 变体）下使用——主题 RGBA 路径的 bolt 已经烤进
     * 帧里，无需再叠。
     */
    batteryBoltOverlay?: string;
    /** 可用的数据类型图标集合（如 ["4g","5g","lte"]） */
    dataTypes?: string[];
  };
  extracted?: any;
  /** Per-component asset index: component -> { assetBaseName -> relativePath } */
  componentAssets?: Record<string, Record<string, string>>;
};

type ThemeManifest = {
  version: number;
  generatedAt?: string | null;
  defaultThemeId?: ThemeId | null;
  themes: ThemeMeta[];
  fonts?: ThemeMeta[];
  aod?: ThemeMeta[];
};

type ThemeComponentKey = 'icons' | 'statusbar' | 'shade';

type ActiveThemeConfigV2 = {
  version: 2;
  themeId: ThemeId;
  appliedAt: number;
  components: Record<ThemeComponentKey, ThemeId>;
};

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function isThemeMetaLike(x: any): x is ThemeMeta {
  return x && typeof x === 'object' && typeof x.id === 'string';
}

function normalizeThemeMeta(raw: any): ThemeMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' ? raw.id : null;
  if (!id) return null;
  const previews = Array.isArray(raw.previews) ? raw.previews.filter((x: any) => typeof x === 'string') : [];
  const builtInPreviews = Array.isArray(raw.builtInPreviews)
    ? raw.builtInPreviews.filter((x: any) => typeof x === 'string')
    : previews;
  const subResources = Array.isArray(raw.subResources)
    ? raw.subResources
        .map((sr: any) => ({
          resourceCode: String(sr?.resourceCode || ''),
          localId: String(sr?.localId || ''),
        }))
        .filter((sr: any) => sr.resourceCode && sr.localId)
    : [];

  const dynRaw = raw.statusbarDynamic && typeof raw.statusbarDynamic === 'object' ? raw.statusbarDynamic : null;
  const statusbarDynamic =
    dynRaw && typeof dynRaw === 'object'
      ? {
          wifiLevels: typeof dynRaw.wifiLevels === 'number' ? dynRaw.wifiLevels : undefined,
          signalLevels: typeof dynRaw.signalLevels === 'number' ? dynRaw.signalLevels : undefined,
          batteryFrames: typeof dynRaw.batteryFrames === 'number' ? dynRaw.batteryFrames : undefined,
          batterySprite: typeof dynRaw.batterySprite === 'string' ? dynRaw.batterySprite : undefined,
          batteryFrameSide: typeof dynRaw.batteryFrameSide === 'number' ? dynRaw.batteryFrameSide : undefined,
          batteryChargeFrames:
            typeof dynRaw.batteryChargeFrames === 'number' ? dynRaw.batteryChargeFrames : undefined,
          batteryChargeSprite:
            typeof dynRaw.batteryChargeSprite === 'string' ? dynRaw.batteryChargeSprite : undefined,
          batteryChargeFrameSide:
            typeof dynRaw.batteryChargeFrameSide === 'number' ? dynRaw.batteryChargeFrameSide : undefined,
          batteryPowerSaveFrames:
            typeof dynRaw.batteryPowerSaveFrames === 'number' ? dynRaw.batteryPowerSaveFrames : undefined,
          batteryPowerSaveSprite:
            typeof dynRaw.batteryPowerSaveSprite === 'string' ? dynRaw.batteryPowerSaveSprite : undefined,
          batteryPowerSaveFrameSide:
            typeof dynRaw.batteryPowerSaveFrameSide === 'number' ? dynRaw.batteryPowerSaveFrameSide : undefined,
          batteryPowerSaveChargeFrames:
            typeof dynRaw.batteryPowerSaveChargeFrames === 'number' ? dynRaw.batteryPowerSaveChargeFrames : undefined,
          batteryPowerSaveChargeSprite:
            typeof dynRaw.batteryPowerSaveChargeSprite === 'string' ? dynRaw.batteryPowerSaveChargeSprite : undefined,
          batteryPowerSaveChargeFrameSide:
            typeof dynRaw.batteryPowerSaveChargeFrameSide === 'number' ? dynRaw.batteryPowerSaveChargeFrameSide : undefined,
          batteryBoltOverlay:
            typeof dynRaw.batteryBoltOverlay === 'string' ? dynRaw.batteryBoltOverlay : undefined,
          dataTypes: Array.isArray(dynRaw.dataTypes) ? dynRaw.dataTypes.filter((x: any) => typeof x === 'string') : undefined,
        }
      : undefined;

  return {
    id,
    title: typeof raw.title === 'string' ? raw.title : id,
    author: typeof raw.author === 'string' ? raw.author : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    price: typeof raw.price === 'number' ? raw.price : null,
    version: typeof raw.version === 'string' ? raw.version : null,
    assemblyId: typeof raw.assemblyId === 'string' ? raw.assemblyId : null,
    previews,
    builtInPreviews,
    subResources,
    type: raw.type,
    capabilities: Array.isArray(raw.capabilities) ? raw.capabilities.filter((x: any) => typeof x === 'string') : undefined,
    iconPackageNames: Array.isArray(raw.iconPackageNames)
      ? raw.iconPackageNames.filter((x: any) => typeof x === 'string')
      : undefined,
    statusbarIcons: Array.isArray(raw.statusbarIcons)
      ? raw.statusbarIcons.filter((x: any) => typeof x === 'string')
      : undefined,
    statusbarDynamic,
    extracted: raw.extracted,
    componentAssets: raw.componentAssets && typeof raw.componentAssets === 'object' ? raw.componentAssets : undefined,
  };
}

function normalizeManifest(raw: any): ThemeManifest {
  const themesRaw = Array.isArray(raw?.themes) ? raw.themes : [];
  const fontsRaw = Array.isArray(raw?.fonts) ? raw.fonts : [];
  const aodRaw = Array.isArray(raw?.aod) ? raw.aod : [];
  const themes = themesRaw.map(normalizeThemeMeta).filter(Boolean) as ThemeMeta[];
  const fonts = fontsRaw.map(normalizeThemeMeta).filter(Boolean) as ThemeMeta[];
  const aod = aodRaw.map(normalizeThemeMeta).filter(Boolean) as ThemeMeta[];
  return {
    version: typeof raw?.version === 'number' ? raw.version : 1,
    generatedAt: typeof raw?.generatedAt === 'string' ? raw.generatedAt : null,
    defaultThemeId: typeof raw?.defaultThemeId === 'string' ? raw.defaultThemeId : null,
    themes,
    fonts,
    aod,
  };
}

function buildActiveConfig(themeId: ThemeId, components?: Partial<Record<ThemeComponentKey, ThemeId>>): ActiveThemeConfigV2 {
  return {
    version: 2,
    themeId,
    appliedAt: timeNow(),
    components: {
      icons: components?.icons ?? themeId,
      statusbar: components?.statusbar ?? themeId,
      shade: components?.shade ?? themeId,
    },
  };
}

function buildDefaultActiveConfig(themeId: ThemeId): ActiveThemeConfigV2 {
  return buildActiveConfig(themeId, THEME_CONFIG.defaultComponents);
}

function normalizeActiveConfig(raw: any, fallbackThemeId: ThemeId): ActiveThemeConfigV2 {
  const baseId = typeof raw?.themeId === 'string' ? raw.themeId : fallbackThemeId;
  const componentsRaw = raw?.components && typeof raw.components === 'object' ? raw.components : {};
  const get = (k: ThemeComponentKey) => (typeof componentsRaw?.[k] === 'string' ? componentsRaw[k] : baseId);
  return {
    version: 2,
    themeId: baseId,
    appliedAt: typeof raw?.appliedAt === 'number' ? raw.appliedAt : timeNow(),
    components: {
      icons: get('icons'),
      statusbar: get('statusbar'),
      shade: get('shade'),
    },
  };
}

async function fetchJson(url: string): Promise<any> {
  const resp = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} (${url})`);

  const contentType = (resp.headers.get('content-type') || '').toLowerCase();
  const raw = await resp.text();
  try {
    return JSON.parse(raw);
  } catch (e: any) {
    const snippet = raw.slice(0, 140).replace(/\s+/g, ' ').trim();
    const ctInfo = contentType ? `content-type=${contentType}` : 'content-type=<missing>';
    throw new SyntaxError(`Invalid JSON (${ctInfo}) from ${url}: ${snippet}`);
  }
}

function isLikelyImageResponse(resp: Response): boolean {
  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  // If server doesn't provide content-type, assume OK (best-effort).
  if (!ct) return true;
  if (ct.includes('text/html')) return false;
  if (ct.startsWith('image/')) return true;
  return true;
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'force-cache' });
    if (head.ok || head.status === 304) return isLikelyImageResponse(head);
    if (head.status !== 405) return false;
    // Some servers might not support HEAD; fall back to GET.
    const get = await fetch(url, { method: 'GET', cache: 'force-cache' });
    if (!(get.ok || get.status === 304)) return false;
    return isLikelyImageResponse(get);
  } catch {
    return false;
  }
}

class ThemeServiceImpl {
  private listeners = new Set<() => void>();
  private manifest: ThemeManifest | null = null;
  private manifestPromise: Promise<ThemeManifest> | null = null;

  private active: ActiveThemeConfigV2 | null = null;
  private currentTheme: ThemeMeta | null = null;

  // Per-asset caches (existence checked via HEAD/GET)
  private appAssetCache = new Map<string, string>(); // key: `${themeId}|${component}|${assetName}`
  private appAssetMiss = new Set<string>();
  private appAssetInFlight = new Map<string, Promise<string | null>>();

  onThemeChanged(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private emitChange() {
    for (const cb of Array.from(this.listeners)) cb();
    try {
      BroadcastBus.sendBroadcast({
        action: ACTION_THEME_CHANGED,
        extras: {
          themeId: this.active?.themeId ?? null,
          components: this.active?.components ? { ...this.active.components } : null,
        },
      });
    } catch (e) {
      console.warn('[ThemeService] Failed to send theme changed broadcast', e);
    }
  }

  isReady(): boolean {
    return !!this.manifest && !!this.active;
  }

  getManifest(): ThemeManifest | null {
    return this.manifest;
  }

  getCurrentTheme(): ThemeMeta | null {
    return this.currentTheme;
  }

  getCurrentThemeId(): ThemeId | null {
    return this.active?.themeId ?? null;
  }

  getActiveComponentThemeId(component: ThemeComponentKey): ThemeId | null {
    return this.active?.components?.[component] ?? null;
  }

  private getAnyEntry(themeId: ThemeId | null | undefined): ThemeMeta | null {
    if (!themeId || !this.manifest) return null;
    return (
      this.manifest.themes.find((t) => t.id === themeId) ||
      this.manifest.fonts?.find((t) => t.id === themeId) ||
      this.manifest.aod?.find((t) => t.id === themeId) ||
      null
    );
  }

  private getFullThemeEntry(themeId: ThemeId | null | undefined): ThemeMeta | null {
    if (!themeId || !this.manifest) return null;
    return this.manifest.themes.find((t) => t.id === themeId) || null;
  }

  private getBestDefaultThemeId(): ThemeId | null {
    const m = this.manifest;
    if (!m) return THEME_CONFIG.defaultThemeId;
    const configuredId = THEME_CONFIG.defaultThemeId;
    if (configuredId && m.themes.some((t) => t.id === configuredId)) return configuredId;
    if (m.defaultThemeId && m.themes.some((t) => t.id === m.defaultThemeId)) return m.defaultThemeId;
    return m.themes[0]?.id || configuredId || null;
  }

  private saveActiveConfig(cfg: ActiveThemeConfigV2) {
    debouncedSetItem(THEME_CONFIG.storageKey, JSON.stringify(cfg));
  }

  private loadActiveConfig(): ActiveThemeConfigV2 | null {
    const raw = safeJsonParse<any>(localStorage.getItem(THEME_CONFIG.storageKey));
    return raw ? normalizeActiveConfig(raw, THEME_CONFIG.defaultThemeId) : null;
  }

  private async loadManifest(forceReload = false): Promise<ThemeManifest> {
    if (this.manifest && !forceReload) return this.manifest;
    if (this.manifestPromise && !forceReload) return this.manifestPromise;
    this.manifestPromise = fetchJson(THEME_CONFIG.manifestUrl)
      .then((raw) => normalizeManifest(raw))
      .catch((e) => {
        // Dev 环境下 themes 资源可能不存在（或被 SPA fallback 成 HTML），这里降级为“空 manifest”，避免阻塞启动。
        console.warn('[ThemeService] Failed to load theme manifest, falling back to empty manifest:', e);
        return normalizeManifest({ version: 1, themes: [], fonts: [], aod: [], defaultThemeId: null });
      })
      .then((m) => {
        this.manifest = m;
        return m;
      })
      .finally(() => {
        this.manifestPromise = null;
      });
    return this.manifestPromise;
  }

  async init(): Promise<void> {
    const manifest = await this.loadManifest(false);

    const cfg = this.loadActiveConfig();
    const defaultId = this.getBestDefaultThemeId();
    const baseId = cfg?.themeId && manifest.themes.some((t) => t.id === cfg.themeId) ? cfg.themeId : defaultId;
    if (!baseId) {
      this.active = null;
      this.currentTheme = null;
      this.emitChange();
      return;
    }

    this.active = cfg ? normalizeActiveConfig(cfg, baseId) : buildDefaultActiveConfig(baseId);
    // Validate component theme ids
    for (const k of Object.keys(this.active.components) as ThemeComponentKey[]) {
      const tid = this.active.components[k];
      if (!manifest.themes.some((t) => t.id === tid)) {
        this.active.components[k] = baseId;
      }
    }
    this.currentTheme = this.getFullThemeEntry(this.active.themeId);
    this.saveActiveConfig(this.active);

    // Clear caches on init (manifest may change in dev)
    this.appAssetCache.clear();
    this.appAssetMiss.clear();
    this.appAssetInFlight.clear();

    this.emitChange();
  }

  async getInstalledThemes(forceReload = false): Promise<ThemeMeta[]> {
    const m = await this.loadManifest(forceReload);
    // Sort: prefer free first, then title
    const list = [...m.themes];
    list.sort((a, b) => {
      const pa = a.price ?? 0;
      const pb = b.price ?? 0;
      if (pa !== pb) return pa - pb;
      return a.title.localeCompare(b.title, 'zh-CN');
    });
    return list;
  }

  async getFonts(forceReload = false): Promise<ThemeMeta[]> {
    const m = await this.loadManifest(forceReload);
    return m.fonts || [];
  }

  async getAod(forceReload = false): Promise<ThemeMeta[]> {
    const m = await this.loadManifest(forceReload);
    return m.aod || [];
  }

  async loadThemeMeta(themeId: ThemeId): Promise<ThemeMeta | null> {
    const m = await this.loadManifest(false);
    return m.themes.find((t) => t.id === themeId) || null;
  }

  /** Returns absolute preview URLs for a theme. */
  getThemePreviewUrls(themeId: ThemeId): string[] {
    const t = this.getAnyEntry(themeId);
    const names = (t?.builtInPreviews?.length ? t.builtInPreviews : t?.previews) || [];
    if (!names.length) return [];
    return names.map((n) => `${THEME_CONFIG.baseUrl}/${themeId}/preview/${n}`);
  }

  getThemeWallpaperUrl(themeId: ThemeId): string | null {
    const t = this.getFullThemeEntry(themeId);
    const name = t?.extracted?.wallpaper?.default;
    if (typeof name !== 'string' || !name) return null;
    return `${THEME_CONFIG.baseUrl}/${themeId}/wallpaper/${name}`;
  }

  async applyTheme(themeId: ThemeId): Promise<void> {
    const m = await this.loadManifest(false);
    const meta = m.themes.find((t) => t.id === themeId) || null;
    if (!meta) throw new Error(`[ThemeService] Theme not found in manifest: ${themeId}`);

    this.active = buildActiveConfig(themeId);
    this.currentTheme = meta;
    this.saveActiveConfig(this.active);

    this.appAssetCache.clear();
    this.appAssetMiss.clear();
    this.appAssetInFlight.clear();

    this.emitChange();
  }

  async applyComponent(themeId: ThemeId, component: ThemeComponentCode): Promise<void> {
    if (!this.active) await this.init();
    if (!this.active) throw new Error('[ThemeService] Not initialized');

    const m = await this.loadManifest(false);
    if (!m.themes.some((t) => t.id === themeId)) throw new Error(`[ThemeService] Theme not found: ${themeId}`);

    const map: Partial<Record<ThemeComponentCode, ThemeComponentKey>> = {
      icons: 'icons',
      statusbar: 'statusbar',
      shade: 'shade',
    };
    const key = map[component];
    if (!key) {
      console.warn('[ThemeService] applyComponent: unsupported component key', component);
      return;
    }

    this.active.components[key] = themeId;
    this.active.appliedAt = timeNow();
    this.saveActiveConfig(this.active);

    // Component changes may affect asset resolution
    if (key === 'icons' || key === 'statusbar' || key === 'shade') {
      // For safety, clear appAsset caches (base theme may stay same, but user expects consistency)
      this.appAssetCache.clear();
      this.appAssetMiss.clear();
      this.appAssetInFlight.clear();
    }

    this.emitChange();
  }

  // ----- App icons -----

  getAppIcon(packageName: string | undefined | null): string | null {
    if (!packageName || !this.active || !this.manifest) return null;
    const themeId = this.active.components.icons || this.active.themeId;
    const t = this.getFullThemeEntry(themeId);
    if (!t?.iconPackageNames?.includes(packageName)) return null;
    return `${THEME_CONFIG.baseUrl}/${themeId}/icons/${packageName}.png`;
  }

  async getAppIconAsync(packageName: string | undefined | null): Promise<string | null> {
    return this.getAppIcon(packageName);
  }

  // ----- Status bar icons -----

  getStatusBarIcon(name: string): string | null {
    if (!name || !this.active || !this.manifest) return null;
    const themeId = this.active.components.statusbar || this.active.themeId;
    const t = this.getFullThemeEntry(themeId);
    if (!t?.statusbarIcons?.includes(name)) return null;
    return `${THEME_CONFIG.baseUrl}/${themeId}/statusbar/${name}.png`;
  }

  getStatusBarWifiIcon(level: number): string | null {
    if (!this.active || !this.manifest) return null;
    const themeId = this.active.components.statusbar || this.active.themeId;
    const t = this.getFullThemeEntry(themeId);
    const n = typeof t?.statusbarDynamic?.wifiLevels === 'number' ? (t.statusbarDynamic?.wifiLevels ?? 0) : 0;
    if (n > 0) {
      const idx = Math.min(Math.max(Math.floor(level || 0), 0), n - 1);
      return `${THEME_CONFIG.baseUrl}/${themeId}/statusbar/wifi_${idx}.png`;
    }
    return this.getStatusBarIcon('wifi');
  }

  getStatusBarSignalIcon(level: number): string | null {
    if (!this.active || !this.manifest) return null;
    const themeId = this.active.components.statusbar || this.active.themeId;
    const t = this.getFullThemeEntry(themeId);
    const n = typeof t?.statusbarDynamic?.signalLevels === 'number' ? (t.statusbarDynamic?.signalLevels ?? 0) : 0;
    if (n > 0) {
      const idx = Math.min(Math.max(Math.floor(level || 0), 0), n - 1);
      return `${THEME_CONFIG.baseUrl}/${themeId}/statusbar/signal_${idx}.png`;
    }
    return this.getStatusBarIcon('signal');
  }

  getStatusBarBatterySprite(): { url: string; frames: number; frameSide: number } | null {
    if (!this.active || !this.manifest) return null;
    const themeId = this.active.components.statusbar || this.active.themeId;
    const t = this.getFullThemeEntry(themeId);
    const dyn = t?.statusbarDynamic;
    const frames = typeof dyn?.batteryFrames === 'number' ? dyn.batteryFrames : 0;
    const sprite = typeof dyn?.batterySprite === 'string' ? dyn.batterySprite : '';
    if (!frames || frames <= 0 || !sprite) {
      // Defensive fallback for older / externally-authored manifests that
      // registered `'battery'` in `statusbarIcons` but never set `batterySprite`.
      // Treat the static `battery.png` as a 1-frame sprite so the front-end
      // tinting path applies (charging green / saver yellow / low red).
      const fallback = this.getStatusBarIcon('battery');
      if (fallback) {
        return { url: fallback, frames: 1, frameSide: 40 };
      }
      return null;
    }
    const frameSide = typeof dyn?.batteryFrameSide === 'number' ? dyn.batteryFrameSide : 40;
    return {
      url: `${THEME_CONFIG.baseUrl}/${themeId}/statusbar/${sprite}`,
      frames,
      frameSide,
    };
  }

  /**
   * Lookup a state-specific battery sprite that the theme baked colors into.
   * Returns null when the theme didn't ship that variant — caller should fall
   * back to `getStatusBarBatterySprite()` plus a runtime color tint.
   *
   * `state` priority is the caller's responsibility (we just answer what's
   * available, e.g. if asked for `power_save_charge` and the theme didn't
   * ship it, returns null even though `charge` exists).
   */
  getStatusBarBatteryVariantSprite(
    state: 'charge' | 'power_save' | 'power_save_charge',
  ): { url: string; frames: number; frameSide: number } | null {
    if (!this.active || !this.manifest) return null;
    const themeId = this.active.components.statusbar || this.active.themeId;
    const t = this.getFullThemeEntry(themeId);
    const dyn = t?.statusbarDynamic;
    if (!dyn) return null;
    const map = {
      charge: { f: dyn.batteryChargeFrames, s: dyn.batteryChargeSprite, sd: dyn.batteryChargeFrameSide },
      power_save: { f: dyn.batteryPowerSaveFrames, s: dyn.batteryPowerSaveSprite, sd: dyn.batteryPowerSaveFrameSide },
      power_save_charge: { f: dyn.batteryPowerSaveChargeFrames, s: dyn.batteryPowerSaveChargeSprite, sd: dyn.batteryPowerSaveChargeFrameSide },
    } as const;
    const entry = map[state];
    const frames = typeof entry.f === 'number' ? entry.f : 0;
    const sprite = typeof entry.s === 'string' ? entry.s : '';
    if (!frames || frames <= 0 || !sprite) return null;
    const frameSide = typeof entry.sd === 'number' ? entry.sd : 40;
    return {
      url: `${THEME_CONFIG.baseUrl}/${themeId}/statusbar/${sprite}`,
      frames,
      frameSide,
    };
  }

  /**
   * Static charging-bolt overlay. Composited on top of the normal battery
   * sprite (in a contrast color) when the device is charging — visible at
   * any fill level, including 100% where a "bolt baked into the sprite"
   * approach would be hidden by the body fill.
   */
  getStatusBarBatteryBoltOverlay(): string | null {
    if (!this.active || !this.manifest) return null;
    const themeId = this.active.components.statusbar || this.active.themeId;
    const t = this.getFullThemeEntry(themeId);
    const dyn = t?.statusbarDynamic;
    const overlay = typeof dyn?.batteryBoltOverlay === 'string' ? dyn.batteryBoltOverlay : '';
    if (!overlay) return null;
    return `${THEME_CONFIG.baseUrl}/${themeId}/statusbar/${overlay}`;
  }

  getStatusBarDataTypeIcon(type: string): string | null {
    if (!type) return null;
    return this.getStatusBarIcon(`data_${type}`);
  }

  async getStatusBarIconAsync(name: string): Promise<string | null> {
    return this.getStatusBarIcon(name);
  }

  // ----- System shade backgrounds -----

  getShadeTileBackground(state: 'active' | 'inactive'): string | null {
    if (!this.active || !this.manifest) return null;
    const themeId = this.active.components.shade || this.active.themeId;
    const t = this.getFullThemeEntry(themeId);
    const ok = t?.capabilities?.includes('shade') || t?.extracted?.shade;
    if (!ok) return null;
    return `${THEME_CONFIG.baseUrl}/${themeId}/shade/${state}.png`;
  }

  async getShadeTileBackgroundAsync(state: 'active' | 'inactive'): Promise<string | null> {
    return this.getShadeTileBackground(state);
  }

  // ----- Per-app themed assets (settings icons, SMS bubbles, dialer keys, etc.) -----

  getAppAsset(component: string, assetName: string): string | null {
    const themeId = this.active?.themeId;
    if (!themeId) return null;
    const key = `${themeId}|${component}|${assetName}`;
    const cached = this.appAssetCache.get(key);
    if (cached) return cached;
    for (const n of this.assetNamesToTry(component, assetName)) {
      const resolved = this.resolveFromManifest(themeId, component, n);
      if (typeof resolved === 'string') {
        this.appAssetCache.set(key, resolved);
        return resolved;
      }
    }
    return null;
  }

  private assetNamesToTry(component: string, assetName: string): string[] {
    const alt: string[] = [];
    if (component === 'contact' && assetName === 'call_button') {
      alt.push('dialer_btn_call_bg', 'dialer_btn_call_normal', 'btn_call_sim1_normal', 'btn_call_sim2_normal');
    }
    return [assetName, ...uniq(alt)];
  }

  private resolveFromManifest(themeId: ThemeId, component: string, assetName: string): string | null | undefined {
    const theme = this.manifest?.themes.find((t) => t.id === themeId);
    const compAssets = theme?.componentAssets?.[component];
    if (!compAssets) return undefined; // no manifest data — fall back to probe
    const relPath = compAssets[assetName];
    if (!relPath) return null; // manifest confirms asset does not exist
    return `${THEME_CONFIG.baseUrl}/${themeId}/components/${component}/${relPath}`;
  }

  async getAppAssetAsync(component: string, assetName: string): Promise<string | null> {
    const themeId = this.active?.themeId;
    if (!themeId) return null;
    const key = `${themeId}|${component}|${assetName}`;

    const cached = this.appAssetCache.get(key);
    if (cached) return cached;
    if (this.appAssetMiss.has(key)) return null;

    // Fast path: resolve from manifest index (no network requests)
    const tryNames = this.assetNamesToTry(component, assetName);
    for (const n of tryNames) {
      const resolved = this.resolveFromManifest(themeId, component, n);
      if (resolved === null) continue; // this name not in manifest, try next alt
      if (resolved !== undefined) {
        this.appAssetCache.set(key, resolved);
        return resolved;
      }
      break; // undefined = no manifest data for this component, fall through to probe
    }
    // If manifest had data for this component but none of the names matched, it's a confirmed miss
    const theme = this.manifest?.themes.find((t) => t.id === themeId);
    if (theme?.componentAssets?.[component]) {
      this.appAssetMiss.add(key);
      return null;
    }

    // Slow path: no manifest data for this component — probe URLs (legacy fallback)
    const inflight = this.appAssetInFlight.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      const candidates: string[] = [];
      for (const n of tryNames) {
        candidates.push(
          `${THEME_CONFIG.baseUrl}/${themeId}/components/${component}/res/drawable-xxhdpi/${n}.png`,
          `${THEME_CONFIG.baseUrl}/${themeId}/components/${component}/res/drawable-xhdpi/${n}.png`,
          `${THEME_CONFIG.baseUrl}/${themeId}/components/${component}/res/drawable/${n}.png`,
          `${THEME_CONFIG.baseUrl}/${themeId}/components/${component}/${n}.png`,
          `${THEME_CONFIG.baseUrl}/${themeId}/components/${component}/${n}.9.png`,
          `${THEME_CONFIG.baseUrl}/${themeId}/components/${component}/res/drawable-xxhdpi/${n}.9.png`,
        );
      }

      for (const url of candidates) {
        if (await urlExists(url)) {
          this.appAssetCache.set(key, url);
          return url;
        }
      }
      this.appAssetMiss.add(key);
      return null;
    })()
      .catch(() => null)
      .finally(() => {
        this.appAssetInFlight.delete(key);
      });

    this.appAssetInFlight.set(key, promise);
    return promise;
  }
}

export const ThemeService = new ThemeServiceImpl();
