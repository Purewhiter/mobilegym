import { WEATHER_CONSTANTS, MAJOR_CITIES } from '../constants';
import defaults from './defaults.json';
import searchableCitiesJson from './searchableCities.json';
import { getWeatherCitySearchTerms } from '../utils/cityNames';

export type { WeatherCityDefinition, WeatherSettings, SearchableCity } from '../types';
import type { WeatherCityDefinition, WeatherSettings, SearchableCity } from '../types';

const savedCities = (defaults as any).savedCities as WeatherCityDefinition[];
const legacyExtraCities = ((defaults as any).legacyExtraCities ?? []) as WeatherCityDefinition[];
const settings = (defaults as any).settings as WeatherSettings;

export const SEARCHABLE_CITIES: SearchableCity[] = searchableCitiesJson as SearchableCity[];

export const WEATHER_CONFIG = {
  ...WEATHER_CONSTANTS,
  savedCities,
  settings,
  majorCities: MAJOR_CITIES,
} as const;

const ALL: WeatherCityDefinition[] = [...savedCities, ...MAJOR_CITIES, ...legacyExtraCities];

export const WEATHER_CITY_BY_NAME: Record<string, WeatherCityDefinition> = Object.fromEntries(
  ALL.map((c) => [c.name, c])
);

const byId: Record<string, WeatherCityDefinition> = {};
for (const c of SEARCHABLE_CITIES) byId[c.id] = c;
for (const c of ALL) byId[c.id] = c;

export const WEATHER_CITY_BY_ID: Record<string, WeatherCityDefinition> = byId;

export function searchCities(query: string): SearchableCity[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return SEARCHABLE_CITIES.filter(
    (c) => getWeatherCitySearchTerms(c).some((term) => term.includes(q)),
  ).slice(0, 30);
}
