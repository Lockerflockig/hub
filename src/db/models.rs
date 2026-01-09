use sqlx::FromRow;
use serde::Serialize;
use std::collections::HashMap;

// ============================================================================
// Enums
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
pub enum Status {
    New,
    Seen,
    Deleted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type)]
#[sqlx(type_name = "TEXT", rename_all = "UPPERCASE")]
pub enum PlanetType {
    Planet,
    Moon,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, sqlx::Type, serde::Serialize, serde::Deserialize)]
#[sqlx(type_name = "TEXT", rename_all = "lowercase")]
pub enum UserRole {
    Admin,
    User,
}

impl Default for UserRole {
    fn default() -> Self {
        UserRole::User
    }
}

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::Admin => "admin",
            UserRole::User => "user",
        }
    }
}

/// User row for admin list view (without api_key for security)
#[derive(Debug, Clone, FromRow)]
pub struct UserListRow {
    pub id: i64,
    pub player_id: Option<i64>,
    pub alliance_id: Option<i64>,
    pub language: String,
    pub role: UserRole,
    pub last_activity_at: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub player_name: Option<String>,
    pub alliance_name: Option<String>,
}

// ============================================================================
// Core Tables
// ============================================================================

#[derive(Debug, Clone, FromRow)]
pub struct UserRow {
    pub id: i64,
    pub api_key: String,
    pub player_id: Option<i64>,
    pub alliance_id: Option<i64>,
    pub language: String,
    pub role: UserRole,
    pub last_activity_at: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, FromRow)]
pub struct AllianceRow {
    pub id: i64,
    pub name: String,
    pub tag: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, FromRow)]
pub struct PlayerRow {
    pub id: i64,
    pub name: String,
    pub alliance_id: Option<i64>,
    pub main_coordinates: Option<String>,
    pub is_deleted: i64,
    pub inactive_since: Option<String>,
    pub vacation_since: Option<String>,
    pub research: Option<String>,        // JSON
    pub scores: Option<String>,          // JSON
    pub combats_total: i64,
    pub combats_won: i64,
    pub combats_draw: i64,
    pub combats_lost: i64,
    pub units_shot: i64,
    pub units_lost: i64,
    pub notice: Option<String>,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, FromRow)]
pub struct HubPlanetRow {
    pub player_id: Option<i64>,
    pub player_name: Option<String>,
    pub coordinates: Option<String>,
    pub buildings: Option<String>,
    pub points: Option<i64>,
}

#[derive(Debug, FromRow)]
pub struct HubResearchRow {
    pub id: Option<i64>,
    pub name: Option<String>,
    pub research: Option<String>,
}

#[derive(Debug, FromRow)]
pub struct HubFleetRow {
    pub player_id: Option<i64>,
    pub player_name: Option<String>,
    pub score_fleet: Option<i64>,
    pub fleet: Option<String>,
}

#[derive(Debug, FromRow)]
pub struct HubBuildingsRow {
    pub player_id: Option<i64>,
    pub player_name: Option<String>,
    pub coordinates: Option<String>,
    pub buildings: Option<String>,
}

#[derive(Debug, FromRow)]
pub struct PlayerWithAlliance {
    pub id: i64,
    pub name: String,
    pub alliance_id: Option<i64>,
    pub main_coordinates: Option<String>,
    pub is_deleted: Option<i64>,
    pub inactive_since: Option<String>,
    pub vacation_since: Option<String>,
    pub research: Option<String>,
    pub scores: Option<String>,
    pub combats_total: Option<i64>,
    pub combats_won: Option<i64>,
    pub combats_draw: Option<i64>,
    pub combats_lost: Option<i64>,
    pub units_shot: Option<i64>,
    pub units_lost: Option<i64>,
    pub notice: Option<String>,
    pub status: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub alliance_name: Option<String>,
    pub alliance_tag: Option<String>,
    // New score fields with ranks
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
#[derive(Debug, FromRow)]
pub struct PlanetRow {
    pub id: i64,
    pub name: Option<String>,
    pub player_id: i64,
    pub coordinates: String,
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub r#type: Option<String>,           // 'PLANET' or 'MOON' (DEFAULT but nullable in SQLite)
    pub planet_id: Option<i64>,           // pr0game internal planet ID
    pub buildings: Option<String>,        // JSON
    pub fleet: Option<String>,            // JSON
    pub defense: Option<String>,          // JSON
    pub resources: Option<String>,        // JSON
    pub prod_h: Option<i64>,
    pub status: Option<String>,           // DEFAULT but nullable in SQLite
    pub created_at: Option<String>,       // DEFAULT but nullable in SQLite
    pub updated_at: Option<String>,       // DEFAULT but nullable in SQLite
}

// ============================================================================
// Report Tables
// ============================================================================

#[derive(Debug, FromRow)]
pub struct SpyReportRow {
    pub id: i64,
    pub external_id: Option<i64>,
    pub coordinates: String,
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub r#type: Option<String>,          // DEFAULT but nullable in SQLite
    pub resources: Option<String>,       // JSON
    pub buildings: Option<String>,       // JSON
    pub research: Option<String>,        // JSON
    pub fleet: Option<String>,           // JSON
    pub defense: Option<String>,         // JSON
    pub reported_by: Option<i64>,
    pub report_time: Option<String>,
    pub created_at: Option<String>,      // DEFAULT but nullable in SQLite
}

#[derive(Debug, FromRow)]
pub struct SpyReportHistoryRow {
    pub id: i64,
    pub resources: Option<String>,
    pub buildings: Option<String>,
    pub research: Option<String>,
    pub fleet: Option<String>,
    pub defense: Option<String>,
    pub created_at: Option<String>,
    pub reporter_name: Option<String>,
}

#[derive(Debug, FromRow)]
pub struct BattleReportRow {
    pub id: i64,
    pub external_id: Option<i64>,
    pub coordinates: String,
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub r#type: Option<String>,
    pub attacker_lost: Option<i64>,
    pub defender_lost: Option<i64>,
    pub metal: Option<i64>,
    pub crystal: Option<i64>,
    pub deuterium: Option<i64>,
    pub debris_metal: Option<i64>,
    pub debris_crystal: Option<i64>,
    pub report_time: Option<String>,
    pub reported_by: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, FromRow)]
pub struct BattleReportHistoryRow {
    pub id: i64,
    pub report_id: Option<String>,
    pub attacker_lost: Option<i64>,
    pub defender_lost: Option<i64>,
    pub metal: Option<i64>,
    pub crystal: Option<i64>,
    pub deuterium: Option<i64>,
    pub debris_metal: Option<i64>,
    pub debris_crystal: Option<i64>,
    pub created_at: Option<String>,
    pub reporter_name: Option<String>,
}

#[derive(Debug, FromRow)]
pub struct ExpeditionReportRow {
    pub id: i64,
    pub external_id: Option<i64>,
    pub message: Option<String>,
    pub r#type: Option<String>,
    pub resources: Option<String>,       // JSON
    pub fleet: Option<String>,           // JSON
    pub report_time: Option<String>,
    pub reported_by: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, FromRow)]
pub struct RecycleReportRow {
    pub id: i64,
    pub external_id: Option<i64>,
    pub coordinates: String,
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub metal: Option<i64>,
    pub crystal: Option<i64>,
    pub metal_tf: Option<i64>,
    pub crystal_tf: Option<i64>,
    pub report_time: Option<String>,
    pub reported_by: Option<i64>,
    pub created_at: Option<String>,
}

#[derive(Debug, FromRow)]
pub struct HostileSpyingRow {
    pub id: i64,
    pub external_id: Option<i64>,
    pub attacker_coordinates: Option<String>,
    pub target_coordinates: Option<String>,
    pub report_time: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, FromRow)]
pub struct HostileSpyingOverviewRow {
    pub attacker_coordinates: String,
    pub attacker_name: Option<String>,
    pub attacker_alliance_tag: Option<String>,
    pub spy_count: i64,
    pub last_spy_time: Option<String>,
    pub targets: Option<String>,
}

// ============================================================================
// Tracking Tables
// ============================================================================

#[derive(Debug, FromRow)]
pub struct MessageRow {
    pub id: i64,
    pub external_id: Option<i64>,
    pub created_at: Option<String>,
}


#[derive(Debug, FromRow)]
pub struct StatViewRow {
    pub id: i64,
    pub stat_type: String,
    pub last_sync_at: Option<String>,
    pub synced_by: Option<i64>,
}

// ============================================================================
// Score & Log Tables
// ============================================================================

#[derive(Debug, FromRow)]
pub struct PlayerScoreRow {
    pub id: i64,
    pub player_id: i64,
    pub score_total: Option<i64>,         // DEFAULT but nullable in SQLite
    pub score_economy: Option<i64>,       // DEFAULT but nullable in SQLite
    pub score_research: Option<i64>,      // DEFAULT but nullable in SQLite
    pub score_military: Option<i64>,      // DEFAULT but nullable in SQLite
    pub score_defense: Option<i64>,       // DEFAULT but nullable in SQLite
    pub rank_total: Option<i64>,
    pub rank_economy: Option<i64>,
    pub rank_research: Option<i64>,
    pub rank_military: Option<i64>,
    pub rank_defense: Option<i64>,
    pub recorded_at: Option<String>,      // DEFAULT but nullable in SQLite
}


// ============================================================================
// Helper Types
// ============================================================================

use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct Coordinates {
    pub galaxy: u8,
    pub system: u16,
    pub planet: u8,
}

impl Coordinates {
    pub fn new(galaxy: u8, system: u16, planet: u8) -> Self {
        Self { galaxy, system, planet }
    }
}

impl fmt::Display for Coordinates {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:{}:{}", self.galaxy, self.system, self.planet)
    }
}

impl FromStr for Coordinates {
    type Err = &'static str;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let parts: Vec<&str> = s.split(':').collect();
        if parts.len() != 3 {
            return Err("Invalid format: expected 'galaxy:system:planet'");
        }
        Ok(Self {
            galaxy: parts[0].parse().map_err(|_| "Invalid galaxy")?,
            system: parts[1].parse().map_err(|_| "Invalid system")?,
            planet: parts[2].parse().map_err(|_| "Invalid planet")?,
        })
    }
}

// ============================================================================
// Bot Types (Discord bot specific)
// ============================================================================

#[derive(Debug, Clone, FromRow)]
pub struct NewPlanet {
    pub id: i64,
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub player_name: Option<String>,
    pub alliance_tag: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, FromRow)]
pub struct CountResult {
    pub count: i64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct InactivePlayer {
    pub name: Option<String>,
    pub score_total: Option<i64>,
    pub score_fleet: Option<i64>,
    pub score_buildings: Option<i64>,
    pub inactive_since: Option<String>,
}

// Spy report row from bot query (different from SpyReportRow)
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct BotSpyReportRow {
    pub created_at: Option<String>,
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub player_name: Option<String>,
    pub alliance_name: Option<String>,
    pub reporter_name: Option<String>,
    pub resources: Option<String>,
    pub buildings: Option<String>,
    pub fleet: Option<String>,
    pub defense: Option<String>,
}

// Parsed spy report for Discord display
#[derive(Debug, Clone)]
pub struct BotSpyReport {
    pub created_at: Option<String>,
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub player_name: Option<String>,
    pub alliance_name: Option<String>,
    pub reporter_name: Option<String>,
    pub resources: HashMap<String, i64>,
    pub buildings: HashMap<String, i64>,
    pub fleet: HashMap<String, i64>,
    pub defense: HashMap<String, i64>,
}

impl From<BotSpyReportRow> for BotSpyReport {
    fn from(row: BotSpyReportRow) -> Self {
        let parse_json = |s: Option<String>| -> HashMap<String, i64> {
            s.and_then(|json| serde_json::from_str(&json).ok())
                .unwrap_or_default()
        };

        BotSpyReport {
            created_at: row.created_at,
            galaxy: row.galaxy,
            system: row.system,
            planet: row.planet,
            player_name: row.player_name,
            alliance_name: row.alliance_name,
            reporter_name: row.reporter_name,
            resources: parse_json(row.resources),
            buildings: parse_json(row.buildings),
            fleet: parse_json(row.fleet),
            defense: parse_json(row.defense),
        }
    }
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PlayerName {
    pub name: Option<String>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PlayerId {
    pub id: i64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct PlayerInfo {
    pub id: i64,
    pub name: String,
    pub alliance_id: Option<i64>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct AllianceId {
    pub id: i64,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct BotUser {
    pub id: i64,
    pub api_key: String,
    pub player_id: Option<i64>,
    pub player_name: Option<String>,
    pub alliance_id: Option<i64>,
    pub role: String,
    pub last_activity_at: Option<String>,
    pub updated_at: Option<String>,
}

// Export types
#[derive(Debug, Clone, FromRow)]
pub struct ExportPlanet {
    pub galaxy: i64,
    pub system: i64,
    pub planet: i64,
    pub player_id: Option<i64>,
    pub player_name: Option<String>,
    pub alliance_id: i64,
    pub alliance_name: String,
    pub has_moon: i64,
    pub timepoint: i64,
}

#[derive(Debug, Clone, FromRow)]
pub struct ExportPlayer {
    pub id: i64,
    pub name: String,
    pub timepoint: i64,
}

#[derive(Debug, Clone, FromRow)]
pub struct ExportAlliance {
    pub id: i64,
    pub name: String,
    pub timepoint: i64,
}

// JSON serialization types for export
#[derive(Debug, Clone, Serialize)]
pub struct PlanetSlotData {
    pub planetname: String,
    pub hasmoon: bool,
    pub playerid: i64,
    pub name: String,
    pub allianceid: i64,
    pub alliancename: String,
    pub special: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlayerExportData {
    pub name: String,
    pub timepoint: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct AllianceExportData {
    pub name: String,
    pub timepoint: i64,
}
