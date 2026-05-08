import { strings } from './res/strings';
import type { WorldCity } from './types';
import citiesData from './data/cities.json';

export const CLOCK_CONSTANTS = {
  alarmSoundLabel: strings.alarm_default_sound,
  cities: citiesData as WorldCity[],
};
