-- Update expedition_reports: remove size column
-- SQLite requires table recreation to remove columns

CREATE TABLE expedition_reports_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER UNIQUE,

    message TEXT,
    type TEXT,  -- resources, fleet, combat

    -- Gefundene Ressourcen als JSON
    resources TEXT,

    -- Gefundene Schiffe als JSON
    fleet TEXT,

    report_time TEXT,
    reported_by INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (reported_by) REFERENCES players(id)
);

INSERT INTO expedition_reports_new (id, external_id, message, type, resources, fleet, report_time, reported_by, created_at)
SELECT id, external_id, message, type, resources, fleet, report_time, reported_by, created_at
FROM expedition_reports;

DROP TABLE expedition_reports;
ALTER TABLE expedition_reports_new RENAME TO expedition_reports;
