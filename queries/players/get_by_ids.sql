-- Query für POST /api/players/getstats
-- Holt Stats für mehrere Spieler anhand ihrer IDs
SELECT
    p.id,
    p.name,
    p.alliance_id,
    a.name as alliance_name,
    a.tag as alliance_tag,
    p.main_coordinates,
    p.research,
    p.scores,
    p.inactive_since,
    p.vacation_since,
    p.status
FROM players p
LEFT JOIN alliances a ON p.alliance_id = a.id
WHERE p.id IN (SELECT value FROM json_each(?));
