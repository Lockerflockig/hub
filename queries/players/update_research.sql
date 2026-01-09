UPDATE players
SET research = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?;
