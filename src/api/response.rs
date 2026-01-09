use serde::Serialize;
use std::collections::HashMap;
use crate::db::models::{PlanetRow, PlayerScoreRow};

// ============================================================================
// Helper Functions (shared across handlers)
// ============================================================================

/// Parse JSON string to HashMap
pub fn parse_json_map(json: &Option<String>) -> Option<HashMap<String, i64>> {
    json.as_ref().and_then(|s| serde_json::from_str(s).ok())
}

/// Serialize optional value to JSON string
pub fn to_json<T: serde::Serialize>(v: &Option<T>) -> Option<String> {
    v.as_ref().and_then(|v| serde_json::to_string(v).ok())
}

/// Parse JSON scores to ScoresInfo
pub fn parse_scores(json: &Option<String>) -> Option<ScoresInfo> {
    json.as_ref().and_then(|s| {
        serde_json::from_str::<HashMap<String, i64>>(s).ok().map(|m| ScoresInfo {
            total: *m.get("total").unwrap_or(&0),
            economy: *m.get("economy").unwrap_or(&0),
            research: *m.get("research").unwrap_or(&0),
            military: *m.get("military").unwrap_or(&0),
            defense: *m.get("defense").unwrap_or(&0),
        })
    })
}

/// Convert PlanetRow to PlanetResponse
pub fn planet_to_response(p: PlanetRow) -> PlanetResponse {
    PlanetResponse {
        id: p.id,
        coordinates: p.coordinates,
        r#type: p.r#type.unwrap_or_else(|| "PLANET".to_string()),
        buildings: parse_json_map(&p.buildings),
        fleet: parse_json_map(&p.fleet),
        defense: parse_json_map(&p.defense),
        resources: parse_json_map(&p.resources),
    }
}

/// Convert PlayerScoreRow to ChartPoint
pub fn score_to_chart_point(s: PlayerScoreRow) -> ChartPoint {
    ChartPoint {
        recorded_at: s.recorded_at.unwrap_or_default(),
        score_total: s.score_total.unwrap_or(0),
        score_economy: s.score_economy.unwrap_or(0),
        score_research: s.score_research.unwrap_or(0),
        score_military: s.score_military.unwrap_or(0),
        score_defense: s.score_defense.unwrap_or(0),
    }
}

// ============================================================================
// Players
// ============================================================================

#[derive(Serialize)]
pub struct PlayerResponse {
    pub id: i64,
    pub name: String,
    pub alliance: Option<AllianceInfo>,
    pub main_coordinates: Option<String>,
    pub research: Option<HashMap<String, i64>>,
    pub scores: Option<ScoresInfo>,
    pub combat_stats: CombatStats,
    pub status: PlayerStatus,
}

#[derive(Serialize)]
pub struct AllianceInfo {
    pub id: i64,
    pub name: String,
    pub tag: String,
}

#[derive(Serialize)]
pub struct ScoresInfo {
    pub total: i64,
    pub economy: i64,
    pub research: i64,
    pub military: i64,
    pub defense: i64,
}

#[derive(Serialize)]
pub struct CombatStats {
    pub total: i64,
    pub won: i64,
    pub draw: i64,
    pub lost: i64,
    pub units_shot: i64,
    pub units_lost: i64,
}

#[derive(Serialize)]
pub struct PlayerStatus {
    pub is_deleted: bool,
    pub inactive_since: Option<String>,
    pub vacation_since: Option<String>,
}

// ============================================================================
// Planets
// ============================================================================

#[derive(Serialize)]
pub struct PlanetResponse {
    pub id: i64,
    pub coordinates: String,
    pub r#type: String,
    pub buildings: Option<HashMap<String, i64>>,
    pub fleet: Option<HashMap<String, i64>>,
    pub defense: Option<HashMap<String, i64>>,
    pub resources: Option<HashMap<String, i64>>,
}

// ============================================================================
// Galaxy
// ============================================================================

#[derive(Serialize)]
pub struct GalaxySystemResponse {
    pub planets: Vec<GalaxyPlanetInfo>,
    pub spy_reports: Vec<GalaxySpyReport>,
    pub last_scan_at: Option<String>,
}

#[derive(Serialize)]
pub struct GalaxyPlanetInfo {
    pub id: i64,
    pub name: Option<String>,
    pub player_id: i64,
    pub coordinates: String,
    pub planet: i64,
    pub r#type: String,
    pub planet_id: Option<i64>,  // pr0game internal planet ID for sync comparison
}

#[derive(Serialize)]
pub struct GalaxySpyReport {
    pub planet: i64,
    pub r#type: String,
    pub resources: Option<HashMap<String, i64>>,
    pub report_time: Option<String>,
    pub created_at: Option<String>,
}

// ============================================================================
// Hub
// ============================================================================

#[derive(Serialize)]
pub struct HubPlanetsResponse {
    pub planets: Vec<HubPlanetInfo>,
}

#[derive(Serialize)]
pub struct HubPlanetInfo {
    pub player_id: i64,
    pub player_name: String,
    pub coordinates: String,
    pub buildings: Option<HashMap<String, i64>>,
    pub points: i64,
}

#[derive(Serialize)]
pub struct HubResearchResponse {
    pub players: Vec<HubResearchInfo>,
}

#[derive(Serialize)]
pub struct HubResearchInfo {
    pub id: i64,
    pub name: String,
    pub research: Option<HashMap<String, i64>>,
}

#[derive(Serialize)]
pub struct HubMaxResearchResponse {
    pub research: HashMap<String, MaxResearchInfo>,
}

#[derive(Serialize)]
pub struct MaxResearchInfo {
    pub max_level: i64,
    pub player_name: String,
}

#[derive(Serialize)]
pub struct HubFleetResponse {
    pub players: Vec<HubFleetInfo>,
    pub total: HashMap<String, i64>,
}

#[derive(Serialize)]
pub struct HubFleetInfo {
    pub id: i64,
    pub name: String,
    pub fleet: HashMap<String, i64>,
    pub score_fleet: Option<i64>,
}

// ============================================================================
// Charts
// ============================================================================

#[derive(Serialize)]
pub struct ChartResponse {
    pub scores: Vec<ChartPoint>,
}

#[derive(Serialize)]
pub struct ChartPoint {
    pub recorded_at: String,
    pub score_total: i64,
    pub score_economy: i64,
    pub score_research: i64,
    pub score_military: i64,
    pub score_defense: i64,
}

// ============================================================================
// Reports
// ============================================================================

#[derive(Serialize)]
pub struct SpyReportsResponse {
    pub coordinates: String,
    pub r#type: String,
    pub reports: Vec<SpyReportInfo>,
}

#[derive(Serialize)]
pub struct SpyReportInfo {
    pub id: i64,
    pub created_at: String,
    pub resources: Option<HashMap<String, i64>>,
    pub buildings: Option<HashMap<String, i64>>,
    pub research: Option<HashMap<String, i64>>,
    pub fleet: Option<HashMap<String, i64>>,
    pub defense: Option<HashMap<String, i64>>,
}

// ============================================================================
// Generic
// ============================================================================

#[derive(Serialize)]
pub struct SuccessResponse {
    pub success: bool,
}

#[derive(Serialize)]
pub struct MessageCheckResponse {
    pub new_ids: Vec<i64>,
}

// ============================================================================
// Login
// ============================================================================

#[derive(Serialize)]
pub struct LoginResponse {
    pub success: bool,
    pub user: LoginUserInfo,
}

#[derive(Serialize)]
pub struct LoginUserInfo {
    pub id: i64,
    pub player_id: Option<i64>,
    pub alliance_id: Option<i64>,
    pub language: String,
}

// ============================================================================
// Player Data
// ============================================================================

#[derive(Serialize)]
pub struct PlayerDataResponse {
    pub player: Option<PlayerResponse>,
    pub planets: Vec<PlanetResponse>,
    pub research: Option<HashMap<String, i64>>,
}

#[derive(Serialize)]
pub struct PlayersStatsResponse {
    pub success: bool,
    pub updated: u64,
}

#[derive(Serialize)]
pub struct ResearchResponse {
    pub success: bool,
    pub research: HashMap<String, i64>,
}

// ============================================================================
// Hub Extended
// ============================================================================

#[derive(Serialize)]
pub struct HubGalaxyResponse {
    pub systems: Vec<GalaxySystemInfo>,
}

#[derive(Serialize)]
pub struct GalaxySystemInfo {
    pub galaxy: i64,
    pub system: i64,
    pub last_scan_at: Option<String>,
    pub age_hours: Option<i64>,
}

#[derive(Serialize)]
pub struct HubStatViewResponse {
    pub stat_views: Vec<StatViewInfo>,
}

#[derive(Serialize)]
pub struct StatViewInfo {
    pub stat_type: String,
    pub last_sync_at: Option<String>,
    pub is_synced: bool,
}

#[derive(Serialize)]
pub struct HubScoresResponse {
    pub scores: Vec<ChartPoint>,
}

#[derive(Serialize)]
pub struct HubBuildingsResponse {
    pub buildings: HashMap<String, MaxBuildingInfo>,
}

#[derive(Serialize)]
pub struct MaxBuildingInfo {
    pub max_level: i64,
    pub player_name: String,
}

#[derive(Serialize)]
pub struct HubConfigResponse {
    pub galaxies: i64,
    pub systems: i64,
    pub galaxy_wrapped: bool,
}

// ============================================================================
// Hostile Spying
// ============================================================================

#[derive(Serialize)]
pub struct HostileSpyingResponse {
    pub data: Vec<HostileSpyingInfo>,
    pub page: i64,
    pub total_pages: i64,
}

#[derive(Serialize)]
pub struct HostileSpyingInfo {
    pub id: i64,
    pub attacker_coordinates: Option<String>,
    pub target_coordinates: Option<String>,
    pub report_time: Option<String>,
}

#[derive(Serialize)]
pub struct HostileSpyingOverviewResponse {
    pub data: Vec<HostileSpyingOverviewInfo>,
    pub page: i64,
    pub total_pages: i64,
}

#[derive(Serialize)]
pub struct HostileSpyingOverviewInfo {
    pub attacker_coordinates: String,
    pub attacker_name: Option<String>,
    pub attacker_alliance_tag: Option<String>,
    pub spy_count: i64,
    pub last_spy_time: Option<String>,
    pub targets: Vec<String>,
}

// ============================================================================
// Planets
// ============================================================================

#[derive(Serialize)]
pub struct PlanetsNewResponse {
    pub success: bool,
    pub created: i64,
    pub deleted: i64,
}

// ============================================================================
// Overview
// ============================================================================

#[derive(Serialize)]
pub struct OverviewResponse {
    pub planets: Vec<OverviewPlanetInfo>,
}

#[derive(Serialize)]
pub struct OverviewPlanetInfo {
    pub coordinates: String,
    pub distance: i64,
    pub player: Option<OverviewPlayerInfo>,
    pub last_spy_report: Option<OverviewSpyReport>,
    pub resources: Option<HashMap<String, i64>>,
}

#[derive(Serialize)]
pub struct OverviewPlayerInfo {
    pub id: i64,
    pub name: String,
}

#[derive(Serialize)]
pub struct OverviewSpyReport {
    pub id: i64,
    pub created_at: String,
    pub resources: Option<HashMap<String, i64>>,
}

// ============================================================================
// Hub Stats (Raids, Expos, Recycling)
// ============================================================================

#[derive(Serialize)]
pub struct HubStatsResponse {
    pub own_stats: OwnStats,
    pub alliance_stats: Option<Vec<PlayerStats>>,
}

#[derive(Serialize)]
pub struct OwnStats {
    pub expos: ActivityStats,
    pub raids: ActivityStats,
    pub recycling: ActivityStats,
}

#[derive(Serialize)]
pub struct PlayerStats {
    pub id: i64,
    pub name: String,
    pub expos: ActivityStats,
    pub raids: ActivityStats,
    pub recycling: ActivityStats,
}

#[derive(Serialize, Default)]
pub struct ActivityStats {
    pub count: i64,
    pub count_24h: i64,
    pub metal: i64,
    pub crystal: i64,
    pub deuterium: i64,
    pub points: i64,
}

// ============================================================================
// Hub Overview (Player Data Table)
// ============================================================================

#[derive(Serialize)]
pub struct HubOverviewResponse {
    pub planets: Vec<HubOverviewPlanet>,
}

#[derive(Serialize)]
pub struct HubOverviewPlanet {
    pub id: i64,
    pub planet_id: Option<i64>,  // pr0game internal planet ID (for Ajax spy)
    pub coordinates: String,
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub player_id: i64,
    pub player_name: String,
    pub alliance_id: Option<i64>,
    pub alliance_tag: Option<String>,
    pub notice: Option<String>,  // Player notice for tooltip
    pub score_total: Option<i64>,
    pub score_buildings: Option<i64>,
    pub score_research: Option<i64>,
    pub score_fleet: Option<i64>,
    pub score_defense: Option<i64>,
    pub diff06: Option<i64>,
    pub diff12: Option<i64>,
    pub diff18: Option<i64>,
    pub diff24: Option<i64>,
    pub inactive_since: Option<String>,
    pub vacation_since: Option<String>,
    pub last_spy_report: Option<String>,
    pub last_battle_report: Option<String>,
    pub spy_metal: Option<i64>,
    pub spy_crystal: Option<i64>,
    pub spy_deuterium: Option<i64>,
}

// ============================================================================
// Spy Report History (for overlay)
// ============================================================================

#[derive(Serialize)]
pub struct SpyReportHistoryResponse {
    pub coordinates: String,
    pub r#type: String,
    pub reports: Vec<SpyReportHistoryItem>,
}

#[derive(Serialize)]
pub struct SpyReportHistoryItem {
    pub id: i64,
    pub created_at: String,
    pub reporter_name: Option<String>,
    pub resources: Option<std::collections::HashMap<String, i64>>,
    pub buildings: Option<std::collections::HashMap<String, i64>>,
    pub research: Option<std::collections::HashMap<String, i64>>,
    pub fleet: Option<std::collections::HashMap<String, i64>>,
    pub defense: Option<std::collections::HashMap<String, i64>>,
}

// ============================================================================
// Battle Report History (for overlay)
// ============================================================================

#[derive(Serialize)]
pub struct BattleReportHistoryResponse {
    pub coordinates: String,
    pub reports: Vec<BattleReportHistoryItem>,
}

#[derive(Serialize)]
pub struct BattleReportHistoryItem {
    pub id: i64,
    pub report_id: String,
    pub created_at: String,
    pub reporter_name: Option<String>,
    pub attacker_lost: i64,
    pub defender_lost: i64,
    pub metal: i64,
    pub crystal: i64,
    pub deuterium: i64,
    pub debris_metal: i64,
    pub debris_crystal: i64,
}

// ============================================================================
// Admin - User Management
// ============================================================================

#[derive(Serialize)]
pub struct AdminUsersResponse {
    pub users: Vec<AdminUserInfo>,
}

#[derive(Serialize)]
pub struct AdminUserInfo {
    pub id: i64,
    pub player_id: Option<i64>,
    pub player_name: Option<String>,
    pub alliance_id: Option<i64>,
    pub alliance_name: Option<String>,
    pub language: String,
    pub role: String,
    pub last_activity_at: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Serialize)]
pub struct AdminUserCreatedResponse {
    pub success: bool,
    pub user_id: i64,
    pub api_key: String,
}

#[derive(Serialize)]
pub struct AdminCheckResponse {
    pub is_admin: bool,
}
