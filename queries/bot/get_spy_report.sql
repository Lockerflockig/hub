SELECT sr.created_at, sr.galaxy, sr.system, sr.planet,
       p.name AS player_name, a.name AS alliance_name, reporter.name AS reporter_name,
       sr.resources, sr.buildings, sr.fleet, sr.defense
FROM spy_reports sr
LEFT JOIN planets pl ON sr.galaxy = pl.galaxy AND sr.system = pl.system
    AND sr.planet = pl.planet AND pl.type = 'PLANET'
LEFT JOIN players p ON pl.player_id = p.id
LEFT JOIN alliances a ON p.alliance_id = a.id
LEFT JOIN players reporter ON sr.reported_by = reporter.id
WHERE sr.galaxy = ? AND sr.system = ? AND sr.planet = ?
ORDER BY sr.created_at DESC
LIMIT 1
