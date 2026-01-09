-- Change reported_by foreign key from users(id) to players(id)
-- SQLite requires table recreation to change foreign keys

-- Battle Reports
CREATE TABLE battle_reports_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER UNIQUE,
    coordinates TEXT NOT NULL,
    galaxy INTEGER NOT NULL,
    system INTEGER NOT NULL,
    planet INTEGER NOT NULL,
    type TEXT DEFAULT 'PLANET',

    attacker_lost INTEGER DEFAULT 0,
    defender_lost INTEGER DEFAULT 0,

    metal INTEGER DEFAULT 0,
    crystal INTEGER DEFAULT 0,
    deuterium INTEGER DEFAULT 0,

    debris_metal INTEGER DEFAULT 0,
    debris_crystal INTEGER DEFAULT 0,

    report_time TEXT,
    reported_by INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (reported_by) REFERENCES players(id)
);

INSERT INTO battle_reports_new SELECT * FROM battle_reports;
DROP TABLE battle_reports;
ALTER TABLE battle_reports_new RENAME TO battle_reports;
CREATE INDEX idx_battle_reports_coords ON battle_reports(galaxy, system, planet);

-- Expedition Reports
CREATE TABLE expedition_reports_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER UNIQUE,

    message TEXT,
    type TEXT,
    size TEXT,

    resources TEXT,
    fleet TEXT,

    report_time TEXT,
    reported_by INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (reported_by) REFERENCES players(id)
);

INSERT INTO expedition_reports_new SELECT * FROM expedition_reports;
DROP TABLE expedition_reports;
ALTER TABLE expedition_reports_new RENAME TO expedition_reports;

-- Recycle Reports
CREATE TABLE recycle_reports_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER UNIQUE,
    coordinates TEXT NOT NULL,
    galaxy INTEGER NOT NULL,
    system INTEGER NOT NULL,
    planet INTEGER NOT NULL,

    metal INTEGER DEFAULT 0,
    crystal INTEGER DEFAULT 0,

    metal_tf INTEGER DEFAULT 0,
    crystal_tf INTEGER DEFAULT 0,

    report_time TEXT,
    reported_by INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (reported_by) REFERENCES players(id)
);

INSERT INTO recycle_reports_new SELECT * FROM recycle_reports;
DROP TABLE recycle_reports;
ALTER TABLE recycle_reports_new RENAME TO recycle_reports;
CREATE INDEX idx_recycle_reports_coords ON recycle_reports(galaxy, system, planet);
