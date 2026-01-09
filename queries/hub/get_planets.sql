SELECT
    pl.id as player_id,
    pl.name as player_name,
    p.coordinates,
    p.buildings,
    p.points
FROM planets p
         JOIN players pl ON p.player_id = pl.id
WHERE pl.alliance_id = ?
ORDER BY pl.name, p.galaxy, p.system, p.planet;
