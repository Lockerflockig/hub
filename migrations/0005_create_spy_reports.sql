-- Spy Reports table
CREATE TABLE spy_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER UNIQUE,  -- Report-ID aus pr0game
    coordinates TEXT NOT NULL,
    galaxy INTEGER NOT NULL,
    system INTEGER NOT NULL,
    planet INTEGER NOT NULL,
    type TEXT DEFAULT 'PLANET',

    -- Ressourcen als JSON
    resources TEXT,

    -- Gebäude als JSON
    buildings TEXT,

    -- Forschung als JSON
    research TEXT,

    -- Flotte als JSON
    fleet TEXT,

    -- Verteidigung als JSON
    defense TEXT,

    reported_by INTEGER,
    report_time TEXT,  -- Zeitpunkt des Berichts im Spiel

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (reported_by) REFERENCES users(id)
);

CREATE INDEX idx_spy_reports_coords ON spy_reports(galaxy, system, planet, type);
CREATE INDEX idx_spy_reports_time ON spy_reports(created_at);
