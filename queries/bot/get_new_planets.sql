SELECT p.id, p.galaxy, p.system, p.planet, pl.name AS player_name,
       a.tag AS alliance_tag, p.created_at
FROM planets p
LEFT JOIN players pl ON p.player_id = pl.id
LEFT JOIN alliances a ON pl.alliance_id = a.id
WHERE p.status = 'new' AND p.type = 'PLANET'
ORDER BY p.galaxy, p.system, p.planet
