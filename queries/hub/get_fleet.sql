SELECT
  p.id as player_id,
  p.name as player_name,
  p.score_fleet,
  pl.fleet
FROM players p
LEFT JOIN planets pl ON pl.player_id = p.id
  AND pl.status != 'deleted'
  AND pl.fleet IS NOT NULL
WHERE p.alliance_id = ?
  AND p.is_deleted = 0;
