import type { SettingsIconData, SettingsMainSection, SettingsPage } from '../types';

export type SettingsPagesData = {
  icons: Record<string, SettingsIconData>;
  mainSections: SettingsMainSection[];
  pages: Record<string, SettingsPage>;
};

let cached: SettingsPagesData | null = null;
let inflight: Promise<SettingsPagesData> | null = null;

export async function loadPages(): Promise<SettingsPagesData> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const url = new URL('./pages.json', import.meta.url).href;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`[Settings] 加载 pages.json 失败：${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as SettingsPagesData;
    cached = json;
    return json;
  })().catch(err => { inflight = null; throw err; });

  return inflight;
}

export function getPagesSync(): SettingsPagesData | null {
  return cached;
}

export function clearPagesCache() {
  cached = null;
  inflight = null;
}

export async function preload(): Promise<void> {
  await loadPages();
}
