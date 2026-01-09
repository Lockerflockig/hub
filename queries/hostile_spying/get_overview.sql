-- Aggregierte Fremdspionage-Übersicht
-- Gruppiert nach Angreifer-Koordinaten, mit Spieler/Allianz-Info und Filter
SELECT
    hs.attacker_coordinates AS "attacker_coordinates!",
    p.name AS attacker_name,
    a.tag AS attacker_alliance_tag,
    COUNT(*) AS "spy_count!: i64",
    MAX(hs.report_time) AS last_spy_time,
    GROUP_CONCAT(DISTINCT hs.target_coordinates) AS targets
FROM hostile_spying hs
LEFT JOIN planets pl ON pl.coordinates = hs.attacker_coordinates AND pl.type = 'PLANET'
LEFT JOIN players p ON p.id = pl.player_id
LEFT JOIN alliances a ON a.id = p.alliance_id
WHERE 1=1
    -- Filter: Spionierender Spieler (Name oder Koordinaten)
    AND (? IS NULL OR p.name LIKE '%' || ? || '%' OR hs.attacker_coordinates LIKE '%' || ? || '%')
    -- Filter: Spionierter Spieler (Ziel-Koordinaten)
    AND (? IS NULL OR hs.target_coordinates LIKE '%' || ? || '%')
    -- Filter: Zeitraum (von)
    AND (? IS NULL OR hs.report_time >= ?)
    -- Filter: Zeitraum (bis)
    AND (? IS NULL OR hs.report_time <= ?)
GROUP BY hs.attacker_coordinates
ORDER BY MAX(hs.report_time) DESC
LIMIT ? OFFSET ?;
