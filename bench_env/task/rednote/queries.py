"""RedNote SQL query templates — single source of truth shared with the
frontend (`apps/RedNote/data/queries.ts`).

KEEP IN SYNC WITH that file. Both sides issue these queries against the same
`apps/RedNote/data/base.sqlite`; a string drift here surfaces as judge/task
output mismatching what the simulator actually renders.

Convention: positional `?` placeholders so the strings drop straight into
`sqlite3.Connection.execute(sql, params)` without rebind tricks.
"""
from __future__ import annotations

# ── Column projection lists ────────────────────────────────────────────
#
# Mirror of the frontend's `NOTE_COLUMNS` / `USER_COLUMNS`. We list the
# columns explicitly so that `_user_row_to_dict` / `_note_row_to_dict` are
# index-stable and adding a column requires touching both sides.

NOTE_COLUMNS: tuple[str, ...] = (
    "id", "title", "content", "author_id", "video", "cover",
    "likes", "collections", "comments_count", "created_at",
    "category", "url", "xsec_token", "tags_json", "comment_list_json",
)

USER_COLUMNS: tuple[str, ...] = (
    "id", "name", "avatar", "user_cover", "following", "followers",
    "likes_and_collections", "intro", "location", "gender", "age", "user_url",
)

_NOTE_COLS_SQL = ", ".join(NOTE_COLUMNS)
_USER_COLS_SQL = ", ".join(USER_COLUMNS)

# ── Point lookups ──────────────────────────────────────────────────────

Q_NOTE_BY_ID = f"SELECT {_NOTE_COLS_SQL} FROM notes WHERE id = ?"
Q_USER_BY_ID = f"SELECT {_USER_COLS_SQL} FROM users WHERE id = ?"
Q_IMAGES_BY_NOTE_ID = "SELECT url FROM note_images WHERE note_id = ? ORDER BY ordinal"

# ── Listing / pagination ───────────────────────────────────────────────

Q_ALL_FEED_IDS = "SELECT id FROM notes ORDER BY rowid"
Q_FEED_IDS_BY_CATEGORY = "SELECT id FROM notes WHERE category = ? ORDER BY rowid"
Q_ALL_USER_IDS = "SELECT id FROM users"

Q_NOTES_BY_AUTHOR = (
    f"SELECT {_NOTE_COLS_SQL} FROM notes WHERE author_id = ? ORDER BY created_at DESC"
)
Q_NOTE_IDS_BY_AUTHOR = "SELECT id FROM notes WHERE author_id = ? ORDER BY created_at DESC"

# ── Search ─────────────────────────────────────────────────────────────

Q_SEARCH_NOTES = f"""
SELECT {_NOTE_COLS_SQL} FROM notes
 WHERE title LIKE ? OR content LIKE ? OR category LIKE ?
 ORDER BY likes DESC
 LIMIT ?
"""

Q_SEARCH_USERS = f"""
SELECT {_USER_COLS_SQL} FROM users
 WHERE name LIKE ?
 ORDER BY followers DESC
 LIMIT ?
"""

# ── Ranking ────────────────────────────────────────────────────────────

Q_TOP_NOTES_BY_LIKES = f"SELECT {_NOTE_COLS_SQL} FROM notes ORDER BY likes DESC LIMIT ?"
Q_TOP_NOTE_FOR_AUTHOR = (
    f"SELECT {_NOTE_COLS_SQL} FROM notes WHERE author_id = ? ORDER BY likes DESC LIMIT 1"
)

# ── Reverse indexes ────────────────────────────────────────────────────

Q_ALL_NOTE_COMMENT_LISTS = (
    "SELECT id, comment_list_json FROM notes WHERE comment_list_json IS NOT NULL"
)
