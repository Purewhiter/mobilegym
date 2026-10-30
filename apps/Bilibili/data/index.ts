import defaults from './defaults.json';
import { BILIBILI_CONSTANTS } from '../constants';
import type { BilibiliUser, BilibiliSettings } from '../types';
import { CDN_ROOT } from '../../../os/utils/cdn';
import { createBilibiliAssetResolver } from './assets';

export type { BilibiliUser, BilibiliVideo, RankingVideo, University } from '../types';

const assets = createBilibiliAssetResolver(CDN_ROOT);

export const resolveBilibiliAssetUrl = assets.resolveUrl;
export const resolveBilibiliAssetsDeep = assets.resolveDeep;

const resolvedDefaults = resolveBilibiliAssetsDeep(defaults) as typeof defaults;
const user = resolvedDefaults.user as BilibiliUser;

export const BILIBILI_CONFIG = {
  ...BILIBILI_CONSTANTS,
  ...resolvedDefaults,
  settings: resolvedDefaults.settings as BilibiliSettings,
  user,
};
