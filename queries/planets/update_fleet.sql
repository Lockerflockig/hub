UPDATE planets
SET fleet = ?, updated_at = CURRENT_TIMESTAMP
WHERE coordinates = ? AND type = ?;
