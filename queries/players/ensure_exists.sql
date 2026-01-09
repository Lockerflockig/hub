INSERT INTO players (id, name) VALUES (?, ?) ON CONFLICT(id) DO NOTHING
