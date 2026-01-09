-- Get galaxy scan status from system marker planets (position=0)
SELECT
    galaxy AS "galaxy!",
    system AS "system!",
    updated_at AS last_scan_at
FROM planets
WHERE planet = 0
ORDER BY galaxy, system;
