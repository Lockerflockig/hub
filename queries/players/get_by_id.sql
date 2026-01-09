SELECT
    p.*,
    a.name as alliance_name,
    a.tag as alliance_tag
FROM players p
LEFT JOIN alliances a ON p.alliance_id = a.id
WHERE p.id = ?;