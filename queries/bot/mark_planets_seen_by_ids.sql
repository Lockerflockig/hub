UPDATE planets SET status = 'seen', updated_at = CURRENT_TIMESTAMP
WHERE id IN (SELECT value FROM json_each(?))
