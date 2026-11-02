-- Nicko Community: archive, bookmark and repost controls.
ALTER TABLE posts ADD COLUMN archived_at TEXT;
ALTER TABLE posts ADD COLUMN repost_of TEXT REFERENCES posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_archive ON posts(user_id, archived_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_repost ON posts(repost_of);

CREATE TABLE IF NOT EXISTS bookmarks (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id, saved_at DESC);
