SELECT
    sr.id,
    sr.resources,
    sr.buildings,
    sr.research,
    sr.fleet,
    sr.defense,
    sr.created_at,
    p.name as reporter_name
FROM spy_reports sr
LEFT JOIN users u ON sr.reported_by = u.id
LEFT JOIN players p ON u.player_id = p.id
WHERE sr.galaxy = ? AND sr.system = ? AND sr.planet = ? AND sr.type = ?
ORDER BY sr.created_at DESC
LIMIT ?
