-- Hostile Spying table
CREATE TABLE hostile_spying (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER UNIQUE,

    attacker_coordinates TEXT,
    target_coordinates TEXT,

    report_time TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hostile_spying_target ON hostile_spying(target_coordinates);
CREATE INDEX idx_hostile_spying_time ON hostile_spying(created_at);
