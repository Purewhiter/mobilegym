import type { VarValue } from './types';
import localeApi, { type Locale } from '../../locale';

function normalizeLocaleVariants(locale: string): string[] {
  const normalized = locale.replace('-', '_');
  const parts = normalized.split('_');
  const lang = parts[0] || 'en';
  const region = parts[1];
  const variants: string[] = [];

  if (lang === 'zh') {
    if (region === 'HK') variants.push('zh_HK', 'zh_TW', 'zh_CN');
    else if (region === 'TW') variants.push('zh_TW', 'zh_HK', 'zh_CN');
    else variants.push('zh_CN', 'zh_HK', 'zh_TW');
  } else if (region) {
    variants.push(`${lang}_${region}`);
  }

  if (lang === 'en') variants.push('en_US');
  variants.push(lang);
  return Array.from(new Set(variants.filter(Boolean)));
}

function getLocaleCandidates(locale: Locale = localeApi.getLocale()): string[] {
  const primary = locale === 'en' ? 'en-US' : 'zh-CN';
  const candidates = normalizeLocaleVariants(primary);
  candidates.push(locale === 'en' ? 'en_US' : 'zh_CN');
  candidates.push('zh_CN', 'en_US');
  return Array.from(new Set(candidates));
}

export function parseStringsXml(xml: string): Record<string, VarValue> {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const strings: Record<string, VarValue> = {};
  for (const el of Array.from(doc.getElementsByTagName('string'))) {
    const name = el.getAttribute('name');
    if (!name) continue;
    strings[name] = el.textContent ?? '';
  }
  return strings;
}

export function buildWmrResourceStrings(
  files: Record<string, string>,
  locale: Locale = localeApi.getLocale(),
): Record<string, VarValue> {
  const merged: Record<string, VarValue> = {};
  const base = files['strings.xml'];
  if (base) Object.assign(merged, parseStringsXml(base));

  for (const localeKey of getLocaleCandidates(locale)) {
    const localized = files[`strings_${localeKey}.xml`];
    if (!localized) continue;
    Object.assign(merged, parseStringsXml(localized));
    break;
  }

  return merged;
}

async function fetchStringsText(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

export async function loadWmrResourceStrings(
  xmlBaseUrl: string,
  locale: Locale = localeApi.getLocale(),
): Promise<Record<string, VarValue>> {
  const files: Record<string, string> = {};
  const baseXml = await fetchStringsText(`${xmlBaseUrl}strings/strings.xml`);
  if (baseXml) files['strings.xml'] = baseXml;
  for (const localeKey of getLocaleCandidates(locale)) {
    const url = `${xmlBaseUrl}strings/strings_${localeKey}.xml`;
    const localizedXml = await fetchStringsText(url);
    if (!localizedXml) continue;
    files[`strings_${localeKey}.xml`] = localizedXml;
    break;
  }
  if (Object.keys(files).length > 0) return buildWmrResourceStrings(files, locale);
  return {};
}
