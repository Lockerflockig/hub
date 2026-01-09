UPDATE players SET alliance_id = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND EXISTS (SELECT 1 FROM alliances WHERE id = ?)
