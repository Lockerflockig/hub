UPDATE users
SET language = ?, updated_at = datetime('now')
WHERE id = ?;
