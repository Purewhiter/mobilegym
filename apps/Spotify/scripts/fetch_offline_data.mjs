/**
 * fetch_offline_data.mjs
 *
 * Spotify App 的可选离线数据快照生成工具。
 * 调用 Apple iTunes Search / Lookup API 生成离线音乐数据。
 *
 * 写入三个离线 JSON 文件：
 *   apps/Spotify/data/artistTracks.json   — artist name → SpotifyTrack[]
 *   apps/Spotify/data/searchResults.json  — search term → { songs, artists, albums }
 *   apps/Spotify/data/albumTracks.json    — iTunes collectionId → { playlist, tracks, albumInfo }
 *
 * 三个阶段：artists → search → albums
 * 默认：增量（只补充缺失项）。
 *
 * Usage:
 *   node apps/Spotify/scripts/fetch_offline_data.mjs                        # 增量：补齐所有阶段
 *   node apps/Spotify/scripts/fetch_offline_data.mjs --full                 # 全量重建所有阶段
 *   node apps/Spotify/scripts/fetch_offline_data.mjs --full artists         # 全量 artists + 增量其余
 *   node apps/Spotify/scripts/fetch_offline_data.mjs --full search          # 增量 artists + 全量 search + 增量 albums
 *   node apps/Spotify/scripts/fetch_offline_data.mjs --full albums          # 增量 artists + 增量 search + 全量 albums
 *   node apps/Spotify/scripts/fetch_offline_data.mjs --full artists,search  # 全量前两阶段 + 增量 albums
 *   node apps/Spotify/scripts/fetch_offline_data.mjs --skip albums          # 只跑 artists + search
 *   node apps/Spotify/scripts/fetch_offline_data.mjs --add-artist "Drake"   # 增量追加指定艺人
 *   node apps/Spotify/scripts/fetch_offline_data.mjs --add-search "稻香"    # 增量追加指定搜索词
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../data');

// ─── 需要预下载的数据 ──────────────────────────────────────────────────────────

const ARTISTS = [
  // recentPlays / likedSongs / followedArtists / task defaults
  'Ed Sheeran', 'Billie Eilish', 'Taylor Swift', 'Adele', 'Michael Jackson',
  '周杰伦', '许嵩', '林俊杰',
  // 搜索结果 artistResults 里出现的艺人（Agent 可能点进去）
  'JOLIN蔡依林', '李荣浩', '林宥嘉', '陳奕迅',
  'Harry Styles', 'The Chainsmokers', 'OneRepublic',
  'FINNEAS', 'Kygo', 'Julia Michaels', 'Emeli Sandé', 'Jess Glynne',
  'Jackson 5', 'Diplo', 'Major Lazer', 'Timbaland',
  'benny blanco', 'blackbear', 'j-hope', 'SUGA', 'Tiësto', 'Pop Smoke',
  'J.J.', 'J.J. Lin',  // 林俊杰英文名，iTunes 同时有两个 artistId
];

// 繁简对照：存储时同时写入简体和繁体 key
const TRAD_SIMP_MAP = {
  '周杰伦': '周杰倫',
  '许嵩':   '許嵩',
  '林俊杰': '林俊傑',
};

const SEARCH_TERMS = [
  // 任务 default 歌曲/专辑名
  '青花瓷', 'Shape of You', '1989', 'Thriller',
  // recentPlays 歌曲标题
  'Bad Habits', 'bad guy', 'Welcome to New York', 'Love Story', 'Rolling In the Deep',
  // SwapSongInPlaylist / SpotifySongFullDetailsToRedbook 任务默认歌曲
  '晴天', '搁浅', '修炼爱情',
  // 艺人名（任务 default + followedArtists + recentPlays）
  '周杰伦', '林俊杰', '许嵩',
  'Ed Sheeran', 'Billie Eilish', 'Taylor Swift', 'Adele', 'Michael Jackson',
];

// ─── CLI 参数解析 ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function parseStageSet(flag) {
  const idx = args.indexOf(flag);
  if (idx === -1) return new Set();
  const val = args[idx + 1];
  if (!val || val.startsWith('--')) return new Set(['artists', 'search', 'albums']); // bare flag = all
  return new Set(val.split(',').map(s => s.trim()));
}

const fullStages = parseStageSet('--full');
const skipStages = parseStageSet('--skip');

const extraArtists = [];
const extraSearchTerms = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--add-artist' && args[i + 1]) extraArtists.push(args[++i]);
  if (args[i] === '--add-search' && args[i + 1]) extraSearchTerms.push(args[++i]);
}

const artistList = [...new Set([...ARTISTS, ...extraArtists])];
const searchList = [...new Set([...SEARCH_TERMS, ...extraSearchTerms])];

function isFull(stage) { return fullStages.has(stage) || fullStages.has('all'); }
function isSkip(stage) { return skipStages.has(stage) || skipStages.has('all'); }

// ─── 数据文件读写 ──────────────────────────────────────────────────────────────

function loadJson(filename) {
  const path = resolve(DATA_DIR, filename);
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return {}; }
}

function saveJson(filename, data) {
  const path = resolve(DATA_DIR, filename);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`  写入 ${filename}: ${Object.keys(data).length} 条`);
}

// ─── iTunes API 工具 ───────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function itunesSearch(term, entity = 'song', limit = 10) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=${entity}&media=music&limit=${limit}&country=TW`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iTunes search failed: ${res.status} for "${term}"`);
  return (await res.json()).results || [];
}

async function itunesLookup(collectionId) {
  const url = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song&country=TW&limit=200`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`iTunes lookup failed: ${res.status} for ${collectionId}`);
  return (await res.json()).results || [];
}

// ─── 格式转换 ─────────────────────────────────────────────────────────────────

function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function rawToArtistTrack(r) {
  return {
    id: String(r.trackId || ''),
    title: r.trackName || '',
    artist: r.artistName || '',
    album: r.collectionName || '',
    cover: r.artworkUrl100 || '',
    duration: fmtDuration(r.trackTimeMillis ?? 0),
  };
}

function rawToSearchSong(r) {
  return {
    id: `it_${String(r.trackId || r.collectionId || Math.random())}`,
    title: r.trackName || '',
    artist: r.artistName || '',
    cover: r.artworkUrl100 || '',
    duration: fmtDuration(r.trackTimeMillis ?? 0),
  };
}

// ─── 各阶段实现 ───────────────────────────────────────────────────────────────

async function runArtists(artistTracks, albumIdsToFetch) {
  let fetched = 0, skipped = 0;
  for (const artist of artistList) {
    const key = artist.toLowerCase();
    if (!isFull('artists') && artistTracks[key]) { skipped++; continue; }
    process.stdout.write(`  ${artist} ... `);
    try {
      const results = (await itunesSearch(artist, 'song', 10))
        .filter(r => r.wrapperType === 'track' && r.kind === 'song');
      const mapped = results.map(rawToArtistTrack);
      artistTracks[key] = mapped;
      const tradKey = TRAD_SIMP_MAP[artist]?.toLowerCase();
      if (tradKey) artistTracks[tradKey] = mapped;
      results.forEach(r => { if (r.collectionId) albumIdsToFetch.add(String(r.collectionId)); });
      console.log(`${results.length} tracks${tradKey ? ` (+繁体 key)` : ''}`);
      fetched++;
    } catch (e) { console.log(`ERROR: ${e.message}`); }
    await sleep(300);
  }
  console.log(`  完成：${fetched} 下载，${skipped} 跳过（已缓存）`);
}

async function runSearch(searchResults, albumIdsToFetch) {
  let fetched = 0, skipped = 0;
  for (const term of searchList) {
    const key = term.toLowerCase();
    if (!isFull('search') && searchResults[key]) { skipped++; continue; }
    process.stdout.write(`  "${term}" ... `);
    try {
      const [songRaw, artistRaw, albumRaw] = await Promise.all([
        itunesSearch(term, 'song', 10),
        itunesSearch(term, 'musicArtist', 5),
        itunesSearch(term, 'album', 5),
      ]);
      const songs = songRaw.filter(r => r.wrapperType === 'track' && r.kind === 'song');
      const artists = artistRaw.filter(r => r.wrapperType === 'artist');
      const albums = albumRaw.filter(r => r.wrapperType === 'collection');
      const fallbackCover = songs[0]?.artworkUrl100 || '';

      const entry = {
        songs: songs.map(rawToSearchSong),
        artists: artists.map(r => ({
          artistId: String(r.artistId || ''),
          artistName: r.artistName || '',
          artworkUrl100: r.artworkUrl100 || fallbackCover,
        })),
        albums: albums.map(r => ({
          collectionId: String(r.collectionId || ''),
          collectionName: r.collectionName || '',
          artistName: r.artistName || '',
          artworkUrl100: r.artworkUrl100 || '',
        })),
      };
      searchResults[key] = entry;
      const tradKey = TRAD_SIMP_MAP[term]?.toLowerCase();
      if (tradKey) searchResults[tradKey] = entry;
      songs.forEach(r => { if (r.collectionId) albumIdsToFetch.add(String(r.collectionId)); });
      albums.forEach(r => { if (r.collectionId) albumIdsToFetch.add(String(r.collectionId)); });
      console.log(`${songs.length} songs, ${artists.length} artists, ${albums.length} albums${tradKey ? ` (+繁体 key)` : ''}`);
      fetched++;
    } catch (e) { console.log(`ERROR: ${e.message}`); }
    await sleep(300);
  }
  console.log(`  完成：${fetched} 下载，${skipped} 跳过（已缓存）`);
}

async function runAlbums(albumTracks, albumIdsToFetch) {
  const todo = isFull('albums')
    ? albumIdsToFetch
    : new Set([...albumIdsToFetch].filter(id => !albumTracks[id]));
  let fetched = 0, skipped = albumIdsToFetch.size - todo.size;
  console.log(`  待处理 ${todo.size} 张（跳过 ${skipped} 张已缓存）`);
  for (const albumId of todo) {
    process.stdout.write(`  album ${albumId} ... `);
    try {
      const results = await itunesLookup(albumId);
      const collection = results.find(r => r.wrapperType === 'collection');
      const songs = results.filter(r => r.wrapperType === 'track' && r.kind === 'song');
      if (!collection && songs.length === 0) { console.log('空，跳过'); continue; }

      const playlist = collection ? {
        id: String(collection.collectionId),
        title: collection.collectionName,
        subtitle: `${collection.artistName} • ${collection.copyright || ''}`,
        cover: collection.artworkUrl100?.replace('100x100bb', '600x600bb') || '',
        type: collection.collectionType || 'Album',
      } : {
        id: albumId,
        title: songs[0]?.collectionName || '',
        subtitle: songs[0]?.artistName || '',
        cover: songs[0]?.artworkUrl100?.replace('100x100bb', '600x600bb') || '',
        type: 'Album',
      };

      albumTracks[albumId] = {
        playlist,
        tracks: songs.map(t => ({
          id: String(t.trackId),
          title: t.trackName,
          artist: t.artistName,
          cover: t.artworkUrl100 || '',
          duration: fmtDuration(t.trackTimeMillis ?? 0),
        })),
        albumInfo: {
          title: collection?.collectionName || songs[0]?.collectionName || '',
          trackCount: songs.length,
          year: String(collection?.releaseDate ?? '').slice(0, 4) || '',
        },
      };
      console.log(`${songs.length} tracks — ${playlist.title}`);
      fetched++;
    } catch (e) { console.log(`ERROR: ${e.message}`); }
    await sleep(300);
  }
  console.log(`  完成：${fetched} 下载`);
}

// ─── 主流程 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('模式：');
  console.log(`  artists : ${isSkip('artists') ? '跳过' : isFull('artists') ? '全量' : '增量'}`);
  console.log(`  search  : ${isSkip('search')  ? '跳过' : isFull('search')  ? '全量' : '增量'}`);
  console.log(`  albums  : ${isSkip('albums')  ? '跳过' : isFull('albums')  ? '全量' : '增量'}`);
  if (extraArtists.length) console.log(`  追加艺人: ${extraArtists.join(', ')}`);
  if (extraSearchTerms.length) console.log(`  追加搜索词: ${extraSearchTerms.join(', ')}`);

  const artistTracks = loadJson('artistTracks.json');
  const searchResults = loadJson('searchResults.json');
  const albumTracks   = loadJson('albumTracks.json');
  const albumIdsToFetch = new Set();

  // artists 阶段收集的 albumId 传给 albums 阶段
  const collectFromExisting = () => {
    for (const tracks of Object.values(artistTracks)) {
      for (const t of (tracks || [])) { if (t.id && /^\d+/.test(t.id)) {/* track id, not album */} }
    }
    // 从 searchResults 里已有 albums 的 collectionId 也收集进来
    for (const entry of Object.values(searchResults)) {
      for (const a of (entry?.albums || [])) {
        if (a.collectionId) albumIdsToFetch.add(a.collectionId);
      }
    }
  };
  collectFromExisting();

  if (!isSkip('artists')) {
    console.log('\n── 艺人页 (ArtistPage) ──');
    await runArtists(artistTracks, albumIdsToFetch);
  }

  if (!isSkip('search')) {
    console.log('\n── 搜索页 (SearchPage) ──');
    await runSearch(searchResults, albumIdsToFetch);
  }

  if (!isSkip('albums')) {
    console.log(`\n── 专辑页 (PlaylistPage) — 共 ${albumIdsToFetch.size} 个 ID ──`);
    await runAlbums(albumTracks, albumIdsToFetch);
  }

  console.log('\n── 写入文件 ──');
  saveJson('artistTracks.json', artistTracks);
  saveJson('searchResults.json', searchResults);
  saveJson('albumTracks.json', albumTracks);
  console.log('\n✓ 完成');
}

main().catch(e => { console.error(e); process.exit(1); });
