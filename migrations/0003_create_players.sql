-- Players table
CREATE TABLE players (
    id INTEGER PRIMARY KEY,  -- externe ID aus pr0game
    name TEXT NOT NULL,
    alliance_id INTEGER,
    main_coordinates TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,

    -- Status
    inactive_since TEXT,
    vacation_since TEXT,

    -- Forschung als JSON: {"106": 10, "108": 12, ...}
    research TEXT,

    -- Scores als JSON: {"total": 1000000, "economy": 500000, ...}
    scores TEXT,

    -- Kampfstatistiken
    combats_total INTEGER NOT NULL DEFAULT 0,
    combats_won INTEGER NOT NULL DEFAULT 0,
    combats_draw INTEGER NOT NULL DEFAULT 0,
    combats_lost INTEGER NOT NULL DEFAULT 0,
    units_shot INTEGER NOT NULL DEFAULT 0,
    units_lost INTEGER NOT NULL DEFAULT 0,

    notice TEXT,
    status TEXT NOT NULL DEFAULT 'new',  -- 'new', 'seen', 'deleted'

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (alliance_id) REFERENCES alliances(id)
);

CREATE INDEX idx_players_alliance ON players(alliance_id);
CREATE INDEX idx_players_status ON players(status);
