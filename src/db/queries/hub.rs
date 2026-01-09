use crate::db::models::{
    HubPlanetRow, HubResearchRow, HubFleetRow, HubBuildingsRow,
    StatViewRow, PlayerScoreRow
};
use crate::get_pool;
use tracing::debug;
use sqlx::FromRow;

/// Row structure for galaxy status queries
#[derive(Debug, FromRow)]
pub struct GalaxyStatusRow {
    pub galaxy: i64,
    pub system: i64,
    pub last_scan_at: Option<String>,
}

pub async fn get_planets(alliance_id: i64) -> Result<Vec<HubPlanetRow>, sqlx::Error> {
    debug!(alliance_id, "DB: hub::get_planets");
    let pool = get_pool().await;
    sqlx::query_file_as!(HubPlanetRow, "queries/hub/get_planets.sql", alliance_id)
        .fetch_all(pool)
        .await
}

pub async fn get_research(alliance_id: i64) -> Result<Vec<HubResearchRow>, sqlx::Error> {
    debug!(alliance_id, "DB: hub::get_research");
    let pool = get_pool().await;
    sqlx::query_file_as!(HubResearchRow, "queries/hub/get_research.sql", alliance_id)
        .fetch_all(pool)
        .await
}

pub async fn get_fleet(alliance_id: i64) -> Result<Vec<HubFleetRow>, sqlx::Error> {
    debug!(alliance_id, "DB: hub::get_fleet");
    let pool = get_pool().await;
    sqlx::query_file_as!(HubFleetRow, "queries/hub/get_fleet.sql", alliance_id)
        .fetch_all(pool)
        .await
}

pub async fn get_buildings(alliance_id: i64) -> Result<Vec<HubBuildingsRow>, sqlx::Error> {
    debug!(alliance_id, "DB: hub::get_buildings");
    let pool = get_pool().await;
    sqlx::query_file_as!(HubBuildingsRow, "queries/hub/get_buildings.sql", alliance_id)
        .fetch_all(pool)
        .await
}

pub async fn get_galaxy_status() -> Result<Vec<GalaxyStatusRow>, sqlx::Error> {
    debug!("DB: hub::get_galaxy_status");
    let pool = get_pool().await;
    sqlx::query_as::<_, GalaxyStatusRow>(
        "SELECT galaxy, system, updated_at AS last_scan_at
         FROM planets
         WHERE planet = 0
         ORDER BY galaxy, system"
    )
    .fetch_all(pool)
    .await
}

pub async fn get_stat_view() -> Result<Vec<StatViewRow>, sqlx::Error> {
    debug!("DB: hub::get_stat_view");
    let pool = get_pool().await;
    sqlx::query_file_as!(StatViewRow, "queries/hub/get_stat_view.sql")
        .fetch_all(pool)
        .await
}

pub async fn get_scores(alliance_id: i64) -> Result<Vec<PlayerScoreRow>, sqlx::Error> {
    debug!(alliance_id, "DB: hub::get_scores");
    let pool = get_pool().await;
    sqlx::query_file_as!(PlayerScoreRow, "queries/hub/get_scores.sql", alliance_id)
        .fetch_all(pool)
        .await
}
