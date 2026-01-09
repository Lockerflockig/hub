SELECT
    u.id AS "id!",
    u.player_id,
    u.alliance_id,
    u.language AS "language!",
    u.role AS "role!: UserRole",
    u.last_activity_at,
    u.created_at,
    u.updated_at,
    p.name AS player_name,
    a.name AS alliance_name
FROM users u
LEFT JOIN players p ON u.player_id = p.id
LEFT JOIN alliances a ON u.alliance_id = a.id
ORDER BY u.id;
