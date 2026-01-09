INSERT INTO battle_reports (
    external_id, coordinates, galaxy, system, planet, type,
    attacker_lost, defender_lost, metal, crystal, deuterium,
    debris_metal, debris_crystal, report_time, reported_by
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(external_id) DO UPDATE SET
    attacker_lost = excluded.attacker_lost,
                                    defender_lost = excluded.defender_lost,
                                    metal = excluded.metal,
                                    crystal = excluded.crystal,
                                    deuterium = excluded.deuterium,
                                    debris_metal = excluded.debris_metal,
                                    debris_crystal = excluded.debris_crystal,
                                    report_time = excluded.report_time;
