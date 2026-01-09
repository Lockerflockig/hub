use crate::db::models::BattleReportHistoryRow;
use crate::get_pool;
use tracing::debug;
use super::sql;

pub async fn get_history_with_reporter(
    galaxy: i64,
    system: i64,
    planet: i64,
    limit: i64,
) -> Result<Vec<BattleReportHistoryRow>, sqlx::Error> {
    debug!(galaxy, system, planet, limit, "DB: battle_reports::get_history_with_reporter");
    let pool = get_pool().await;
    sqlx::query_as::<_, BattleReportHistoryRow>(sql!(battle_reports, get_history_with_reporter))
        .bind(galaxy)
        .bind(system)
        .bind(planet)
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
    attacker_lost: i64,
    defender_lost: i64,
    metal: i64,
    crystal: i64,
    deuterium: i64,
    debris_metal: i64,
    debris_crystal: i64,
    report_time: Option<&str>,
    reported_by: Option<i64>,
) -> Result<(), sqlx::Error> {
    debug!(external_id, galaxy, system, planet, "DB: battle_reports::upsert");
    let pool = get_pool().await;
    let coords = format!("{}:{}:{}", galaxy, system, planet);
    sqlx::query(sql!(battle_reports, upsert))
        .bind(external_id)
        .bind(&coords)
        .bind(galaxy)
        .bind(system)
        .bind(planet)
        .bind(planet_type)
        .bind(attacker_lost)
        .bind(defender_lost)
        .bind(metal)
        .bind(crystal)
        .bind(deuterium)
        .bind(debris_metal)
        .bind(debris_crystal)
        .bind(report_time)
        .bind(reported_by)
        .execute(pool)
        .await?;
    Ok(())
}
