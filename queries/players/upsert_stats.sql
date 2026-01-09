INSERT INTO players (id, name, alliance_id, scores)
VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
                           alliance_id = excluded.alliance_id,
                           scores = excluded.scores,
                           updated_at = CURRENT_TIMESTAMP;
