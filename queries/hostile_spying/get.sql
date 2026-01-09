-- Query für GET /api/hostile-spying
-- Holt feindliche Spionageberichte mit optionalem Suchfilter und Pagination
SELECT
    id AS "id!",
    external_id,
    attacker_coordinates,
    target_coordinates,
    report_time,
    created_at
FROM hostile_spying
WHERE (? IS NULL OR attacker_coordinates LIKE '%' || ? || '%' OR target_coordinates LIKE '%' || ? || '%')
ORDER BY created_at DESC
LIMIT ? OFFSET ?;
