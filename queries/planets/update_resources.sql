UPDATE planets
SET resources = ?, updated_at = CURRENT_TIMESTAMP
WHERE coordinates = ? AND type = ?;
