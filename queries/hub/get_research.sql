SELECT id, name, research
FROM players
WHERE alliance_id = ?
  AND is_deleted = 0
;