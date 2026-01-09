-- Recycle Reports table
CREATE TABLE recycle_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER UNIQUE,
    coordinates TEXT NOT NULL,
    galaxy INTEGER NOT NULL,
    system INTEGER NOT NULL,
    planet INTEGER NOT NULL,

    -- Gesammelte Ressourcen
    metal INTEGER DEFAULT 0,
    crystal INTEGER DEFAULT 0,

    -- Trümmerfeld vorher
    metal_tf INTEGER DEFAULT 0,
    crystal_tf INTEGER DEFAULT 0,

    report_time TEXT,
    reported_by INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (reported_by) REFERENCES users(id)
);

CREATE INDEX idx_recycle_reports_coords ON recycle_reports(galaxy, system, planet);
