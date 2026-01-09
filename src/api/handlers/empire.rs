use axum::{extract::Extension, Json};
use crate::api::auth::AuthUser;
use crate::api::error::AppError;
use crate::api::response::SuccessResponse;
use crate::db::queries::{planets, players};
use serde::Deserialize;
use std::collections::HashMap;

/// POST /api/empire
/// Bulk sync all empire data at once
#[derive(Deserialize, Debug)]
pub struct EmpireSyncRequest {
    /// Player ID from pr0game
    pub player_id: i64,
    /// Player name
    pub player_name: String,
    /// Research levels (global for player)
    pub research: HashMap<String, i64>,
    /// All planets with their data
    pub planets: Vec<EmpirePlanet>,
}

#[derive(Deserialize, Debug)]
pub struct EmpirePlanet {
    /// Planet ID from pr0game (from <option value="XXX">)
    pub external_id: i64,
    /// Planet name
    pub name: String,
    /// Coordinates "1:197:12"
    pub coordinates: String,
    /// Fields used/max
    pub fields_used: i64,
    pub fields_max: i64,
    /// Temperature in Celsius
    pub temperature: i64,
    /// Points from empire page
    pub points: i64,
    /// Current resources
    pub resources: HashMap<String, i64>,
    /// Production per hour
    pub production: EmpireProduction,
    /// Building levels
    pub buildings: HashMap<String, i64>,
    /// Fleet counts
    pub fleet: HashMap<String, i64>,
    /// Defense counts
    pub defense: HashMap<String, i64>,
}

#[derive(Deserialize, Debug)]
pub struct EmpireProduction {
    pub metal: i64,
    pub crystal: i64,
    pub deuterium: i64,
    pub energy_used: i64,
    pub energy_max: i64,
}

pub async fn sync_empire(
    Extension(AuthUser(user)): Extension<AuthUser>,
    Json(req): Json<EmpireSyncRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    // Use player_id from request, or fall back to user's player_id
    let player_id = if req.player_id > 0 {
        req.player_id
    } else {
        user.player_id.ok_or_else(|| AppError::BadRequest("Kein player_id gefunden".into()))?
    };

    tracing::info!(player_id, planets_count = req.planets.len(), "Empire sync");

    // 1. Ensure player exists and update research
    players::ensure_exists(player_id, &req.player_name).await?;

    // Update alliance_id from authenticated user
    if let Some(alliance_id) = user.alliance_id {
        players::update_alliance(player_id, alliance_id).await?;
    }

    let research_json = serde_json::to_string(&req.research)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    players::update_research(player_id, &research_json).await?;

    // 2. Sync each planet
    for planet in &req.planets {
        // Parse coordinates
        let parts: Vec<&str> = planet.coordinates.split(':').collect();
        if parts.len() != 3 {
            tracing::warn!(coords = planet.coordinates, "Invalid coordinates, skipping");
            continue;
        }

        let galaxy: i64 = parts[0].parse().unwrap_or(0);
        let system: i64 = parts[1].parse().unwrap_or(0);
        let position: i64 = parts[2].parse().unwrap_or(0);

        // Upsert planet with full data
        planets::upsert_empire(
            player_id,
            planet.external_id,
            &planet.name,
            &planet.coordinates,
            galaxy,
            system,
            position,
            planet.fields_used,
            planet.fields_max,
            planet.temperature,
            planet.points,
            &planet.production,
            &planet.resources,
            &planet.buildings,
            &planet.fleet,
            &planet.defense,
        ).await?;
    }

    tracing::info!(player_id, "Empire sync complete");
    Ok(Json(SuccessResponse { success: true }))
}
