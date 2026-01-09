SELECT galaxy, system, updated_at AS last_scan_at
FROM planets
WHERE planet = 0
ORDER BY galaxy, system
