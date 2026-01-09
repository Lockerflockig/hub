-- Galaxy Views table (Scan-Status)
CREATE TABLE galaxy_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    galaxy INTEGER NOT NULL,
    system INTEGER NOT NULL,

    last_scan_at TEXT,
    scanned_by INTEGER,

    UNIQUE(galaxy, system),
    FOREIGN KEY (scanned_by) REFERENCES users(id)
);

CREATE INDEX idx_galaxy_views_coords ON galaxy_views(galaxy, system);
