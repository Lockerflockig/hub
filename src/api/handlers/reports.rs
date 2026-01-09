use axum::{
    extract::{Path, Query, Extension},
    Json,
};
use crate::api::auth::AuthUser;
use crate::api::error::AppError;
use crate::api::response::{self, *};
use crate::db::queries::{spy_reports, battle_reports, expedition_reports, recycle_reports, hostile_spying};
use serde::Deserialize;
use std::collections::HashMap;

// ============================================================================
// Spy Reports
// ============================================================================

#[derive(Deserialize)]
pub struct SpyReportQuery {
    #[serde(default = "default_type")]
    pub r#type: String,
    #[serde(default = "default_lines")]
    pub lines: i64,
}

fn default_type() -> String { "PLANET".into() }
fn default_lines() -> i64 { 10 }

/// GET /api/spy-reports/{galaxy}/{system}/{planet}
pub async fn get_spy_reports(
    Path((galaxy, system, planet)): Path<(i64, i64, i64)>,
    Query(query): Query<SpyReportQuery>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<SpyReportsResponse>, AppError> {
    let reports = spy_reports::get_by_coordinates(
        galaxy, system, planet, &query.r#type, query.lines
    ).await?;

    let response = SpyReportsResponse {
        coordinates: format!("{}:{}:{}", galaxy, system, planet),
        r#type: query.r#type,
        reports: reports
            .into_iter()
            .map(|r| SpyReportInfo {
                id: r.id,
                created_at: r.created_at.unwrap_or_default(),
                resources: response::parse_json_map(&r.resources),
                buildings: response::parse_json_map(&r.buildings),
                research: response::parse_json_map(&r.research),
                fleet: response::parse_json_map(&r.fleet),
                defense: response::parse_json_map(&r.defense),
            })
            .collect(),
    };

    Ok(Json(response))
}

/// GET /api/spy-reports/{galaxy}/{system}/{planet}/history - Extended history with reporter info
pub async fn get_spy_report_history(
    Path((galaxy, system, planet)): Path<(i64, i64, i64)>,
    Query(query): Query<SpyReportQuery>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<SpyReportHistoryResponse>, AppError> {
    let reports = spy_reports::get_history_with_reporter(
        galaxy, system, planet, &query.r#type, query.lines
    ).await?;

    let response = SpyReportHistoryResponse {
        coordinates: format!("{}:{}:{}", galaxy, system, planet),
        r#type: query.r#type,
        reports: reports
            .into_iter()
            .map(|r| SpyReportHistoryItem {
                id: r.id,
                created_at: r.created_at.unwrap_or_default(),
                reporter_name: r.reporter_name,
                resources: response::parse_json_map(&r.resources),
                buildings: response::parse_json_map(&r.buildings),
                research: response::parse_json_map(&r.research),
                fleet: response::parse_json_map(&r.fleet),
                defense: response::parse_json_map(&r.defense),
            })
            .collect(),
    };

    Ok(Json(response))
}

#[derive(Deserialize)]
pub struct CreateSpyReportRequest {
    pub id: i64,
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub r#type: String,
    pub report_time: Option<String>,
    pub resources: Option<HashMap<String, i64>>,
    pub buildings: Option<HashMap<String, i64>>,
    pub research: Option<HashMap<String, i64>>,
    pub fleet: Option<HashMap<String, i64>>,
    pub defense: Option<HashMap<String, i64>>,
}

/// POST /api/spy-reports
pub async fn create_spy_report(
    Extension(AuthUser(user)): Extension<AuthUser>,
    Json(req): Json<CreateSpyReportRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    spy_reports::upsert(
        req.id,
        req.galaxy,
        req.system,
        req.planet,
        &req.r#type,
        response::to_json(&req.resources).as_deref(),
        response::to_json(&req.buildings).as_deref(),
        response::to_json(&req.research).as_deref(),
        response::to_json(&req.fleet).as_deref(),
        response::to_json(&req.defense).as_deref(),
        Some(user.player_id.unwrap_or(1)),
        req.report_time.as_deref(),
    ).await?;

    Ok(Json(SuccessResponse { success: true }))
}

// ============================================================================
// Battle Reports
// ============================================================================

#[derive(Deserialize)]
pub struct CreateBattleReportRequest {
    pub id: i64,
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub r#type: String,
    pub report_time: Option<String>,
    pub attacker_lost: i64,
    pub defender_lost: i64,
    pub metal: i64,
    pub crystal: i64,
    pub deuterium: i64,
    pub debris_metal: i64,
    pub debris_crystal: i64,
}

/// POST /api/battle-reports
pub async fn create_battle_report(
    Extension(AuthUser(user)): Extension<AuthUser>,
    Json(req): Json<CreateBattleReportRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    battle_reports::upsert(
        req.id,
        req.galaxy,
        req.system,
        req.planet,
        &req.r#type,
        req.attacker_lost,
        req.defender_lost,
        req.metal,
        req.crystal,
        req.deuterium,
        req.debris_metal,
        req.debris_crystal,
        req.report_time.as_deref(),
        user.player_id,
    ).await?;

    Ok(Json(SuccessResponse { success: true }))
}

#[derive(Deserialize)]
pub struct BattleReportQuery {
    #[serde(default = "default_lines")]
    pub lines: i64,
}

/// GET /api/battle-reports/{galaxy}/{system}/{planet}/history - Battle report history
pub async fn get_battle_report_history(
    Path((galaxy, system, planet)): Path<(i64, i64, i64)>,
    Query(query): Query<BattleReportQuery>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<BattleReportHistoryResponse>, AppError> {
    let reports = battle_reports::get_history_with_reporter(
        galaxy, system, planet, query.lines
    ).await?;

    let response = BattleReportHistoryResponse {
        coordinates: format!("{}:{}:{}", galaxy, system, planet),
        reports: reports
            .into_iter()
            .map(|r| BattleReportHistoryItem {
                id: r.id,
                report_id: r.report_id.unwrap_or_default(),
                created_at: r.created_at.unwrap_or_default(),
                reporter_name: r.reporter_name,
                attacker_lost: r.attacker_lost.unwrap_or(0),
                defender_lost: r.defender_lost.unwrap_or(0),
                metal: r.metal.unwrap_or(0),
                crystal: r.crystal.unwrap_or(0),
                deuterium: r.deuterium.unwrap_or(0),
                debris_metal: r.debris_metal.unwrap_or(0),
                debris_crystal: r.debris_crystal.unwrap_or(0),
            })
            .collect(),
    };

    Ok(Json(response))
}

// ============================================================================
// Expedition Reports
// ============================================================================

#[derive(Deserialize)]
pub struct CreateExpeditionReportRequest {
    pub id: i64,
    pub message: Option<String>,
    pub r#type: Option<String>,
    pub report_time: Option<String>,
    pub resources: Option<HashMap<String, i64>>,
    pub fleet: Option<HashMap<String, i64>>,
}

/// POST /api/expedition-reports
pub async fn create_expedition_report(
    Extension(AuthUser(user)): Extension<AuthUser>,
    Json(req): Json<CreateExpeditionReportRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    expedition_reports::upsert(
        req.id,
        req.message.as_deref(),
        req.r#type.as_deref(),
        response::to_json(&req.resources).as_deref(),
        response::to_json(&req.fleet).as_deref(),
        req.report_time.as_deref(),
        user.player_id,
    ).await?;

    Ok(Json(SuccessResponse { success: true }))
}

// ============================================================================
// Recycle Reports
// ============================================================================

#[derive(Deserialize)]
pub struct CreateRecycleReportRequest {
    pub id: i64,
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub report_time: Option<String>,
    pub metal: i64,
    pub crystal: i64,
    pub metal_tf: i64,
    pub crystal_tf: i64,
}

/// POST /api/recycle-reports
pub async fn create_recycle_report(
    Extension(AuthUser(user)): Extension<AuthUser>,
    Json(req): Json<CreateRecycleReportRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    recycle_reports::upsert(
        req.id,
        req.galaxy,
        req.system,
        req.planet,
        req.metal,
        req.crystal,
        req.metal_tf,
        req.crystal_tf,
        req.report_time.as_deref(),
        user.player_id,
    ).await?;

    Ok(Json(SuccessResponse { success: true }))
}

// ============================================================================
// Hostile Spying
// ============================================================================

#[derive(Deserialize)]
pub struct CreateHostileSpyingRequest {
    pub id: i64,
    pub attacker_coordinates: Option<String>,
    pub target_coordinates: Option<String>,
    pub report_time: Option<String>,
}

/// POST /api/hostile-spying
pub async fn create_hostile_spying(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<CreateHostileSpyingRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    hostile_spying::upsert(
        req.id,
        req.attacker_coordinates.as_deref(),
        req.target_coordinates.as_deref(),
        req.report_time.as_deref(),
    ).await?;

    Ok(Json(SuccessResponse { success: true }))
}

#[derive(Deserialize)]
pub struct HostileSpyingQuery {
    pub search: Option<String>,
    #[serde(default = "default_page")]
    pub page: i64,
}

fn default_page() -> i64 { 1 }

const PAGE_SIZE: i64 = 20;

/// GET /api/hostile-spying
pub async fn get_hostile_spying(
    Query(query): Query<HostileSpyingQuery>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<HostileSpyingResponse>, AppError> {
    let offset = (query.page - 1) * PAGE_SIZE;
    let search = query.search.as_deref();

    let rows = hostile_spying::get(search, PAGE_SIZE, offset).await?;
    let total = hostile_spying::count(search).await?;
    let total_pages = (total + PAGE_SIZE - 1) / PAGE_SIZE;

    let data: Vec<HostileSpyingInfo> = rows.into_iter().map(|r| HostileSpyingInfo {
        id: r.id,
        attacker_coordinates: r.attacker_coordinates,
        target_coordinates: r.target_coordinates,
        report_time: r.report_time,
    }).collect();

    Ok(Json(HostileSpyingResponse {
        data,
        page: query.page,
        total_pages,
    }))
}

#[derive(Deserialize)]
pub struct HostileSpyingOverviewQuery {
    pub attacker: Option<String>,
    pub target: Option<String>,
    pub time_from: Option<String>,
    pub time_to: Option<String>,
    #[serde(default = "default_page")]
    pub page: i64,
}

/// GET /api/hostile-spying/overview - Aggregated view grouped by attacker
pub async fn get_hostile_spying_overview(
    Query(query): Query<HostileSpyingOverviewQuery>,
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<HostileSpyingOverviewResponse>, AppError> {
    let offset = (query.page - 1) * PAGE_SIZE;

    let rows = hostile_spying::get_overview(
        query.attacker.as_deref(),
        query.target.as_deref(),
        query.time_from.as_deref(),
        query.time_to.as_deref(),
        PAGE_SIZE,
        offset,
    ).await?;

    let total = hostile_spying::count_overview(
        query.attacker.as_deref(),
        query.target.as_deref(),
        query.time_from.as_deref(),
        query.time_to.as_deref(),
    ).await?;

    let total_pages = (total + PAGE_SIZE - 1) / PAGE_SIZE;

    let data: Vec<HostileSpyingOverviewInfo> = rows.into_iter().map(|r| {
        // Parse targets from comma-separated string
        let targets: Vec<String> = r.targets
            .map(|t| t.split(',').map(|s| s.trim().to_string()).collect())
            .unwrap_or_default();

        HostileSpyingOverviewInfo {
            attacker_coordinates: r.attacker_coordinates,
            attacker_name: r.attacker_name,
            attacker_alliance_tag: r.attacker_alliance_tag,
            spy_count: r.spy_count,
            last_spy_time: r.last_spy_time,
            targets,
        }
    }).collect();

    Ok(Json(HostileSpyingOverviewResponse {
        data,
        page: query.page,
        total_pages,
    }))
}
