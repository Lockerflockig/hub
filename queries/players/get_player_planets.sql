SELECT id, name, player_id, coordinates, galaxy, system, planet,
       type, buildings, fleet, defense, resources, prod_h,
       status, created_at, updated_at
FROM planets
WHERE player_id = ?
ORDER BY galaxy, system, planet
