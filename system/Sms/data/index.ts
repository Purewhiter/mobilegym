import defaults from './defaults.json';
const settings = (defaults.settings ?? {}) as Record<string, boolean>;

export const SMS_CONFIG = {
  settings,
};
