-- Battle Reports table
CREATE TABLE battle_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER UNIQUE,
    coordinates TEXT NOT NULL,
    galaxy INTEGER NOT NULL,
    system INTEGER NOT NULL,
    planet INTEGER NOT NULL,
    type TEXT DEFAULT 'PLANET',

    attacker_lost INTEGER DEFAULT 0,
    defender_lost INTEGER DEFAULT 0,

    -- Beute
    metal INTEGER DEFAULT 0,
    crystal INTEGER DEFAULT 0,
    deuterium INTEGER DEFAULT 0,

    -- Trümmerfeld
    debris_metal INTEGER DEFAULT 0,
    debris_crystal INTEGER DEFAULT 0,

    report_time TEXT,
    reported_by INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (reported_by) REFERENCES users(id)
);

CREATE INDEX idx_battle_reports_coords ON battle_reports(galaxy, system, planet);
