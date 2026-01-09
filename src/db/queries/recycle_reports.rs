use crate::get_pool;
use tracing::debug;

pub async fn upsert(
    external_id: i64,
    galaxy: i64,
    system: i64,
    planet: i64,
    metal: i64,
    crystal: i64,
    metal_tf: i64,
    crystal_tf: i64,
    report_time: Option<&str>,
    reported_by: Option<i64>,
) -> Result<(), sqlx::Error> {
    debug!(external_id, galaxy, system, planet, "DB: recycle_reports::upsert");
    let pool = get_pool().await;
    let coords = format!("{}:{}:{}", galaxy, system, planet);
    sqlx::query_file!(
        "queries/recycle_reports/upsert.sql",
        external_id, coords, galaxy, system, planet,
        metal, crystal, metal_tf, crystal_tf,
        report_time, reported_by
    )
        .execute(pool)
        .await?;
    Ok(())
}
