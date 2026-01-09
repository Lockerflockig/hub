SELECT id, name, player_id, coordinates, galaxy, system, planet,
       type, planet_id, buildings, fleet, defense, resources, prod_h,
       status, created_at, updated_at
FROM planets
WHERE galaxy = ? AND system = ? AND planet > 0 AND (status IS NULL OR status != 'deleted')
ORDER BY planet, type
