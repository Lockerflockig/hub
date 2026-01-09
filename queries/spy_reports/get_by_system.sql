-- Get latest spy reports for a system (one per planet position)
SELECT
    id AS "id!",
    external_id,
    coordinates AS "coordinates!",
    galaxy AS "galaxy!",
    system AS "system!",
    planet AS "planet!",
    type,
    resources,
    buildings,
    research,
    fleet,
    defense,
    reported_by,
    report_time,
    created_at
FROM spy_reports sr
WHERE galaxy = ?
  AND system = ?
  AND created_at = (
    SELECT MAX(created_at)
    FROM spy_reports sr2
    WHERE sr2.galaxy = sr.galaxy
      AND sr2.system = sr.system
      AND sr2.planet = sr.planet
      AND sr2.type = sr.type
  )
ORDER BY planet, type;
