SELECT
    p.id AS "id!",
    p.external_id,
    p.player_id AS "player_id!",
    p.coordinates AS "coordinates!",
    p.galaxy AS "galaxy!",
    p.system AS "system!",
    p.planet AS "planet!",
    p.type,
    p.buildings,
    p.fleet,
    p.defense,
    p.resources,
    p.prod_h,
    p.status,
    p.created_at,
    p.updated_at
FROM planets p
JOIN players pl ON p.player_id = pl.id
WHERE pl.alliance_id = ?
ORDER BY p.galaxy, p.system, p.planet;
