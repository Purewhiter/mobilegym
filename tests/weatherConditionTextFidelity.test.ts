import { describe, expect, it } from 'vitest';

import weatherBundles from '@/apps/Weather/data/weatherBundles.json';
import { strings } from '@/apps/Weather/res/strings';
import { stringsEn } from '@/apps/Weather/res/strings.en';
import { getLocalizedWeatherText } from '@/apps/Weather/utils/localizedText';

/**
 * `weatherBundles.json` is a snapshot of the QWeather API (regenerate with
 * `apps/Weather/scripts/fetch_weather_snapshot.mjs`), so its condition wording
 * is QWeather's vocabulary, not ours.
 *
 * Benchmark judges read `text` out of that state and compare it to what an
 * agent reports off the screen. The moment the Chinese UI renders a condition
 * as anything other than the stored wording, those two can never agree and the
 * task becomes unpassable no matter how well the agent navigates. That is not
 * hypothetical: rendering the stored `霾` as `轻度雾霾` did exactly this.
 *
 * Refreshing the snapshot in different weather is the way this regresses --
 * QWeather will happily return conditions this app has never rendered before.
 * These tests fail on the snapshot rather than in an evaluation run.
 */

type Bundle = {
  now?: { text?: string; icon?: string };
  daily?: Array<{ textDay?: string; textNight?: string; iconDay?: string; iconNight?: string }>;
  hourly?: Array<{ text?: string; icon?: string }>;
};

type Entry = { bundle?: Bundle };

/** Every (condition text, condition code) pair the snapshot actually contains. */
function conditionSamples(): Array<{ city: string; field: string; text: string; icon?: string }> {
  const out: Array<{ city: string; field: string; text: string; icon?: string }> = [];
  for (const [city, entry] of Object.entries(weatherBundles as Record<string, Entry>)) {
    const bundle = entry?.bundle;
    if (!bundle) continue;

    if (bundle.now?.text) {
      out.push({ city, field: 'now.text', text: bundle.now.text, icon: bundle.now.icon });
    }
    for (const [i, day] of (bundle.daily ?? []).entries()) {
      if (day.textDay) out.push({ city, field: `daily[${i}].textDay`, text: day.textDay, icon: day.iconDay });
      if (day.textNight) out.push({ city, field: `daily[${i}].textNight`, text: day.textNight, icon: day.iconNight });
    }
    for (const [i, hour] of (bundle.hourly ?? []).entries()) {
      if (hour.text) out.push({ city, field: `hourly[${i}].text`, text: hour.text, icon: hour.icon });
    }
  }
  return out;
}

describe('weather condition text fidelity', () => {
  const samples = conditionSamples();

  it('the snapshot actually contains conditions to check', () => {
    expect(samples.length).toBeGreaterThan(100);
  });

  it('renders every stored condition verbatim in Chinese', () => {
    const drifted = samples
      .filter(({ text, icon }) => getLocalizedWeatherText(text, strings, icon) !== text)
      .map(({ city, field, text, icon }) => ({
        where: `${city}.${field}`,
        stored: text,
        rendered: getLocalizedWeatherText(text, strings, icon),
        icon,
      }));

    // Named individually so a failure says which wording drifted, not just how many.
    expect(drifted).toEqual([]);
  });

  it('gives every stored condition an English rendering', () => {
    const untranslated = samples
      .filter(({ text, icon }) => {
        const rendered = getLocalizedWeatherText(text, stringsEn, icon);
        // Falling through to the Chinese wording means neither the code table
        // nor the wording fallback recognised this condition.
        return rendered === text;
      })
      .map(({ city, field, text, icon }) => ({ where: `${city}.${field}`, stored: text, icon }));

    expect(untranslated).toEqual([]);
  });

  it('translates the stored wording exactly, not approximately', () => {
    // The wording carries no severity, so a pattern-matching guess has to
    // invent one ("Light Haze"); the exact table does not.
    expect(getLocalizedWeatherText('霾', stringsEn, '502')).toBe('Haze');
    expect(getLocalizedWeatherText('霾', strings, '502')).toBe('霾');

    // A thunderstorm, which a pattern match would bucket as heavy rain.
    expect(getLocalizedWeatherText('雷阵雨', stringsEn, '302')).toBe('Thunderstorm');
    expect(getLocalizedWeatherText('雷阵雨', strings, '302')).toBe('雷阵雨');

    // Exact translation must not depend on the caller having the code.
    expect(getLocalizedWeatherText('霾', stringsEn)).toBe('Haze');
    expect(getLocalizedWeatherText('雷阵雨', stringsEn)).toBe('Thunderstorm');
  });

  it('makes the English rendering a function of the stored text alone', () => {
    // Judges read `text`. The snapshot has entries whose code disagrees with
    // their wording (`多云` with code 104, "overcast"); if the code won, the
    // English screen would say "Overcast" where the judge expects the
    // translation of `多云`, and a correct agent would be marked wrong.
    const renderingsByText = new Map<string, Set<string>>();
    for (const { text, icon } of samples) {
      const seen = renderingsByText.get(text) ?? new Set<string>();
      seen.add(getLocalizedWeatherText(text, stringsEn, icon));
      seen.add(getLocalizedWeatherText(text, stringsEn));
      renderingsByText.set(text, seen);
    }
    const ambiguous = [...renderingsByText.entries()]
      .filter(([, seen]) => seen.size > 1)
      .map(([text, seen]) => ({ text, renderings: [...seen] }));

    expect(ambiguous).toEqual([]);
    expect(getLocalizedWeatherText('多云', stringsEn, '104')).toBe('Partly Cloudy');
  });

  it('never gives two stored wordings the same English label', () => {
    // Otherwise an English-locale agent cannot tell apart conditions that the
    // judge, reading `text`, does distinguish.
    const textsByLabel = new Map<string, Set<string>>();
    for (const { text, icon } of samples) {
      const label = getLocalizedWeatherText(text, stringsEn, icon);
      textsByLabel.set(label, (textsByLabel.get(label) ?? new Set<string>()).add(text));
    }
    const merged = [...textsByLabel.entries()]
      .filter(([, texts]) => texts.size > 1)
      .map(([label, texts]) => ({ label, texts: [...texts] }));

    expect(merged).toEqual([]);
  });

  it('falls back to the QWeather code only for wording outside the table', () => {
    expect(getLocalizedWeatherText('某种新措辞', stringsEn, '313')).toBe('Freezing Rain');
    expect(getLocalizedWeatherText('某种新措辞', stringsEn, '151')).toBe('Partly Cloudy');
  });

  it('keeps one English label per condition key across zh/en resources', () => {
    const keys = Object.keys(strings).filter((k) => k.startsWith('qw_'));
    expect(keys.length).toBeGreaterThan(40);
    const missing = keys.filter((k) => !(stringsEn as Record<string, string | undefined>)[k]);
    expect(missing).toEqual([]);

    const zh = keys.map((k) => (strings as Record<string, string>)[k]);
    expect(new Set(zh).size).toBe(zh.length);
  });

  it('still renders a condition the code table has never seen', () => {
    // A snapshot refresh can introduce wording this app has never handled.
    // Chinese must pass it through untouched rather than guessing.
    expect(getLocalizedWeatherText('冻雨', strings, '313')).toBe('冻雨');
    expect(getLocalizedWeatherText('龙卷风', strings, '999')).toBe('龙卷风');
  });
});
