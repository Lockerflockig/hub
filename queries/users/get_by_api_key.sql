SELECT
    id AS "id!",
    api_key AS "api_key!",
    player_id,
    alliance_id,
    language AS "language!",
    role AS "role!: UserRole",
    last_activity_at,
    created_at,
    updated_at
FROM users
WHERE TRIM(api_key) = ?;
