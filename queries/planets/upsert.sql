INSERT INTO planets (name, player_id, coordinates, galaxy, system, planet, type)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(coordinates, type) DO UPDATE SET
    name = excluded.name,
    player_id = excluded.player_id,
    updated_at = CURRENT_TIMESTAMP;
