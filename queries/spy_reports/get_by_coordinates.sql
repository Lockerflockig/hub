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
FROM spy_reports
WHERE galaxy = ?
  AND system = ?
  AND planet = ?
  AND type = ?
ORDER BY created_at DESC
LIMIT ?;
