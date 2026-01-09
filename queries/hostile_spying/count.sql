-- Zählt feindliche Spionageberichte für Pagination
SELECT COUNT(*) as total
FROM hostile_spying
WHERE (? IS NULL OR attacker_coordinates LIKE '%' || ? || '%' OR target_coordinates LIKE '%' || ? || '%');
