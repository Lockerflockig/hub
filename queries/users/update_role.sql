UPDATE users
SET role = ?, updated_at = datetime('now')
WHERE id = ?;
