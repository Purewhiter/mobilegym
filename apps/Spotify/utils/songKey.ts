import type { SpotifyTrack } from '../types';

/**
 * A song is its title + artist, not its id. The same song reaches the UI from
 * several catalogs (seed lists, search results, album and artist pages), and
 * each catalog numbers it differently -- one song can have half a dozen ids.
 */
export function songKey(track: Pick<SpotifyTrack, 'title' | 'artist'>): string {
  return `${track.title.trim().toLowerCase()}||${track.artist.trim().toLowerCase()}`;
}
