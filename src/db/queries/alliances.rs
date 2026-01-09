use crate::db::models::{PlanetRow, PlayerScoreRow};
use crate::get_pool;
use tracing::debug;

/// Ensure alliance exists (creates if not exists, updates tag if exists)
pub async fn ensure_exists(id: i64, tag: &str) -> Result<(), sqlx::Error> {
    debug!(id, tag, "DB: alliances::ensure_exists");
    let pool = get_pool().await;
    // Use tag as name if we don't have a full name
    sqlx::query(
        "INSERT INTO alliances (id, name, tag) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET tag = excluded.tag, updated_at = CURRENT_TIMESTAMP"
    )
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
    sqlx::query_as::<_, PlanetRow>(
        "SELECT p.id, p.name, p.player_id, p.coordinates, p.galaxy, p.system, p.planet,
                p.type, p.buildings, p.fleet, p.defense, p.resources, p.prod_h,
                p.status, p.created_at, p.updated_at
         FROM planets p
         JOIN players pl ON p.player_id = pl.id
         WHERE pl.alliance_id = ?
         ORDER BY p.galaxy, p.system, p.planet"
    )
        .bind(alliance_id)
        .fetch_all(pool)
        .await
}

pub async fn get_chart(alliance_id: i64) -> Result<Vec<PlayerScoreRow>, sqlx::Error> {
    debug!(alliance_id, "DB: alliances::get_chart");
    let pool = get_pool().await;
    sqlx::query_file_as!(PlayerScoreRow, "queries/alliances/get_chart.sql", alliance_id)
        .fetch_all(pool)
        .await
}
