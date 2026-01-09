INSERT INTO players (id, name, alliance_id, main_coordinates, notice)
VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
                           alliance_id = excluded.alliance_id,
                           main_coordinates = excluded.main_coordinates,
                           notice = excluded.notice,
                           updated_at = CURRENT_TIMESTAMP;
