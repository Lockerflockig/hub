INSERT INTO recycle_reports (
    external_id, coordinates, galaxy, system, planet,
    metal, crystal, metal_tf, crystal_tf,
    report_time, reported_by
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(external_id) DO UPDATE SET
    metal = excluded.metal,
                                    crystal = excluded.crystal,
                                    metal_tf = excluded.metal_tf,
                                    crystal_tf = excluded.crystal_tf,
                                    report_time = excluded.report_time;
