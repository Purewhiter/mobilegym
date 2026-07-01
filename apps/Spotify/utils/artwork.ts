import type { SpotifyTrack } from '../types';

const APPLE_ARTWORK_SIZE_RE = /\/(\d+)x(\d+)(bb)?(?=\.[a-z0-9]+(?:\?|$))/i;

export function resizeAppleArtworkUrl(raw: string | undefined, size: number): string {
  if (!raw) return '';
  return raw.replace(APPLE_ARTWORK_SIZE_RE, `/${size}x${size}$3`);
}

export function inferLargeArtworkUrl(raw: string | undefined): string {
  if (!raw) return '';
  const resized = resizeAppleArtworkUrl(raw, 1000);
  return resized === raw ? '' : resized;
}

export function getTrackCover(track: Pick<SpotifyTrack, 'cover'> | null | undefined): string {
  return track?.cover || '';
}

export function getTrackCoverLarge(track: Pick<SpotifyTrack, 'cover' | 'coverLarge'> | null | undefined): string {
  return track?.coverLarge || track?.cover || '';
}
