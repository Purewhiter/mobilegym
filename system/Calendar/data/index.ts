import defaults from './defaults.json';
import { CALENDAR_CONSTANTS } from '../constants';
import type { CalendarSettings } from '../types';

export const CALENDAR_CONFIG = {
  ...CALENDAR_CONSTANTS,
  ...defaults,
  settings: defaults.settings as CalendarSettings,
};

