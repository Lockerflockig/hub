SELECT
    id AS "id!",
    external_id,
    player_id AS "player_id!",
    coordinates AS "coordinates!",
    galaxy AS "galaxy!",
    system AS "system!",
    planet AS "planet!",
    type,
    buildings,
    fleet,
    defense,
    resources,
    prod_h,
    status,
    created_at,
    updated_at
FROM planets
WHERE player_id = ?
ORDER BY galaxy, system, planet;
