use axum::{extract::Extension, Json};
use crate::api::auth::AuthUser;
use crate::api::error::AppError;
use crate::api::response::{SuccessResponse, PlanetsNewResponse};
use crate::db::queries::{alliances, planets, players};
use serde::Deserialize;
use std::collections::HashMap;

/// POST /api/planets
#[derive(Deserialize)]
pub struct CreatePlanetRequest {
    pub coordinates: String,
    pub player_id: i64,
    pub planet_name: Option<String>,
    pub moon_name: Option<String>,
}

pub async fn create_planet(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<CreatePlanetRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    let parts: Vec<&str> = req.coordinates.split(':').collect();
    if parts.len() != 3 {
        return Err(AppError::BadRequest("Ungültige Koordinaten".into()));
    }

    let galaxy: i64 = parts[0].parse().map_err(|_| AppError::BadRequest("Ungültige Galaxy".into()))?;
    let system: i64 = parts[1].parse().map_err(|_| AppError::BadRequest("Ungültiges System".into()))?;
    let planet: i64 = parts[2].parse().map_err(|_| AppError::BadRequest("Ungültiger Planet".into()))?;

    // Upsert planet
    planets::upsert(req.player_id, &req.coordinates, galaxy, system, planet, "PLANET", req.planet_name.as_deref(), None).await?;

    // Upsert moon if provided
    if req.moon_name.is_some() {
        planets::upsert(req.player_id, &req.coordinates, galaxy, system, planet, "MOON", req.moon_name.as_deref(), None).await?;
    }

    Ok(Json(SuccessResponse { success: true }))
}

/// POST /api/planets/new (Galaxy scan)
#[derive(Deserialize)]
pub struct PlanetsNewRequest {
    pub galaxy: i64,
    pub system: i64,
    pub planets: Vec<PlanetInput>,
    #[serde(default)]
    pub destroyed: Vec<DestroyedInput>,
}

#[derive(Deserialize)]
pub struct PlanetInput {
    pub position: i64,
    pub player_id: Option<i64>,  // Optional - may not be known
    pub player_name: Option<String>,  // Player name from galaxy page
    pub planet_name: Option<String>,  // Planet name from galaxy page
    pub moon_name: Option<String>,  // Moon name from galaxy page
    pub has_moon: Option<bool>,
    pub planet_id: Option<i64>,  // pr0game internal planet ID (from spy links)
    pub moon_id: Option<i64>,  // pr0game internal moon ID
    pub alliance_id: Option<i64>,  // Alliance ID from galaxy page
    pub alliance_tag: Option<String>,  // Alliance tag from galaxy page
}

#[derive(Deserialize)]
pub struct DestroyedInput {
    pub position: i64,
    pub r#type: String,  // "PLANET" or "MOON"
}

pub async fn create_planets_batch(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<PlanetsNewRequest>,
) -> Result<Json<PlanetsNewResponse>, AppError> {
    let mut created = 0i64;
    let mut skipped = 0i64;
    let mut deleted = 0i64;

    // Ensure system marker player exists (player_id=0 for system markers)
    players::ensure_exists(0, "System").await?;

    // Always update system marker (position=0) to track when system was last scanned
    let marker_coords = format!("{}:{}:0", req.galaxy, req.system);
    let marker_name = if req.planets.is_empty() && req.destroyed.is_empty() { "EMPTY" } else { "SCANNED" };
    planets::upsert(0, &marker_coords, req.galaxy, req.system, 0, "PLANET", Some(marker_name), None).await?;

    // Mark destroyed planets/moons as deleted (keep in DB for history)
    for d in req.destroyed {
        let coordinates = format!("{}:{}:{}", req.galaxy, req.system, d.position);
        planets::mark_deleted(&coordinates, &d.r#type).await?;
        deleted += 1;
    }

    for p in req.planets {
        // Skip if no player_id - we need at least that to store
        let player_id = match p.player_id {
            Some(id) if id > 0 => id,
            _ => {
                skipped += 1;
                continue;
            }
        };

        // Ensure player exists before inserting planet (FK constraint)
        let player_name = p.player_name.as_deref().unwrap_or("Unknown");
        players::ensure_exists(player_id, player_name).await?;

        // Ensure alliance exists and update player's alliance if provided
        if let (Some(alliance_id), Some(alliance_tag)) = (p.alliance_id, &p.alliance_tag) {
            alliances::ensure_exists(alliance_id, alliance_tag).await?;
            players::update_alliance(player_id, alliance_id).await?;
        }

        let coordinates = format!("{}:{}:{}", req.galaxy, req.system, p.position);
        planets::upsert(player_id, &coordinates, req.galaxy, req.system, p.position, "PLANET", p.planet_name.as_deref(), p.planet_id).await?;
        created += 1;

        if p.has_moon.unwrap_or(false) {
            planets::upsert(player_id, &coordinates, req.galaxy, req.system, p.position, "MOON", p.moon_name.as_deref(), p.moon_id).await?;
            created += 1;
        }
    }

    tracing::debug!("Planets batch: created={}, skipped={}, deleted={}, marker={}", created, skipped, deleted, marker_name);
    Ok(Json(PlanetsNewResponse { success: true, created, deleted }))
}

/// POST /api/planets/buildings
#[derive(Deserialize)]
pub struct BuildingsRequest {
    pub coordinates: String,
    pub r#type: String,
    pub buildings: HashMap<String, i64>,
}

pub async fn update_buildings(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<BuildingsRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    let buildings_json = serde_json::to_string(&req.buildings)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    planets::update_buildings(&req.coordinates, &req.r#type, &buildings_json).await?;

    Ok(Json(SuccessResponse { success: true }))
}

/// POST /api/planets/fleet
#[derive(Deserialize)]
pub struct FleetRequest {
    pub coordinates: String,
    pub r#type: String,
    pub fleet: HashMap<String, i64>,
}

pub async fn update_fleet(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<FleetRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    let fleet_json = serde_json::to_string(&req.fleet)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    planets::update_fleet(&req.coordinates, &req.r#type, &fleet_json).await?;

    Ok(Json(SuccessResponse { success: true }))
}

/// POST /api/planets/defense
#[derive(Deserialize)]
pub struct DefenseRequest {
    pub coordinates: String,
    pub r#type: String,
    pub defense: HashMap<String, i64>,
}

pub async fn update_defense(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<DefenseRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    let defense_json = serde_json::to_string(&req.defense)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    planets::update_defense(&req.coordinates, &req.r#type, &defense_json).await?;

    Ok(Json(SuccessResponse { success: true }))
}

/// POST /api/planets/resources
#[derive(Deserialize)]
pub struct ResourcesRequest {
    pub coordinates: String,
    pub r#type: String,
    pub resources: HashMap<String, i64>,
}

pub async fn update_resources(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<ResourcesRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    let resources_json = serde_json::to_string(&req.resources)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    planets::update_resources(&req.coordinates, &req.r#type, &resources_json).await?;

    Ok(Json(SuccessResponse { success: true }))
}
