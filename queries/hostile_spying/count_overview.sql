-- Zählt die Anzahl der eindeutigen Angreifer für Pagination
SELECT COUNT(DISTINCT hs.attacker_coordinates) AS "total!"
FROM hostile_spying hs
LEFT JOIN planets pl ON pl.coordinates = hs.attacker_coordinates AND pl.type = 'PLANET'
LEFT JOIN players p ON p.id = pl.player_id
WHERE 1=1
    -- Filter: Spionierender Spieler (Name oder Koordinaten)
    AND (? IS NULL OR p.name LIKE '%' || ? || '%' OR hs.attacker_coordinates LIKE '%' || ? || '%')
    -- Filter: Spionierter Spieler (Ziel-Koordinaten)
    AND (? IS NULL OR hs.target_coordinates LIKE '%' || ? || '%')
    -- Filter: Zeitraum (von)
    AND (? IS NULL OR hs.report_time >= ?)
    -- Filter: Zeitraum (bis)
    AND (? IS NULL OR hs.report_time <= ?);
