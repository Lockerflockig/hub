SELECT p.galaxy, p.system, p.planet, p.player_id, pl.name AS player_name,
       COALESCE(pl.alliance_id, -1) AS alliance_id, COALESCE(a.name, '-') AS alliance_name,
       EXISTS(SELECT 1 FROM planets m WHERE m.galaxy = p.galaxy AND m.system = p.system
           AND m.planet = p.planet AND m.type = 'MOON') AS has_moon,
       COALESCE(CAST(strftime('%s', gv.last_scan_at) AS INTEGER) * 1000,
           CAST(strftime('%s', p.updated_at) AS INTEGER) * 1000, 0) AS timepoint
FROM planets p
LEFT JOIN players pl ON p.player_id = pl.id
LEFT JOIN alliances a ON pl.alliance_id = a.id
LEFT JOIN galaxy_views gv ON p.galaxy = gv.galaxy AND p.system = gv.system
WHERE p.type = 'PLANET'
ORDER BY p.galaxy, p.system, p.planet
