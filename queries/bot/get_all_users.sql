SELECT u.id, u.api_key, u.player_id, p.name as player_name,
       u.alliance_id, u.role, u.last_activity_at, u.updated_at
FROM users u
LEFT JOIN players p ON u.player_id = p.id
ORDER BY p.name
