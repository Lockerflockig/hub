UPDATE planets
SET buildings = ?, updated_at = CURRENT_TIMESTAMP
WHERE coordinates = ? AND type = ?;
