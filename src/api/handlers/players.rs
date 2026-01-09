use axum::{
    extract::{Path, Extension},
    Json,
};
use crate::api::auth::AuthUser;
use crate::api::error::AppError;
use crate::api::response::{
    self, PlayerResponse, AllianceInfo, CombatStats, PlayerStatus,
    PlanetResponse, ChartResponse, SuccessResponse, LoginResponse, LoginUserInfo,
    PlayerDataResponse, PlayersStatsResponse, ResearchResponse,
    OverviewResponse, OverviewPlanetInfo, OverviewSpyReport,
};
use crate::db::queries::{alliances, players, spy_reports, users};
use serde::Deserialize;
use std::collections::HashMap;

/// GET /api/players/{id}
pub async fn get_player(
    Path(player_id): Path<i64>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<PlayerResponse>, AppError> {
    let player = players::get_by_id(player_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Spieler nicht gefunden".into()))?;

    let response = PlayerResponse {
        id: player.id,
        name: player.name,
        alliance: player.alliance_name.as_ref().map(|name| AllianceInfo {
            id: player.alliance_id.unwrap_or(0),
            name: name.clone(),
            tag: player.alliance_tag.clone().unwrap_or_default(),
        }),
        main_coordinates: player.main_coordinates,
        research: response::parse_json_map(&player.research),
        scores: response::parse_scores(&player.scores),
        combat_stats: CombatStats {
            total: player.combats_total.unwrap_or(0),
            won: player.combats_won.unwrap_or(0),
            draw: player.combats_draw.unwrap_or(0),
            lost: player.combats_lost.unwrap_or(0),
            units_shot: player.units_shot.unwrap_or(0),
            units_lost: player.units_lost.unwrap_or(0),
        },
        status: PlayerStatus {
            is_deleted: player.is_deleted.unwrap_or(0) == 1,
            inactive_since: player.inactive_since,
            vacation_since: player.vacation_since,
        },
    };

    Ok(Json(response))
}

/// GET /api/players/{id}/planets
pub async fn get_player_planets(
    Path(player_id): Path<i64>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<Vec<PlanetResponse>>, AppError> {
    let planets = players::get_planets(player_id).await?;
    let response: Vec<PlanetResponse> = planets.into_iter().map(response::planet_to_response).collect();
    Ok(Json(response))
}

/// GET /api/players/{id}/chart
pub async fn get_player_chart(
    Path(player_id): Path<i64>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<ChartResponse>, AppError> {
    let scores = players::get_chart(player_id).await?;
    let response = ChartResponse {
        scores: scores.into_iter().map(response::score_to_chart_point).collect(),
    };
    Ok(Json(response))
}

/// POST /api/players
#[derive(Deserialize)]
pub struct UpsertPlayerRequest {
    pub id: i64,
    pub name: String,
    pub alliance_id: Option<i64>,
    pub alliance_tag: Option<String>,
    pub main_coordinates: Option<String>,
    pub notice: Option<String>,
    // Scores
    pub score_buildings: Option<i64>,
    pub score_buildings_rank: Option<i64>,
    pub score_research: Option<i64>,
    pub score_research_rank: Option<i64>,
    pub score_fleet: Option<i64>,
    pub score_fleet_rank: Option<i64>,
    pub score_defense: Option<i64>,
    pub score_defense_rank: Option<i64>,
    pub score_total: Option<i64>,
    pub score_total_rank: Option<i64>,
    // Combat stats
    pub combats_won: Option<i64>,
    pub combats_draw: Option<i64>,
    pub combats_lost: Option<i64>,
    pub combats_total: Option<i64>,
    // Honorpoints
    pub honorpoints: Option<i64>,
    pub honorpoints_rank: Option<i64>,
    // Honorfights
    pub fights_honorable: Option<i64>,
    pub fights_dishonorable: Option<i64>,
    pub fights_neutral: Option<i64>,
    // Destruction stats (involved in)
    pub destruction_units_killed: Option<i64>,
    pub destruction_units_lost: Option<i64>,
    pub destruction_recycled_metal: Option<i64>,
    pub destruction_recycled_crystal: Option<i64>,
    // Destruction stats (actually destroyed)
    pub real_destruction_units_killed: Option<i64>,
    pub real_destruction_units_lost: Option<i64>,
    pub real_destruction_recycled_metal: Option<i64>,
    pub real_destruction_recycled_crystal: Option<i64>,
}

pub async fn upsert_player(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<UpsertPlayerRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    // Ensure alliance exists if both alliance_id and alliance_tag are provided
    if let (Some(alliance_id), Some(alliance_tag)) = (req.alliance_id, &req.alliance_tag) {
        alliances::ensure_exists(alliance_id, alliance_tag).await?;
    }

    players::upsert_full(&req).await?;

    Ok(Json(SuccessResponse { success: true }))
}

/// GET /api/login
pub async fn login(
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<LoginResponse>, AppError> {
    Ok(Json(LoginResponse {
        success: true,
        user: LoginUserInfo {
            id: user.id,
            player_id: user.player_id,
            alliance_id: user.alliance_id,
            language: user.language,
        },
    }))
}

/// GET /api/players/{id}/chart7days
pub async fn get_player_chart_7days(
    Path(player_id): Path<i64>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<ChartResponse>, AppError> {
    let scores = players::get_chart_7days(player_id).await?;
    let response = ChartResponse {
        scores: scores.into_iter().map(response::score_to_chart_point).collect(),
    };
    Ok(Json(response))
}

/// GET /api/players/chart - Own player chart
pub async fn get_own_chart(
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<ChartResponse>, AppError> {
    let player_id = user.player_id
        .ok_or_else(|| AppError::BadRequest("Kein Spieler zugeordnet".into()))?;
    let scores = players::get_chart(player_id).await?;
    let response = ChartResponse {
        scores: scores.into_iter().map(response::score_to_chart_point).collect(),
    };
    Ok(Json(response))
}

/// GET /api/players/data - Own player data
pub async fn get_own_data(
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<PlayerDataResponse>, AppError> {
    let player_id = user.player_id;

    let (player, planets, research) = if let Some(pid) = player_id {
        let player = players::get_by_id(pid).await?;
        let planets_rows = players::get_planets(pid).await?;
        let planets: Vec<PlanetResponse> = planets_rows.into_iter()
            .map(response::planet_to_response)
            .collect();
        let research = player.as_ref().and_then(|p| response::parse_json_map(&p.research));

        let player_response = player.map(|p| PlayerResponse {
            id: p.id,
            name: p.name,
            alliance: p.alliance_name.as_ref().map(|name| AllianceInfo {
                id: p.alliance_id.unwrap_or(0),
                name: name.clone(),
                tag: p.alliance_tag.clone().unwrap_or_default(),
            }),
            main_coordinates: p.main_coordinates,
            research: response::parse_json_map(&p.research),
            scores: response::parse_scores(&p.scores),
            combat_stats: CombatStats {
                total: p.combats_total.unwrap_or(0),
                won: p.combats_won.unwrap_or(0),
                draw: p.combats_draw.unwrap_or(0),
                lost: p.combats_lost.unwrap_or(0),
                units_shot: p.units_shot.unwrap_or(0),
                units_lost: p.units_lost.unwrap_or(0),
            },
            status: PlayerStatus {
                is_deleted: p.is_deleted.unwrap_or(0) == 1,
                inactive_since: p.inactive_since,
                vacation_since: p.vacation_since,
            },
        });

        (player_response, planets, research)
    } else {
        (None, vec![], None)
    };

    Ok(Json(PlayerDataResponse { player, planets, research }))
}

/// POST /api/players/stats
#[derive(Deserialize)]
pub struct StatsRequest {
    pub players: Vec<PlayerStatInput>,
    pub r#type: String,
    pub inactive_ids: Option<Vec<i64>>,
    pub vacation_ids: Option<Vec<i64>>,
}

#[derive(Deserialize)]
pub struct PlayerStatInput {
    pub id: i64,
    pub name: String,
    pub alliance_id: Option<i64>,
    pub score: i64,
    pub rank: Option<i64>,
}

pub async fn post_stats(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<StatsRequest>,
) -> Result<Json<PlayersStatsResponse>, AppError> {
    let stats: Vec<players::PlayerStats> = req.players.iter().map(|p| {
        players::PlayerStats {
            id: p.id,
            name: p.name.clone(),
            alliance_id: p.alliance_id,
            score_total: p.score,
            score_economy: 0,
            score_research: 0,
            score_military: 0,
            score_defense: 0,
            rank: p.rank,
        }
    }).collect();

    let updated = players::upsert_stats(&stats).await?;

    Ok(Json(PlayersStatsResponse { success: true, updated }))
}

/// POST /api/players/getstats
#[derive(Deserialize)]
pub struct GetStatsRequest {
    pub ids: Vec<i64>,
}

pub async fn get_stats(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<GetStatsRequest>,
) -> Result<Json<Vec<PlayerResponse>>, AppError> {
    let player_rows = players::get_by_ids(&req.ids).await?;

    let response: Vec<PlayerResponse> = player_rows.into_iter().map(|p| {
        PlayerResponse {
            id: p.id,
            name: p.name,
            alliance: None,
            main_coordinates: p.main_coordinates,
            research: response::parse_json_map(&p.research),
            scores: response::parse_scores(&p.scores),
            combat_stats: CombatStats {
                total: p.combats_total,
                won: p.combats_won,
                draw: p.combats_draw,
                lost: p.combats_lost,
                units_shot: p.units_shot,
                units_lost: p.units_lost,
            },
            status: PlayerStatus {
                is_deleted: p.is_deleted == 1,
                inactive_since: p.inactive_since,
                vacation_since: p.vacation_since,
            },
        }
    }).collect();

    Ok(Json(response))
}

/// POST /api/players/{id}/delete
pub async fn delete_player(
    Path(player_id): Path<i64>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<SuccessResponse>, AppError> {
    players::mark_deleted(player_id).await?;
    Ok(Json(SuccessResponse { success: true }))
}

/// POST /api/players/research
#[derive(Deserialize)]
pub struct ResearchRequest {
    pub research: Vec<ResearchInput>,
}

#[derive(Deserialize)]
pub struct ResearchInput {
    pub id: i64,
    pub level: i64,
}

pub async fn post_research(
    Extension(AuthUser(user)): Extension<AuthUser>,
    Json(req): Json<ResearchRequest>,
) -> Result<Json<ResearchResponse>, AppError> {
    let player_id = user.player_id
        .ok_or_else(|| AppError::BadRequest("Kein Spieler zugeordnet".into()))?;

    let research_map: HashMap<String, i64> = req.research.iter()
        .map(|r| (r.id.to_string(), r.level))
        .collect();

    let research_json = serde_json::to_string(&research_map)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    players::update_research(player_id, &research_json).await?;

    Ok(Json(ResearchResponse { success: true, research: research_map }))
}

/// POST /api/players/overview
#[derive(Deserialize)]
pub struct OverviewRequest {
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub own_planets: Vec<String>,
}

pub async fn get_overview(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<OverviewRequest>,
) -> Result<Json<OverviewResponse>, AppError> {
    // Calculate distances from each own planet to target
    let mut planets: Vec<OverviewPlanetInfo> = Vec::new();

    for own_coord in &req.own_planets {
        let parts: Vec<&str> = own_coord.split(':').collect();
        if parts.len() != 3 {
            continue;
        }

        let own_galaxy: i64 = parts[0].parse().unwrap_or(0);
        let own_system: i64 = parts[1].parse().unwrap_or(0);
        let own_planet: i64 = parts[2].parse().unwrap_or(0);

        // Calculate distance (simplified OGame formula)
        let distance = calculate_distance(
            own_galaxy, own_system, own_planet,
            req.galaxy, req.system, req.planet
        );

        // Get last spy report for target
        let spy_report = spy_reports::get_by_coordinates(
            req.galaxy, req.system, req.planet, "PLANET", 1
        ).await.ok().and_then(|reports| {
            reports.into_iter().next().map(|r| OverviewSpyReport {
                id: r.id,
                created_at: r.created_at.unwrap_or_default(),
                resources: r.resources.as_ref().and_then(|s| serde_json::from_str(s).ok()),
            })
        });

        let resources = spy_report.as_ref().and_then(|r| r.resources.clone());

        planets.push(OverviewPlanetInfo {
            coordinates: own_coord.clone(),
            distance,
            player: None, // Could be filled with player data if needed
            last_spy_report: spy_report,
            resources,
        });
    }

    // Sort by distance
    planets.sort_by_key(|p| p.distance);

    Ok(Json(OverviewResponse { planets }))
}

/// Calculate distance between two coordinates (simplified OGame formula)
fn calculate_distance(
    from_galaxy: i64, from_system: i64, from_planet: i64,
    to_galaxy: i64, to_system: i64, to_planet: i64,
) -> i64 {
    if from_galaxy != to_galaxy {
        // Different galaxy: 20000 * |g1 - g2|
        (from_galaxy - to_galaxy).abs() * 20000
    } else if from_system != to_system {
        // Same galaxy, different system: 2700 + 95 * |s1 - s2|
        2700 + 95 * (from_system - to_system).abs()
    } else if from_planet != to_planet {
        // Same system, different planet: 1000 + 5 * |p1 - p2|
        1000 + 5 * (from_planet - to_planet).abs()
    } else {
        // Same position
        5
    }
}

/// POST /api/users/language
#[derive(Deserialize)]
pub struct UpdateLanguageRequest {
    pub language: String,
}

pub async fn update_language(
    Extension(AuthUser(user)): Extension<AuthUser>,
    Json(req): Json<UpdateLanguageRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    // Validate language (only allow known languages)
    let valid_languages = ["de", "en"];
    if !valid_languages.contains(&req.language.as_str()) {
        return Err(AppError::BadRequest("Invalid language".into()));
    }

    users::update_language(user.id, &req.language).await?;

    Ok(Json(SuccessResponse { success: true }))
}
