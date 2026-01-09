SELECT p.id, p.name, p.player_id, p.coordinates, p.galaxy, p.system, p.planet,
       p.type, p.buildings, p.fleet, p.defense, p.resources, p.prod_h,
       p.status, p.created_at, p.updated_at
FROM planets p
JOIN players pl ON p.player_id = pl.id
WHERE pl.alliance_id = ?
ORDER BY p.galaxy, p.system, p.planet
