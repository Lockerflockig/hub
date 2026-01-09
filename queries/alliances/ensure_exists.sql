INSERT INTO alliances (id, name, tag) VALUES (?, ?, ?)
ON CONFLICT(id) DO UPDATE SET tag = excluded.tag, updated_at = CURRENT_TIMESTAMP
