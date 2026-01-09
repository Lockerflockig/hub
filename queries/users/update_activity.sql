UPDATE users
SET last_activity_at = datetime('now'), updated_at = datetime('now')
WHERE id = ?;
