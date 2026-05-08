export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  cover: string;
  duration: string;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  subtitle?: string;
  avatar: string;
}

export interface SpotifyPlaylist {
  id: string;
  title: string;
  subtitle?: string;
  cover: string;
  type?: 'playlist' | 'album';
}

export interface SpotifySimilarArtistSection {
  id: string;
  anchor: string;
  avatar: string;
  playlists: SpotifyPlaylist[];
}

export interface SpotifyUser {
  id: string;
  name: string;
  initial: string;
  color?: string;
}

export interface HomeTabItem {
  id: string;
  title: string;
  subtitle?: string;
  cover: string;
  type?: string;
  podcastName?: string;
  description?: string;
  date?: string;
  duration?: string;
  artist?: string;
}

export type PremiumPlanId = 'individual' | 'student' | 'duo' | 'family';

export interface PlaySource {
  type: 'playlist' | 'album' | 'artist' | 'standalone';
  id: string;
  title: string;
  cover?: string;
}

export interface PlayHistoryEntry {
  sourceType: PlaySource['type'];
  sourceId: string;
  sourceTitle: string;
  sourceCover?: string;
  track: SpotifyTrack;
  timestamp: number;
}

export interface SearchHistoryEntry {
  query: string;
  tracks: SpotifyTrack[];
}

export type PremiumPlan = {
  id: PremiumPlanId;
  tag: string | null;
  tagColor?: string;
  name: string;
  titleColor: string;
  pricePrimary: string;
  priceSecondary: string | null;
  features: string[];
  buttonText: string;
  buttonBg: string;
  buttonTextColor: string;
  colorHex: string;
};

