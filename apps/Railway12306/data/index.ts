import defaults from './defaults.json';
import { RAILWAY12306_CONSTANTS, SERVICE_PHONES } from '../constants';

export const RAILWAY12306_CONFIG = {
  ...RAILWAY12306_CONSTANTS,
  ...defaults,
  servicePhones: SERVICE_PHONES,
};

