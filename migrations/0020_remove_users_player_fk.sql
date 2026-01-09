-- Remove foreign key constraint on player_id in users table
-- This allows creating users without an existing player entry
-- SQLite requires table recreation to remove foreign keys

CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT NOT NULL UNIQUE,
    player_id INTEGER,
    alliance_id INTEGER,
    language TEXT NOT NULL DEFAULT 'de',
    last_activity_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP

    -- No foreign keys - player_id and alliance_id are just reference values
);

INSERT INTO users_new SELECT * FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
CREATE INDEX idx_users_api_key ON users(api_key);
