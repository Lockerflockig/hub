INSERT INTO planets (name, player_id, coordinates, galaxy, system, planet, type, planet_id)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(coordinates, type) DO UPDATE SET
    name = excluded.name,
    player_id = excluded.player_id,
    planet_id = COALESCE(excluded.planet_id, planets.planet_id),
    updated_at = CURRENT_TIMESTAMP
