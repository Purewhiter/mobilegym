import defaults from './defaults.json';
import { CONTACTS_CONSTANTS } from '../constants';
import type { CallLogEntry, SimProfile, BusinessHallState } from '../phoneTypes';

const callLogs = defaults.callLogs as CallLogEntry[];
const sims = defaults.sims as SimProfile[];
const businessHall = defaults.businessHall as BusinessHallState;

export const CONTACTS_CONFIG = {
  ...CONTACTS_CONSTANTS,
  ...defaults,
  callLogs,
  sims,
  businessHall,
};
