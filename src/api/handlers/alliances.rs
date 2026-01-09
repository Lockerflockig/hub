use axum::{
    extract::{Path, Extension},
    Json,
};
use crate::api::auth::AuthUser;
use crate::api::error::AppError;
use crate::api::response::{self, PlanetResponse, ChartResponse};
use crate::db::queries::alliances;

/// GET /api/alliances/{id}/planets
pub async fn get_planets(
    Path(alliance_id): Path<i64>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<Vec<PlanetResponse>>, AppError> {
    let planets = alliances::get_planets(alliance_id).await?;
    let response: Vec<PlanetResponse> = planets.into_iter().map(response::planet_to_response).collect();
    Ok(Json(response))
}

/// GET /api/alliances/{id}/chart
pub async fn get_chart(
    Path(alliance_id): Path<i64>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<ChartResponse>, AppError> {
    let scores = alliances::get_chart(alliance_id).await?;
    let response = ChartResponse {
        scores: scores.into_iter().map(response::score_to_chart_point).collect(),
    };
    Ok(Json(response))
}
