import type { RedditCommunity } from './types';

// 精选社区（应用内置,展示在 SearchPage 的"社区"分类）
export const REDDIT_COMMUNITY_DEFAULTS: RedditCommunity[] = [
  {
    id: 'com_superman',
    name: 'r/superman',
    members: '274k',
    isSpotlight: true,
    spotlightTitle: 'From Lex Luthor to Krypto the Superdog, share your Superman teaser takeaway',
    spotlightImage: 'icons/001.png',
    icon: 'icons/image_001.png',
  },
  {
    id: 'com_stalker',
    name: 'r/stalker',
    members: '572k',
    isSpotlight: true,
    spotlightTitle: 'Everything you need to know about thelatest S.T.A.L.K.E.R. 2 patch',
    spotlightImage: 'icons/002.png',
    icon: 'icons/image_002.png',
  },
  {
    id: 'com_confession',
    name: 'r/confession',
    members: '11.8m',
    isSpotlight: true,
    spotlightTitle: 'A dedicated group for those with a guiltyconscience',
    spotlightImage: 'icons/003.png',
    icon: 'icons/image_003.png',
  },
  {
    id: 'com_formula1',
    name: 'r/formula1',
    members: '6.5m',
    isSpotlight: true,
    spotlightTitle: 'What are your thoughts on Checo"s departure from Red Bull?',
    spotlightImage: 'icons/004.png',
    icon: 'icons/image_004.png',
  },
  {
    id: 'com_BuyItForLife',
    name: 'r/BuyItForLife',
    members: '3.5m',
    isSpotlight: true,
    spotlightTitle: 'Ideas for presents designed to lastforever',
    spotlightImage: 'icons/005.png',
    icon: 'icons/image_005.png',
  },
  {
    id: 'com_ChristmasCats',
    name: 'r/ChristmasCats',
    members: '19.2k',
    isSpotlight: true,
    spotlightTitle: 'Just some festive felines to brightenyour day',
    spotlightImage: 'icons/006.png',
    icon: 'icons/image_006.png',
  },
];
