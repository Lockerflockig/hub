SELECT p.id as player_id, p.name as player_name, pl.coordinates, pl.buildings
FROM players p
         JOIN planets pl ON pl.player_id = p.id
WHERE p.alliance_id = ?
  AND p.is_deleted = 0
  AND pl.buildings IS NOT NULL;
