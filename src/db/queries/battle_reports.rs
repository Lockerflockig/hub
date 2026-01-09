use crate::db::models::BattleReportHistoryRow;
use crate::get_pool;
use tracing::debug;

pub async fn get_history_with_reporter(
    galaxy: i64,
    system: i64,
    planet: i64,
    limit: i64,
) -> Result<Vec<BattleReportHistoryRow>, sqlx::Error> {
    debug!(galaxy, system, planet, limit, "DB: battle_reports::get_history_with_reporter");
    let pool = get_pool().await;
    sqlx::query_as::<_, BattleReportHistoryRow>(
        r#"SELECT
            br.id,
            CAST(br.external_id AS TEXT) as report_id,
            br.attacker_lost,
            br.defender_lost,
            br.metal,
            br.crystal,
            br.deuterium,
            br.debris_metal,
            br.debris_crystal,
            br.created_at,
            p.name as reporter_name
        FROM battle_reports br
        LEFT JOIN players p ON br.reported_by = p.id
        WHERE br.galaxy = ? AND br.system = ? AND br.planet = ?
        ORDER BY br.created_at DESC
        LIMIT ?"#
    )
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
    sqlx::query_file!(
        "queries/battle_reports/upsert.sql",
        external_id, coords, galaxy, system, planet, planet_type,
        attacker_lost, defender_lost, metal, crystal, deuterium,
        debris_metal, debris_crystal, report_time, reported_by
    )
        .execute(pool)
        .await?;
    Ok(())
}
