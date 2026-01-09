-- Planets table
CREATE TABLE planets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER,  -- Planet-ID aus pr0game (optional)
    player_id INTEGER NOT NULL,
    coordinates TEXT NOT NULL,  -- "1:23:4"
    galaxy INTEGER NOT NULL,
    system INTEGER NOT NULL,
    planet INTEGER NOT NULL,
    type TEXT DEFAULT 'PLANET',  -- 'PLANET' oder 'MOON'

    -- Gebäude als JSON: {"1": 15, "2": 12, ...}
    buildings TEXT,

    -- Flotte als JSON: {"202": 100, "203": 50, ...}
    fleet TEXT,

    -- Verteidigung als JSON: {"401": 20, "402": 10, ...}
    defense TEXT,

    -- Ressourcen als JSON: {"901": 50000, "902": 30000, "903": 10000}
    resources TEXT,

    -- Berechnete Werte
    prod_h INTEGER,  -- Produktion pro Stunde

    status TEXT DEFAULT 'new',  -- 'new', 'seen', 'deleted'

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (player_id) REFERENCES players(id),
    UNIQUE(coordinates, type)
);

CREATE INDEX idx_planets_player ON planets(player_id);
CREATE INDEX idx_planets_coords ON planets(galaxy, system, planet);
CREATE INDEX idx_planets_status ON planets(status);
