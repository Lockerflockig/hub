-- Configuration table for server-wide settings
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Default universe configuration
INSERT OR IGNORE INTO config (key, value) VALUES ('galaxies', '9');
INSERT OR IGNORE INTO config (key, value) VALUES ('systems', '499');
