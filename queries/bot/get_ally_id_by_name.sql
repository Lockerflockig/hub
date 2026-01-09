SELECT id FROM alliances WHERE LOWER(name) = LOWER(?) OR LOWER(tag) = LOWER(?) LIMIT 1
