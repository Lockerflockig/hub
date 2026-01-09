use crate::get_pool;
use super::sql;
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
    sqlx::query(sql!(expedition_reports, upsert))
        .bind(external_id)
        .bind(message)
        .bind(expedition_type)
        .bind(resources)
        .bind(fleet)
        .bind(report_time)
        .bind(reported_by)
        .execute(pool)
        .await?;
    Ok(())
}
