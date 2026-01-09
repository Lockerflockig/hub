SELECT id, name, COALESCE(CAST(strftime('%s', updated_at) AS INTEGER) * 1000, 0) AS timepoint
FROM alliances
ORDER BY id
