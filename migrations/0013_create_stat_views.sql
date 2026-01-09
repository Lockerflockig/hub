-- Stat Views table (Statistik-Sync-Status)
CREATE TABLE stat_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_type TEXT NOT NULL,  -- 'player', 'alliance', etc.

    last_sync_at TEXT,
    synced_by INTEGER,

    UNIQUE(stat_type),
    FOREIGN KEY (synced_by) REFERENCES users(id)
);
