//! Bot-specific database queries for Discord bot commands

use std::collections::HashMap;
use serde_json::{json, Map, Value};
use sqlx::query_as;
use tracing::info;
use uuid::Uuid;

use crate::get_pool;
use crate::db::models::{
    AllianceExportData, AllianceId, BotSpyReport, BotSpyReportRow, BotUser,
    CountResult, ExportAlliance, ExportPlanet, ExportPlayer, InactivePlayer,
    NewPlanet, PlayerExportData, PlayerId, PlayerInfo, PlayerName, PlanetSlotData,
};

// ============================================================================
// Player Queries
// ============================================================================

pub async fn get_player_name(id: i64) -> Result<PlayerName, sqlx::Error> {
    let pool = get_pool().await;
    let player = query_as::<_, PlayerName>("SELECT name FROM players WHERE id = ? LIMIT 1")
        .bind(id)
        .fetch_one(pool)
        .await?;

    info!(?player.name, "found");
    Ok(player)
}

pub async fn get_player_id(name: &str) -> Result<PlayerId, sqlx::Error> {
    let pool = get_pool().await;
    let player = query_as::<_, PlayerId>(
        "SELECT id FROM players WHERE LOWER(name) = LOWER(?) LIMIT 1"
    )
        .bind(name)
        .fetch_one(pool)
        .await?;

    info!(id = player.id, "found");
    Ok(player)
}

pub async fn get_player_by_name(name: &str) -> Result<PlayerInfo, sqlx::Error> {
    let pool = get_pool().await;
    let player = query_as::<_, PlayerInfo>(
        "SELECT id, name, alliance_id FROM players WHERE LOWER(name) = LOWER(?) LIMIT 1"
    )
        .bind(name)
        .fetch_one(pool)
        .await?;

    info!(id = player.id, name = player.name, "player found");
    Ok(player)
}

// ============================================================================
// Alliance Queries
// ============================================================================

pub async fn get_ally_id_by_name(name: &str) -> Result<AllianceId, sqlx::Error> {
    let pool = get_pool().await;
    let ally = query_as::<_, AllianceId>(
        "SELECT id FROM alliances WHERE LOWER(name) = LOWER(?) OR LOWER(tag) = LOWER(?) LIMIT 1"
    )
        .bind(name)
        .bind(name)
        .fetch_one(pool)
        .await?;

    info!(id = ally.id, "alliance found");
    Ok(ally)
}

// ============================================================================
// User Queries
// ============================================================================

pub async fn create_user(player_id: i64, alliance_id: i64) -> Result<String, sqlx::Error> {
    let pool = get_pool().await;
    let api_key = Uuid::new_v4().to_string();

    let result = sqlx::query(
        "INSERT INTO users (api_key, player_id, alliance_id, role, updated_at) \
         VALUES (?, ?, ?, 'user', CURRENT_TIMESTAMP)"
    )
        .bind(&api_key)
        .bind(player_id)
        .bind(alliance_id)
        .execute(pool)
        .await?;

    let success = result.rows_affected() == 1;
    info!(success, player_id, "user created");

    Ok(api_key)
}

pub async fn remove_user(user_id: i64) -> Result<bool, sqlx::Error> {
    let pool = get_pool().await;
    let result = sqlx::query("DELETE FROM users WHERE id = ?")
        .bind(user_id)
        .execute(pool)
        .await?;

    let success = result.rows_affected() == 1;
    info!(success, user_id, "user deleted");
    Ok(success)
}

pub async fn get_all_users() -> Result<Vec<BotUser>, sqlx::Error> {
    let pool = get_pool().await;
    let users = query_as::<_, BotUser>(
        "SELECT u.id, u.api_key, u.player_id, p.name as player_name, \
         u.alliance_id, u.role, u.last_activity_at, u.updated_at \
         FROM users u LEFT JOIN players p ON u.player_id = p.id ORDER BY p.name"
    )
        .fetch_all(pool)
        .await?;

    info!(count = users.len(), "users fetched");
    Ok(users)
}

pub async fn get_user_by_player_name(name: &str) -> Result<BotUser, sqlx::Error> {
    let pool = get_pool().await;
    let user = query_as::<_, BotUser>(
        "SELECT u.id, u.api_key, u.player_id, p.name as player_name, \
         u.alliance_id, u.role, u.last_activity_at, u.updated_at \
         FROM users u JOIN players p ON u.player_id = p.id \
         WHERE LOWER(p.name) = LOWER(?) LIMIT 1"
    )
        .bind(name)
        .fetch_one(pool)
        .await?;

    info!(?user.player_name, "user fetched");
    Ok(user)
}

pub async fn get_user_by_id(id: i64) -> Result<BotUser, sqlx::Error> {
    let pool = get_pool().await;
    let user = query_as::<_, BotUser>(
        "SELECT u.id, u.api_key, u.player_id, p.name as player_name, \
         u.alliance_id, u.role, u.last_activity_at, u.updated_at \
         FROM users u LEFT JOIN players p ON u.player_id = p.id WHERE u.id = ? LIMIT 1"
    )
        .bind(id)
        .fetch_one(pool)
        .await?;

    info!(?user.player_name, "user fetched");
    Ok(user)
}

// ============================================================================
// Planet Queries
// ============================================================================

pub async fn get_new_planets() -> Result<Vec<NewPlanet>, sqlx::Error> {
    let pool = get_pool().await;
    let planets = query_as::<_, NewPlanet>(
        "SELECT p.id, p.galaxy, p.system, p.planet, pl.name AS player_name, \
         a.tag AS alliance_tag, p.created_at \
         FROM planets p \
         LEFT JOIN players pl ON p.player_id = pl.id \
         LEFT JOIN alliances a ON pl.alliance_id = a.id \
         WHERE p.status = 'new' AND p.type = 'PLANET' \
         ORDER BY p.galaxy, p.system, p.planet"
    )
        .fetch_all(pool)
        .await?;
    info!(count = planets.len(), "new planets found");
    Ok(planets)
}

pub async fn mark_planets_seen_by_ids(ids: &[i64]) -> Result<u64, sqlx::Error> {
    let pool = get_pool().await;
    let json_ids = serde_json::to_string(ids).unwrap_or_else(|_| "[]".to_string());
    let result = sqlx::query(
        "UPDATE planets SET status = 'seen', updated_at = CURRENT_TIMESTAMP \
         WHERE id IN (SELECT value FROM json_each(?))"
    )
        .bind(&json_ids)
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}

pub async fn mark_all_planets_seen() -> Result<u64, sqlx::Error> {
    let pool = get_pool().await;
    let result = sqlx::query(
        "UPDATE planets SET status = 'seen', updated_at = CURRENT_TIMESTAMP WHERE status = 'new'"
    )
        .execute(pool)
        .await?;
    Ok(result.rows_affected())
}

pub async fn count_new_planets() -> Result<i64, sqlx::Error> {
    let pool = get_pool().await;
    let result = query_as::<_, CountResult>(
        "SELECT COUNT(*) as count FROM planets WHERE status = 'new' AND type = 'PLANET'"
    )
        .fetch_one(pool)
        .await?;
    Ok(result.count)
}

// ============================================================================
// Spy Queries
// ============================================================================

pub async fn get_spy_report(galaxy: i64, system: i64, planet: i64) -> Result<BotSpyReport, sqlx::Error> {
    let pool = get_pool().await;
    let row = query_as::<_, BotSpyReportRow>(
        "SELECT sr.created_at, sr.galaxy, sr.system, sr.planet, \
         p.name AS player_name, a.name AS alliance_name, reporter.name AS reporter_name, \
         sr.resources, sr.buildings, sr.fleet, sr.defense \
         FROM spy_reports sr \
         LEFT JOIN planets pl ON sr.galaxy = pl.galaxy AND sr.system = pl.system \
             AND sr.planet = pl.planet AND pl.type = 'PLANET' \
         LEFT JOIN players p ON pl.player_id = p.id \
         LEFT JOIN alliances a ON p.alliance_id = a.id \
         LEFT JOIN players reporter ON sr.reported_by = reporter.id \
         WHERE sr.galaxy = ? AND sr.system = ? AND sr.planet = ? \
         ORDER BY sr.created_at DESC LIMIT 1"
    )
        .bind(galaxy)
        .bind(system)
        .bind(planet)
        .fetch_one(pool)
        .await?;

    let report: BotSpyReport = row.into();
    let player = &report.player_name;
    info!(?player, "report found");
    Ok(report)
}

pub async fn get_top_inactive() -> Result<Vec<InactivePlayer>, sqlx::Error> {
    let pool = get_pool().await;
    let farms = query_as::<_, InactivePlayer>(
        "SELECT name, score_total, score_fleet, score_buildings, inactive_since \
         FROM players \
         WHERE inactive_since IS NOT NULL AND vacation_since IS NULL AND is_deleted = 0 \
         ORDER BY score_total DESC LIMIT 20"
    )
        .fetch_all(pool)
        .await?;
    info!(farms = farms.len(), "farms found");
    Ok(farms)
}

// ============================================================================
// Export Queries
// ============================================================================

pub async fn get_all_planets_for_export() -> Result<Vec<ExportPlanet>, sqlx::Error> {
    let pool = get_pool().await;
    let planets = query_as::<_, ExportPlanet>(
        "SELECT p.galaxy, p.system, p.planet, p.player_id, pl.name AS player_name, \
         COALESCE(pl.alliance_id, -1) AS alliance_id, COALESCE(a.name, '-') AS alliance_name, \
         EXISTS(SELECT 1 FROM planets m WHERE m.galaxy = p.galaxy AND m.system = p.system \
             AND m.planet = p.planet AND m.type = 'MOON') AS has_moon, \
         COALESCE(CAST(strftime('%s', gv.last_scan_at) AS INTEGER) * 1000, \
             CAST(strftime('%s', p.updated_at) AS INTEGER) * 1000, 0) AS timepoint \
         FROM planets p \
         LEFT JOIN players pl ON p.player_id = pl.id \
         LEFT JOIN alliances a ON pl.alliance_id = a.id \
         LEFT JOIN galaxy_views gv ON p.galaxy = gv.galaxy AND p.system = gv.system \
         WHERE p.type = 'PLANET' ORDER BY p.galaxy, p.system, p.planet"
    )
        .fetch_all(pool)
        .await?;

    info!(count = planets.len(), "export planets fetched");
    Ok(planets)
}

pub async fn get_all_players_for_export() -> Result<Vec<ExportPlayer>, sqlx::Error> {
    let pool = get_pool().await;
    let players = query_as::<_, ExportPlayer>(
        "SELECT id, name, COALESCE(CAST(strftime('%s', updated_at) AS INTEGER) * 1000, 0) AS timepoint \
         FROM players WHERE name IS NOT NULL ORDER BY id"
    )
        .fetch_all(pool)
        .await?;

    info!(count = players.len(), "export players fetched");
    Ok(players)
}

pub async fn get_all_alliances_for_export() -> Result<Vec<ExportAlliance>, sqlx::Error> {
    let pool = get_pool().await;
    let alliances = query_as::<_, ExportAlliance>(
        "SELECT id, name, COALESCE(CAST(strftime('%s', updated_at) AS INTEGER) * 1000, 0) AS timepoint \
         FROM alliances ORDER BY id"
    )
        .fetch_all(pool)
        .await?;

    info!(count = alliances.len(), "export alliances fetched");
    Ok(alliances)
}

/// Builds the complete export JSON in the required format
pub async fn build_export_json() -> Result<String, sqlx::Error> {
    // Run all queries in parallel for better performance
    let (planets_result, players_result, alliances_result) = tokio::join!(
        get_all_planets_for_export(),
        get_all_players_for_export(),
        get_all_alliances_for_export()
    );

    let planets = planets_result?;
    let players = players_result?;
    let alliances = alliances_result?;

    // Build coordinates map: "galaxy:system" -> { "1": data, ..., "15": data, "timepoint": ts }
    let mut coords_map: HashMap<String, Map<String, Value>> = HashMap::new();

    for planet in &planets {
        let key = format!("{}:{}", planet.galaxy, planet.system);
        let slot_key = planet.planet.to_string();

        let entry = coords_map.entry(key).or_insert_with(|| {
            let mut map = Map::new();
            // Initialize all 15 slots as null
            for i in 1..=15 {
                map.insert(i.to_string(), Value::Null);
            }
            map.insert("timepoint".to_string(), json!(planet.timepoint));
            map
        });

        // Update timepoint to the latest
        if let Some(Value::Number(current_tp)) = entry.get("timepoint") {
            if let Some(current) = current_tp.as_i64() {
                if planet.timepoint > current {
                    entry.insert("timepoint".to_string(), json!(planet.timepoint));
                }
            }
        }

        // Only add planet data if there's a player
        if let (Some(player_id), Some(player_name)) = (&planet.player_id, &planet.player_name) {
            let slot_data = PlanetSlotData {
                planetname: String::new(),
                hasmoon: planet.has_moon != 0,
                playerid: *player_id,
                name: player_name.clone(),
                allianceid: planet.alliance_id,
                alliancename: planet.alliance_name.clone(),
                special: String::new(),
            };
            entry.insert(slot_key, json!(slot_data));
        }
    }

    // Build players map: "playerid" -> { "name": ..., "timepoint": ... }
    let mut players_map: Map<String, Value> = Map::new();
    for player in &players {
        let player_data = PlayerExportData {
            name: player.name.clone(),
            timepoint: player.timepoint,
        };
        players_map.insert(player.id.to_string(), json!(player_data));
    }

    // Build alliances map: "allianceid" -> { "name": ..., "timepoint": ... }
    let mut alliances_map: Map<String, Value> = Map::new();
    for alliance in &alliances {
        let alliance_data = AllianceExportData {
            name: alliance.name.clone(),
            timepoint: alliance.timepoint,
        };
        alliances_map.insert(alliance.id.to_string(), json!(alliance_data));
    }

    // Add entry for "no alliance" (-1)
    let max_timepoint = alliances.iter().map(|a| a.timepoint).max().unwrap_or(0);
    alliances_map.insert(
        "-1".to_string(),
        json!(AllianceExportData {
            name: "-".to_string(),
            timepoint: max_timepoint,
        }),
    );

    // Convert coords_map to Value
    let coords_value: Value = coords_map
        .into_iter()
        .map(|(k, v)| (k, Value::Object(v)))
        .collect::<Map<String, Value>>()
        .into();

    // Build final array: [coords, players, alliances]
    let result = json!([coords_value, players_map, alliances_map]);

    let json_string = serde_json::to_string(&result).map_err(|e| {
        sqlx::Error::Protocol(format!("JSON serialization error: {}", e))
    })?;

    info!(
        size_bytes = json_string.len(),
        "export JSON built"
    );

    Ok(json_string)
}
