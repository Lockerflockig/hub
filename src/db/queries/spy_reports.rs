use crate::db::models::{SpyReportRow, SpyReportHistoryRow};
use crate::get_pool;
use tracing::debug;
use super::sql;

pub async fn get_by_coordinates(
    galaxy: i64,
    system: i64,
    planet: i64,
    planet_type: &str,
    limit: i64,
) -> Result<Vec<SpyReportRow>, sqlx::Error> {
    debug!(galaxy, system, planet, planet_type, limit, "DB: spy_reports::get_by_coordinates");
    let pool = get_pool().await;
    sqlx::query_as::<_, SpyReportRow>(sql!(spy_reports, get_by_coordinates))
        .bind(galaxy)
        .bind(system)
        .bind(planet)
        .bind(planet_type)
        .bind(limit)
        .fetch_all(pool)
        .await
}

pub async fn get_by_system(
    galaxy: i64,
    system: i64,
) -> Result<Vec<SpyReportRow>, sqlx::Error> {
    debug!(galaxy, system, "DB: spy_reports::get_by_system");
    let pool = get_pool().await;
    sqlx::query_as::<_, SpyReportRow>(sql!(spy_reports, get_by_system))
        .bind(galaxy)
        .bind(system)
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
    sqlx::query_as::<_, SpyReportHistoryRow>(sql!(spy_reports, get_history_with_reporter))
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
    sqlx::query(sql!(spy_reports, upsert))
        .bind(external_id)
        .bind(&coords)
        .bind(galaxy)
        .bind(system)
        .bind(planet)
        .bind(planet_type)
        .bind(resources)
        .bind(buildings)
        .bind(research)
        .bind(fleet)
        .bind(defense)
        .bind(reported_by)
        .bind(report_time)
        .execute(pool)
        .await?;
    Ok(())
}
