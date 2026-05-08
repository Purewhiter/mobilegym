const SEARCH_CATEGORY_TITLES_EN: Record<string, string> = {
  sc_music: 'Music',
  sc_podcast: 'Podcasts',
  sc_live: 'Live Events',
  sc_2025: '2025\nMusic...',
  sc_upcoming: 'Upcoming\nReleases',
  sc_new: 'New\nHits',
  sc_kpop: 'K-Pop',
  sc_jpop: 'J-Pop',
  sc_pop: 'Pop',
  sc_hiphop: 'Hip-Hop',
  sc_charts: 'Charts',
  sc_pod_charts: 'Podcast\nCharts',
  sc_edu: 'Education',
  sc_doc: 'Documentary',
  sc_cpop: 'Mandopop',
  sc_rock: 'Rock',
  sc_latin: 'Latin',
  sc_discover: 'Discover',
  sc_radio: 'Radio',
  sc_dance: 'Dance/\nElectronic',
  sc_mood: 'Mood',
  sc_indie: 'Indie',
  sc_workout: 'Workout',
  sc_country: 'Country',
  sc_rnb: 'R&B',
  sc_chill: 'Chill',
  sc_sleep: 'Sleep',
  sc_party: 'Party',
  sc_home: 'At Home',
  sc_eras: 'Decades',
  sc_love: 'Love',
  sc_metal: 'Metal',
  sc_jazz: 'Jazz',
  sc_trending: 'Trending',
  sc_ktv: 'KTV',
  sc_classical: 'Classical',
  sc_folk: 'Folk &\nAcoustic',
  sc_focus: 'Focus',
  sc_soul: 'Soul',
  sc_kids: 'Kids &\nFamily',
  sc_gaming: 'Gaming',
  sc_anime: 'Anime',
  sc_netflix: 'Netflix',
  sc_tv: 'TV &\nMovies',
};

const DISCOVER_TITLES_EN: Record<string, string> = {
  sd1: '#Mandopop',
  sd2: '#love',
  sd3: '#vulnerable',
};

export function localizeSpotifyCategoryTitle(id: string, fallback: string, isEnglish: boolean) {
  if (!isEnglish) return fallback;
  return SEARCH_CATEGORY_TITLES_EN[id] ?? fallback;
}

export function localizeSpotifyDiscoverTitle(id: string, fallback: string, isEnglish: boolean) {
  if (!isEnglish) return fallback;
  return DISCOVER_TITLES_EN[id] ?? fallback;
}
