import type { VarValue } from './types';

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

function getLocaleCandidates(): string[] {
  const langs = typeof navigator !== 'undefined'
    ? (navigator.languages?.length ? navigator.languages : [navigator.language])
    : ['zh-CN'];
  const candidates: string[] = [];
  for (const lang of langs) {
    candidates.push(...normalizeLocaleVariants(lang || 'zh-CN'));
  }
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
): Record<string, VarValue> {
  const merged: Record<string, VarValue> = {};
  const base = files['strings.xml'];
  if (base) Object.assign(merged, parseStringsXml(base));

  for (const locale of getLocaleCandidates()) {
    const localized = files[`strings_${locale}.xml`];
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

export async function loadWmrResourceStrings(xmlBaseUrl: string): Promise<Record<string, VarValue>> {
  const files: Record<string, string> = {};
  const baseXml = await fetchStringsText(`${xmlBaseUrl}strings/strings.xml`);
  if (baseXml) files['strings.xml'] = baseXml;
  for (const locale of getLocaleCandidates()) {
    const url = `${xmlBaseUrl}strings/strings_${locale}.xml`;
    const localizedXml = await fetchStringsText(url);
    if (!localizedXml) continue;
    files[`strings_${locale}.xml`] = localizedXml;
    break;
  }
  if (Object.keys(files).length > 0) return buildWmrResourceStrings(files);
  return {};
}
