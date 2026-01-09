use crate::get_pool;
use tracing::debug;

pub async fn upsert(
    external_id: i64,
    message: Option<&str>,
    expedition_type: Option<&str>,
    resources: Option<&str>,
    fleet: Option<&str>,
    report_time: Option<&str>,
    reported_by: Option<i64>,
) -> Result<(), sqlx::Error> {
    debug!(external_id, ?expedition_type, "DB: expedition_reports::upsert");
    let pool = get_pool().await;
    sqlx::query_file!(
        "queries/expedition_reports/upsert.sql",
        external_id, message, expedition_type, resources, fleet,
        report_time, reported_by
    )
        .execute(pool)
        .await?;
    Ok(())
}
