INSERT INTO expedition_reports (
    external_id, message, type, resources, fleet,
    report_time, reported_by
) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(external_id) DO UPDATE SET
    message = excluded.message,
    type = excluded.type,
    resources = excluded.resources,
    fleet = excluded.fleet,
    report_time = excluded.report_time;
