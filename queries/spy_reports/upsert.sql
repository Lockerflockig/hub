INSERT INTO spy_reports (
    external_id, coordinates, galaxy, system, planet, type,
    resources, buildings, research, fleet, defense,
    reported_by, report_time
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(external_id) DO UPDATE SET
    resources = excluded.resources,
                                    buildings = excluded.buildings,
                                    research = excluded.research,
                                    fleet = excluded.fleet,
                                    defense = excluded.defense,
                                    report_time = excluded.report_time;
