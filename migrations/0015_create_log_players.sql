-- Log Players table (Änderungshistorie)
CREATE TABLE log_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,

    event_type TEXT NOT NULL,  -- 'created', 'alliance_change', 'status_change', etc.
    old_value TEXT,
    new_value TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX idx_log_players_player ON log_players(player_id);
