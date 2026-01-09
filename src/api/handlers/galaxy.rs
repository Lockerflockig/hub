use axum::{
    extract::{Path, Extension},
    Json,
};
use crate::api::auth::AuthUser;
use crate::api::error::AppError;
use crate::api::response::{self, GalaxySystemResponse, GalaxyPlanetInfo, GalaxySpyReport};
use crate::db::queries::{galaxy, spy_reports};
use crate::get_pool;
use sqlx::Row;

/// GET /api/galaxy/{galaxy}/{system}
pub async fn get_system(
    Path((galaxy_num, system_num)): Path<(i64, i64)>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<GalaxySystemResponse>, AppError> {
    let pool = get_pool().await;

    // Get planets from DB
    let planets_rows = galaxy::get_system(galaxy_num, system_num).await?;
    let planets: Vec<GalaxyPlanetInfo> = planets_rows.into_iter().map(|p| {
        GalaxyPlanetInfo {
            id: p.id,
            name: p.name,
            player_id: p.player_id,
            coordinates: p.coordinates,
            planet: p.planet,
            r#type: p.r#type.unwrap_or_else(|| "PLANET".to_string()),
            planet_id: p.planet_id,
        }
    }).collect();

    // Get spy reports for this system
    let spy_reports_rows = spy_reports::get_by_system(galaxy_num, system_num).await?;
    let spy_reports: Vec<GalaxySpyReport> = spy_reports_rows.into_iter().map(|r| {
        GalaxySpyReport {
            planet: r.planet,
            r#type: r.r#type.unwrap_or_else(|| "PLANET".to_string()),
            resources: response::parse_json_map(&r.resources),
            report_time: r.report_time,
            created_at: r.created_at,
        }
    }).collect();

    // Get system marker (planet=0) to check if system was scanned
    let last_scan_at: Option<String> = sqlx::query(
        "SELECT updated_at FROM planets WHERE galaxy = ? AND system = ? AND planet = 0"
    )
    .bind(galaxy_num)
    .bind(system_num)
    .fetch_optional(pool)
    .await?
    .and_then(|row| row.get("updated_at"));

    Ok(Json(GalaxySystemResponse {
        planets,
        spy_reports,
        last_scan_at,
    }))
}
