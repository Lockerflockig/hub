INSERT INTO hostile_spying (
    external_id, attacker_coordinates, target_coordinates, report_time
) VALUES (?, ?, ?, ?)
    ON CONFLICT(external_id) DO UPDATE SET
    attacker_coordinates = excluded.attacker_coordinates,
                                    target_coordinates = excluded.target_coordinates,
                                    report_time = excluded.report_time;
