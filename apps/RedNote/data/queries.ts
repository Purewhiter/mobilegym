/**
 * RedNote SQL query templates — single source of truth shared by
 * frontend (@sqlite.org/sqlite-wasm) and bench Python (sqlite3).
 *
 * KEEP IN SYNC WITH: bench_env/task/rednote/queries.py
 *
 * Both files declare the same SQL strings under the same exported name.
 * If you change a query here, change it there. Live tests + bench tasks
 * both exercise these queries against the same `base.sqlite`, so a drift
 * will surface as a test failure.
 *
 * Why string constants instead of named-query files: keeps each language
 * idiomatic (TS imports, Python imports, no parser needed), and the
 * paired-file convention is easy to grep + diff.
 *
 * Convention: positional `?` placeholders so both bind styles agree.
 */

// ── Column projection lists ────────────────────────────────────────────
//
// Frontends materialize SELECTed rows into typed objects (User / Note).
// Centralizing the column list keeps the row→object mapper in lockstep
// with the SELECT — if a new column is added, both the SELECT and the
// mapper change together.

export const NOTE_COLUMNS = [
    'id', 'title', 'content', 'author_id', 'video', 'cover',
    'likes', 'collections', 'comments_count', 'created_at',
    'category', 'url', 'xsec_token', 'tags_json', 'comment_list_json',
] as const;

export const USER_COLUMNS = [
    'id', 'name', 'avatar', 'user_cover', 'following', 'followers',
    'likes_and_collections', 'intro', 'location', 'gender', 'age', 'user_url',
] as const;

const NOTE_COLS_SQL = NOTE_COLUMNS.join(', ');
const USER_COLS_SQL = USER_COLUMNS.join(', ');

// ── Point lookups ──────────────────────────────────────────────────────

/** Single note by primary key. Returns 0 or 1 rows. */
export const Q_NOTE_BY_ID =
    `SELECT ${NOTE_COLS_SQL} FROM notes WHERE id = ?`;

/** Single user by primary key. Returns 0 or 1 rows. */
export const Q_USER_BY_ID =
    `SELECT ${USER_COLS_SQL} FROM users WHERE id = ?`;

/** All image URLs (ordered) for a single note. */
export const Q_IMAGES_BY_NOTE_ID =
    'SELECT url FROM note_images WHERE note_id = ? ORDER BY ordinal';

// ── Listing / pagination ───────────────────────────────────────────────

/** Base feed: every note id in canonical (insertion) order.
 *  Frontend filters/paginates in JS for the small ~4k row case. */
export const Q_ALL_FEED_IDS = 'SELECT id FROM notes ORDER BY rowid';

/** Feed ids filtered by category in canonical order. */
export const Q_FEED_IDS_BY_CATEGORY =
    'SELECT id FROM notes WHERE category = ? ORDER BY rowid';

/** All known user ids (no ordering guarantee). */
export const Q_ALL_USER_IDS = 'SELECT id FROM users';

/** Notes authored by a given user, newest first.
 *  Author timeline (UserPage published tab). */
export const Q_NOTES_BY_AUTHOR =
    `SELECT ${NOTE_COLS_SQL} FROM notes WHERE author_id = ? ORDER BY created_at DESC`;

/** Note ids only (cheap projection) for an author. */
export const Q_NOTE_IDS_BY_AUTHOR =
    'SELECT id FROM notes WHERE author_id = ? ORDER BY created_at DESC';

// ── Search ─────────────────────────────────────────────────────────────
//
// SearchPage does substring match against title+content for notes, and
// against name for users. LIKE %?% is fine at this dataset size (4221
// notes, 15000 users → ~20ms full scan on sqlite-wasm).

/** Search notes by substring in title OR content OR category; rank by likes desc.
 *  Bind the same pattern three times: (?1, ?2, ?3 if your driver re-binds, else
 *  pass `[pat, pat, pat, limit]`). The category widen mirrors the prior
 *  full-corpus JS filter that matched note.category substrings. */
export const Q_SEARCH_NOTES =
    `SELECT ${NOTE_COLS_SQL} FROM notes
     WHERE title LIKE ? OR content LIKE ? OR category LIKE ?
     ORDER BY likes DESC
     LIMIT ?`;

/** Search users by substring in name; rank by followers desc. */
export const Q_SEARCH_USERS =
    `SELECT ${USER_COLS_SQL} FROM users
     WHERE name LIKE ?
     ORDER BY followers DESC
     LIMIT ?`;

// ── Ranking / top-N (used by bench judges + UI hot feeds) ──────────────

/** Top-N notes by likes overall (City/Hot feed surface). */
export const Q_TOP_NOTES_BY_LIKES =
    `SELECT ${NOTE_COLS_SQL} FROM notes ORDER BY likes DESC LIMIT ?`;

/** Top-liked note for a given author (judge surface for "top liked title"). */
export const Q_TOP_NOTE_FOR_AUTHOR =
    `SELECT ${NOTE_COLS_SQL} FROM notes WHERE author_id = ?
     ORDER BY likes DESC LIMIT 1`;

// ── Reverse indexes ────────────────────────────────────────────────────
//
// `comment_list_json` is opaque to SQL — we can't query "which note owns
// comment X" through pure DDL without normalizing. The frontend builds an
// in-memory inverse index on first need; bench has the same logic in
// Python. The query below pulls the raw JSON blobs so each side can build
// its own inverse map identically.

/** All notes' (id, comment_list_json) for building the comment→note inverse
 *  index. Both sides skip notes with empty comment_list_json. */
export const Q_ALL_NOTE_COMMENT_LISTS =
    'SELECT id, comment_list_json FROM notes WHERE comment_list_json IS NOT NULL';
