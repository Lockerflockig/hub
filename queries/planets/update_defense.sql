UPDATE planets
SET defense = ?, updated_at = CURRENT_TIMESTAMP
WHERE coordinates = ? AND type = ?;
