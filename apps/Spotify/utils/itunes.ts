import { netJson } from '../../../os/NetworkService';
import type { ITunesResponse } from './jsonp';

type ITunesParams = Record<string, string | number | boolean | undefined | null>;

function toQuery(params: ITunesParams) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    query.set(key, String(value));
  }
  return query.toString();
}

export function searchITunes(params: ITunesParams) {
  return netJson<ITunesResponse>(`https://itunes.apple.com/search?${toQuery(params)}`);
}

export function lookupITunes(params: ITunesParams) {
  return netJson<ITunesResponse>(`https://itunes.apple.com/lookup?${toQuery(params)}`);
}
