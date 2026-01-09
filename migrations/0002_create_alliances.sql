-- Alliances table
CREATE TABLE alliances (
    id INTEGER PRIMARY KEY,  -- externe ID aus pr0game
    name TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
