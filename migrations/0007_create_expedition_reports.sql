-- Expedition Reports table
CREATE TABLE expedition_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER UNIQUE,

    message TEXT,
    type TEXT,  -- Typ des Funds
    size TEXT,  -- Größe des Funds

    -- Gefundene Ressourcen als JSON
    resources TEXT,

    -- Gefundene Schiffe als JSON
    fleet TEXT,

    report_time TEXT,
    reported_by INTEGER,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (reported_by) REFERENCES users(id)
);
