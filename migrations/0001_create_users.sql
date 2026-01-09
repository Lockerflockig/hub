CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key TEXT NOT NULL UNIQUE,
    player_id INTEGER,
    alliance_id INTEGER,
    language TEXT NOT NULL DEFAULT 'de',  -- 'de', 'en', 'fr', etc.
    last_activity_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (player_id) REFERENCES players(id),
    FOREIGN KEY (alliance_id) REFERENCES alliances(id)
);

CREATE INDEX idx_users_api_key ON users(api_key);
