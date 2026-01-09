SELECT
    br.id,
    CAST(br.external_id AS TEXT) as report_id,
    br.attacker_lost,
    br.defender_lost,
    br.metal,
    br.crystal,
    br.deuterium,
    br.debris_metal,
    br.debris_crystal,
    br.created_at,
    p.name as reporter_name
FROM battle_reports br
LEFT JOIN players p ON br.reported_by = p.id
WHERE br.galaxy = ? AND br.system = ? AND br.planet = ?
ORDER BY br.created_at DESC
LIMIT ?
