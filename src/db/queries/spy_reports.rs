use crate::db::models::{SpyReportRow, SpyReportHistoryRow};
use crate::get_pool;
use tracing::debug;

pub async fn get_by_coordinates(
    galaxy: i64,
    system: i64,
    planet: i64,
    planet_type: &str,
    limit: i64,
) -> Result<Vec<SpyReportRow>, sqlx::Error> {
    debug!(galaxy, system, planet, planet_type, limit, "DB: spy_reports::get_by_coordinates");
    let pool = get_pool().await;
    sqlx::query_file_as!(
        SpyReportRow,
        "queries/spy_reports/get_by_coordinates.sql",
        galaxy, system, planet, planet_type, limit
    )
        .fetch_all(pool)
        .await
}

pub async fn get_by_system(
    galaxy: i64,
    system: i64,
) -> Result<Vec<SpyReportRow>, sqlx::Error> {
    debug!(galaxy, system, "DB: spy_reports::get_by_system");
    let pool = get_pool().await;
    sqlx::query_file_as!(
        SpyReportRow,
        "queries/spy_reports/get_by_system.sql",
        galaxy, system
    )
        .fetch_all(pool)
        .await
}

pub async fn get_history_with_reporter(
    galaxy: i64,
    system: i64,
    planet: i64,
    planet_type: &str,
    limit: i64,
) -> Result<Vec<SpyReportHistoryRow>, sqlx::Error> {
    debug!(galaxy, system, planet, planet_type, limit, "DB: spy_reports::get_history_with_reporter");
    let pool = get_pool().await;
    sqlx::query_as::<_, SpyReportHistoryRow>(
        r#"SELECT
            sr.id,
            sr.resources,
            sr.buildings,
            sr.research,
            sr.fleet,
            sr.defense,
            sr.created_at,
            p.name as reporter_name
        FROM spy_reports sr
        LEFT JOIN users u ON sr.reported_by = u.id
        LEFT JOIN players p ON u.player_id = p.id
        WHERE sr.galaxy = ? AND sr.system = ? AND sr.planet = ? AND sr.type = ?
        ORDER BY sr.created_at DESC
        LIMIT ?"#
    )
    .bind(galaxy)
    .bind(system)
    .bind(planet)
    .bind(planet_type)
    .bind(limit)
    .fetch_all(pool)
    .await
}

pub async fn upsert(
    external_id: i64,
    galaxy: i64,
    system: i64,
    planet: i64,
    planet_type: &str,
    resources: Option<&str>,
    buildings: Option<&str>,
    research: Option<&str>,
    fleet: Option<&str>,
    defense: Option<&str>,
    reported_by: Option<i64>,
    report_time: Option<&str>,
) -> Result<(), sqlx::Error> {
    debug!(external_id, galaxy, system, planet, "DB: spy_reports::upsert");
    let pool = get_pool().await;
    let coords = format!("{}:{}:{}", galaxy, system, planet);
    sqlx::query_file!(
        "queries/spy_reports/upsert.sql",
        external_id, coords, galaxy, system, planet, planet_type,
        resources, buildings, research, fleet, defense,
        reported_by, report_time
    )
        .execute(pool)
        .await?;
    Ok(())
}
