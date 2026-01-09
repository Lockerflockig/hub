use crate::db::models::{PlanetRow, PlayerScoreRow};
use crate::get_pool;
use tracing::debug;
use super::sql;

/// Ensure alliance exists (creates if not exists, updates tag if exists)
pub async fn ensure_exists(id: i64, tag: &str) -> Result<(), sqlx::Error> {
    debug!(id, tag, "DB: alliances::ensure_exists");
    let pool = get_pool().await;
    sqlx::query(sql!(alliances, ensure_exists))
        .bind(id)
        .bind(tag)  // Use tag as name
        .bind(tag)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_planets(alliance_id: i64) -> Result<Vec<PlanetRow>, sqlx::Error> {
    debug!(alliance_id, "DB: alliances::get_planets");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlanetRow>(sql!(alliances, get_alliance_planets))
        .bind(alliance_id)
        .fetch_all(pool)
        .await
}

pub async fn get_chart(alliance_id: i64) -> Result<Vec<PlayerScoreRow>, sqlx::Error> {
    debug!(alliance_id, "DB: alliances::get_chart");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlayerScoreRow>(sql!(alliances, get_chart))
        .bind(alliance_id)
        .fetch_all(pool)
        .await
}
