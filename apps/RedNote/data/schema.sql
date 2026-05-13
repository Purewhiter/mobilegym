-- RedNote base dataset schema.
--
-- 该 schema 是 base dataset 的唯一真相源（single source of truth）。
-- 前端 (sqlite-wasm) 和 bench Python (sqlite3) 都读取由 build_base_db.py
-- 根据该 schema 生成的 base.sqlite 文件，字节级一致。
--
-- 设计原则：
--   - 热字段（id/title/author/likes/category/created_at）作为 first-class 列并建索引
--   - 深度嵌套结构（tags 数组、commentList 含 subComments）保留为 JSON 列
--   - 用户运行态（点赞/收藏/草稿/聊天等）仍由 Zustand store 管理，不进 base.sqlite

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id                       TEXT    PRIMARY KEY,
    name                     TEXT    NOT NULL,
    avatar                   TEXT,
    user_cover               TEXT,
    following                INTEGER NOT NULL DEFAULT 0,
    followers                INTEGER NOT NULL DEFAULT 0,
    likes_and_collections    INTEGER NOT NULL DEFAULT 0,
    intro                    TEXT,
    location                 TEXT,
    gender                   TEXT,
    age                      TEXT,
    user_url                 TEXT
);

CREATE TABLE IF NOT EXISTS notes (
    id                  TEXT    PRIMARY KEY,
    title               TEXT    NOT NULL,
    content             TEXT,
    author_id           TEXT    NOT NULL REFERENCES users(id),
    video               TEXT,
    cover               TEXT,
    likes               INTEGER NOT NULL DEFAULT 0,
    collections         INTEGER NOT NULL DEFAULT 0,
    comments_count      INTEGER NOT NULL DEFAULT 0,
    created_at          INTEGER NOT NULL,
    category            TEXT,
    url                 TEXT,
    xsec_token          TEXT,
    tags_json           TEXT,                  -- JSON array of tag strings
    comment_list_json   TEXT                   -- JSON array of comment objects (preserves nested subComments)
);

CREATE TABLE IF NOT EXISTS note_images (
    note_id   TEXT    NOT NULL REFERENCES notes(id),
    ordinal   INTEGER NOT NULL,
    url       TEXT    NOT NULL,
    PRIMARY KEY (note_id, ordinal)
);

-- Indexes for hot query paths used by both frontend and bench:
--   users_name: search user by name (CheckSearchUserField)
--   notes_author: list author's notes (CheckFollowingUserNoteCount, top-liked-by-author tasks)
--   notes_likes: rank notes by likes (top-N analytics)
--   notes_category: filter by HomePage discover category
CREATE INDEX IF NOT EXISTS users_name        ON users(name);
CREATE INDEX IF NOT EXISTS notes_author      ON notes(author_id);
CREATE INDEX IF NOT EXISTS notes_likes       ON notes(likes DESC);
CREATE INDEX IF NOT EXISTS notes_category    ON notes(category);

-- Why no shared VIEWs:
--   We considered baking common queries (feed-by-category, top-N-by-likes,
--   search) into VIEWs so frontend + bench couldn't drift on the SQL itself.
--   But every useful query in this app is parameterized — by `?category`,
--   `?keyword`, `?limit`, etc. — and SQLite VIEWs can't bind parameters at
--   definition time; the caller still has to supply WHERE clauses, which
--   recreates the drift surface. Instead, the canonical SQL strings live in
--   `apps/RedNote/data/queries.ts` and `bench_env/task/rednote/queries.py`,
--   imported and used verbatim by both sides. Any future VIEWs should only
--   be added when they encapsulate truly parameter-free logic (e.g. a
--   derived column or a static JOIN denormalization).
