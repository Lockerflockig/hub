SELECT u.id, u.api_key, u.player_id, p.name as player_name,
       u.alliance_id, u.role, u.last_activity_at, u.updated_at
FROM users u
JOIN players p ON u.player_id = p.id
WHERE LOWER(p.name) = LOWER(?)
LIMIT 1
