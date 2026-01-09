-- Flights table
CREATE TABLE flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER UNIQUE,

    player_id INTEGER,
    origin_coordinates TEXT,
    target_coordinates TEXT,

    mission_type INTEGER,

    -- Flotte als JSON
    fleet TEXT,

    -- Ressourcen als JSON
    resources TEXT,

    departure_time TEXT,
    arrival_time TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX idx_flights_player ON flights(player_id);
