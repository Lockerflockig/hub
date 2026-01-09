SELECT name, score_total, score_fleet, score_buildings, inactive_since
FROM players
WHERE inactive_since IS NOT NULL AND vacation_since IS NULL AND is_deleted = 0
ORDER BY score_total DESC
LIMIT 20
