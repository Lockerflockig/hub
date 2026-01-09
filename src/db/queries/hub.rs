use crate::db::models::{
    HubPlanetRow, HubResearchRow, HubFleetRow, HubBuildingsRow,
    StatViewRow, PlayerScoreRow
};
use crate::get_pool;
use tracing::debug;
use sqlx::FromRow;
use super::sql;

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
    sqlx::query_as::<_, HubPlanetRow>(sql!(hub, get_planets))
        .bind(alliance_id)
        .fetch_all(pool)
        .await
}

pub async fn get_research(alliance_id: i64) -> Result<Vec<HubResearchRow>, sqlx::Error> {
    debug!(alliance_id, "DB: hub::get_research");
    let pool = get_pool().await;
    sqlx::query_as::<_, HubResearchRow>(sql!(hub, get_research))
        .bind(alliance_id)
        .fetch_all(pool)
        .await
}

pub async fn get_fleet(alliance_id: i64) -> Result<Vec<HubFleetRow>, sqlx::Error> {
    debug!(alliance_id, "DB: hub::get_fleet");
    let pool = get_pool().await;
    sqlx::query_as::<_, HubFleetRow>(sql!(hub, get_fleet))
        .bind(alliance_id)
        .fetch_all(pool)
        .await
}

pub async fn get_buildings(alliance_id: i64) -> Result<Vec<HubBuildingsRow>, sqlx::Error> {
    debug!(alliance_id, "DB: hub::get_buildings");
    let pool = get_pool().await;
    sqlx::query_as::<_, HubBuildingsRow>(sql!(hub, get_buildings))
        .bind(alliance_id)
        .fetch_all(pool)
        .await
}

pub async fn get_galaxy_status() -> Result<Vec<GalaxyStatusRow>, sqlx::Error> {
    debug!("DB: hub::get_galaxy_status");
    let pool = get_pool().await;
    sqlx::query_as::<_, GalaxyStatusRow>(sql!(hub, get_galaxy_status))
        .fetch_all(pool)
        .await
}

pub async fn get_stat_view() -> Result<Vec<StatViewRow>, sqlx::Error> {
    debug!("DB: hub::get_stat_view");
    let pool = get_pool().await;
    sqlx::query_as::<_, StatViewRow>(sql!(hub, get_stat_view))
        .fetch_all(pool)
        .await
}

pub async fn get_scores(alliance_id: i64) -> Result<Vec<PlayerScoreRow>, sqlx::Error> {
    debug!(alliance_id, "DB: hub::get_scores");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlayerScoreRow>(sql!(hub, get_scores))
        .bind(alliance_id)
        .fetch_all(pool)
        .await
}
