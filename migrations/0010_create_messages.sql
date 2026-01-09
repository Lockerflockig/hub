-- Messages table (nur für Duplikat-Check)
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id INTEGER UNIQUE,  -- Nachrichten-ID aus pr0game

    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
