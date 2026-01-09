UPDATE players
SET is_deleted = 1, status = 'deleted', updated_at = CURRENT_TIMESTAMP
WHERE id = ?;
