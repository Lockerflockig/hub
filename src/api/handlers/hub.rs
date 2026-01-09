use axum::{extract::Extension, Json};
use chrono::Timelike;
use crate::api::auth::AuthUser;
use crate::api::error::AppError;
use crate::api::response::*;
use crate::db::queries::{hub, config};
use crate::get_pool;
use std::collections::HashMap;
use sqlx::Row;

/// GET /api/hub/planets
pub async fn get_planets(
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<HubPlanetsResponse>, AppError> {
    let alliance_id = user.alliance_id
        .ok_or_else(|| AppError::BadRequest("Keine Allianz zugeordnet".into()))?;

    let planets = hub::get_planets(alliance_id).await?;

    let response = HubPlanetsResponse {
        planets: planets
            .into_iter()
            .map(|p| HubPlanetInfo {
                player_id: p.player_id.unwrap_or(0),
                player_name: p.player_name.unwrap_or_default(),
                coordinates: p.coordinates.unwrap_or_default(),
                buildings: p.buildings.as_ref().and_then(|s| serde_json::from_str(s).ok()),
                points: p.points.unwrap_or(0),
            })
            .collect(),
    };

    Ok(Json(response))
}

/// GET /api/hub/research
pub async fn get_research(
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<HubResearchResponse>, AppError> {
    let alliance_id = user.alliance_id
        .ok_or_else(|| AppError::BadRequest("Keine Allianz zugeordnet".into()))?;

    let research = hub::get_research(alliance_id).await?;

    let response = HubResearchResponse {
        players: research
            .into_iter()
            .map(|r| HubResearchInfo {
                id: r.id.unwrap_or(0),
                name: r.name.clone().unwrap_or_default(),
                research: r.research.as_ref().and_then(|s| serde_json::from_str(s).ok()),
            })
            .collect(),
    };

    Ok(Json(response))
}

/// GET /api/hub/playerresearch - Max research per tech
pub async fn get_max_research(
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<HubMaxResearchResponse>, AppError> {
    let alliance_id = user.alliance_id
        .ok_or_else(|| AppError::BadRequest("Keine Allianz zugeordnet".into()))?;

    let rows = hub::get_research(alliance_id).await?;

    let mut result: HashMap<String, MaxResearchInfo> = HashMap::new();

    for row in rows {
        if let Some(research_json) = &row.research {
            if let Ok(research) = serde_json::from_str::<HashMap<String, i64>>(research_json) {
                for (tech_id, level) in research {
                    result.entry(tech_id.clone())
                        .and_modify(|e| {
                            if level > e.max_level {
                                e.max_level = level;
                                e.player_name = row.name.clone().unwrap_or_default();
                            }
                        })
                        .or_insert(MaxResearchInfo {
                            max_level: level,
                            player_name: row.name.clone().unwrap_or_default(),
                        });
                }
            }
        }
    }

    Ok(Json(HubMaxResearchResponse { research: result }))
}

/// GET /api/hub/fleet
pub async fn get_fleet(
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<HubFleetResponse>, AppError> {
    let alliance_id = user.alliance_id
        .ok_or_else(|| AppError::BadRequest("Keine Allianz zugeordnet".into()))?;

    let rows = hub::get_fleet(alliance_id).await?;

    // Aggregate fleet by player (LEFT JOIN returns multiple rows per player)
    let mut player_map: HashMap<i64, HubFleetInfo> = HashMap::new();
    let mut total: HashMap<String, i64> = HashMap::new();

    for r in rows {
        let player_id = r.player_id.unwrap_or(0);
        let fleet: HashMap<String, i64> = r.fleet.as_ref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default();

        // Add fleet to total
        for (ship_id, count) in &fleet {
            *total.entry(ship_id.clone()).or_insert(0) += count;
        }

        // Aggregate by player
        player_map.entry(player_id)
            .and_modify(|p| {
                // Merge fleet counts
                for (ship_id, count) in &fleet {
                    *p.fleet.entry(ship_id.clone()).or_insert(0) += count;
                }
            })
            .or_insert(HubFleetInfo {
                id: player_id,
                name: r.player_name.unwrap_or_default(),
                fleet,
                score_fleet: r.score_fleet,
            });
    }

    let players: Vec<HubFleetInfo> = player_map.into_values().collect();

    Ok(Json(HubFleetResponse { players, total }))
}

/// GET /api/hub/galaxy
pub async fn get_galaxy_status(
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<HubGalaxyResponse>, AppError> {
    let rows = hub::get_galaxy_status().await?;

    let systems: Vec<GalaxySystemInfo> = rows.into_iter().map(|r| {
        // SQLite stores timestamps as "YYYY-MM-DD HH:MM:SS", not RFC3339
        let age_hours = r.last_scan_at.as_ref().and_then(|ts| {
            chrono::NaiveDateTime::parse_from_str(ts, "%Y-%m-%d %H:%M:%S").ok().map(|dt| {
                let now = chrono::Utc::now().naive_utc();
                let duration = now.signed_duration_since(dt);
                duration.num_hours()
            })
        });

        GalaxySystemInfo {
            galaxy: r.galaxy,
            system: r.system,
            last_scan_at: r.last_scan_at,
            age_hours,
        }
    }).collect();

    Ok(Json(HubGalaxyResponse { systems }))
}

/// GET /api/hub/statview
pub async fn get_stat_view(
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<HubStatViewResponse>, AppError> {
    let rows = hub::get_stat_view().await?;

    let stat_views: Vec<StatViewInfo> = rows.into_iter().map(|r| {
        // SQLite stores timestamps as "YYYY-MM-DD HH:MM:SS", not RFC3339
        // Check if sync is within current 6-hour window (0-6, 6-12, 12-18, 18-24)
        let is_synced = r.last_sync_at.as_ref().map(|ts| {
            chrono::NaiveDateTime::parse_from_str(ts, "%Y-%m-%d %H:%M:%S").ok().map(|dt| {
                let now = chrono::Utc::now().naive_utc();

                // Calculate current 6-hour window start
                let current_hour = now.time().hour() as i64;
                let window_start_hour = (current_hour / 6) * 6;  // 0, 6, 12, or 18

                // Build window start datetime (today at window_start_hour:00:00)
                let today = now.date();
                let window_start = today.and_hms_opt(window_start_hour as u32, 0, 0)
                    .unwrap_or(now);

                // Sync is valid if it happened after window start
                dt >= window_start
            }).unwrap_or(false)
        }).unwrap_or(false);

        StatViewInfo {
            stat_type: r.stat_type,
            last_sync_at: r.last_sync_at,
            is_synced,
        }
    }).collect();

    Ok(Json(HubStatViewResponse { stat_views }))
}

/// GET /api/hub/scores
pub async fn get_scores(
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<HubScoresResponse>, AppError> {
    let alliance_id = user.alliance_id
        .ok_or_else(|| AppError::BadRequest("Keine Allianz zugeordnet".into()))?;

    let rows = hub::get_scores(alliance_id).await?;

    let scores: Vec<ChartPoint> = rows.into_iter().map(|s| ChartPoint {
        recorded_at: s.recorded_at.unwrap_or_default(),
        score_total: s.score_total.unwrap_or(0),
        score_economy: s.score_economy.unwrap_or(0),
        score_research: s.score_research.unwrap_or(0),
        score_military: s.score_military.unwrap_or(0),
        score_defense: s.score_defense.unwrap_or(0),
    }).collect();

    Ok(Json(HubScoresResponse { scores }))
}

/// GET /api/hub/buildings
pub async fn get_buildings(
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<HubBuildingsResponse>, AppError> {
    let alliance_id = user.alliance_id
        .ok_or_else(|| AppError::BadRequest("Keine Allianz zugeordnet".into()))?;

    let rows = hub::get_buildings(alliance_id).await?;

    let mut result: HashMap<String, MaxBuildingInfo> = HashMap::new();

    for row in rows {
        if let Some(buildings_json) = &row.buildings {
            if let Ok(buildings) = serde_json::from_str::<HashMap<String, i64>>(buildings_json) {
                for (building_id, level) in buildings {
                    result.entry(building_id.clone())
                        .and_modify(|e| {
                            if level > e.max_level {
                                e.max_level = level;
                                e.player_name = row.player_name.clone().unwrap_or_default();
                            }
                        })
                        .or_insert(MaxBuildingInfo {
                            max_level: level,
                            player_name: row.player_name.clone().unwrap_or_default(),
                        });
                }
            }
        }
    }

    Ok(Json(HubBuildingsResponse { buildings: result }))
}

/// GET /api/hub/config
pub async fn get_config(
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<HubConfigResponse>, AppError> {
    let rows = config::get_universe_config().await?;

    let mut galaxies = 9i64;
    let mut systems = 499i64;
    let mut galaxy_wrapped = true; // Default: galaxies wrap around

    for row in rows {
        match row.key.as_str() {
            "galaxies" => galaxies = row.value.parse().unwrap_or(9),
            "systems" => systems = row.value.parse().unwrap_or(499),
            "galaxy_wrapped" => galaxy_wrapped = row.value == "true" || row.value == "1",
            _ => {}
        }
    }

    Ok(Json(HubConfigResponse { galaxies, systems, galaxy_wrapped }))
}

/// GET /api/hub/stats - Raid, Expo, Recycling statistics
pub async fn get_stats(
    Extension(AuthUser(user)): Extension<AuthUser>,
) -> Result<Json<HubStatsResponse>, AppError> {
    let pool = get_pool().await;

    // reported_by references players(id), not users(id)
    let player_id = user.player_id
        .ok_or_else(|| AppError::BadRequest("Kein Spieler zugeordnet".into()))?;

    // Own stats (all time)
    let own_stats = OwnStats {
        expos: get_expo_stats(pool, player_id, false).await?,
        raids: get_raid_stats(pool, player_id, false).await?,
        recycling: get_recycle_stats(pool, player_id, false).await?,
    };

    // Alliance stats (last 24h) - only if user has alliance
    let alliance_stats = if let Some(alliance_id) = user.alliance_id {
        // Get all players in the alliance (reported_by references player_id)
        let alliance_players: Vec<(i64, String)> = sqlx::query(
            r#"SELECT p.id, p.name
               FROM players p
               WHERE p.alliance_id = ?
               ORDER BY p.name"#
        )
        .bind(alliance_id)
        .fetch_all(pool)
        .await?
        .into_iter()
        .map(|row| (row.get("id"), row.get("name")))
        .collect();

        let mut stats = Vec::new();
        for (pid, name) in alliance_players {
            stats.push(PlayerStats {
                id: pid,
                name,
                expos: get_expo_stats(pool, pid, true).await?,
                raids: get_raid_stats(pool, pid, true).await?,
                recycling: get_recycle_stats(pool, pid, true).await?,
            });
        }
        Some(stats)
    } else {
        None
    };

    Ok(Json(HubStatsResponse { own_stats, alliance_stats }))
}

async fn get_expo_stats(pool: &sqlx::SqlitePool, user_id: i64, last_24h: bool) -> Result<ActivityStats, sqlx::Error> {
    let time_filter = if last_24h {
        "AND created_at > datetime('now', '-24 hours')"
    } else {
        ""
    };

    let query = format!(
        r#"SELECT
            COUNT(*) as count,
            COALESCE(SUM(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END), 0) as count_24h,
            COALESCE(SUM(json_extract(resources, '$.901')), 0) as metal,
            COALESCE(SUM(json_extract(resources, '$.902')), 0) as crystal,
            COALESCE(SUM(json_extract(resources, '$.903')), 0) as deuterium
           FROM expedition_reports
           WHERE reported_by = ? {}"#,
        time_filter
    );

    let row = sqlx::query(&query)
        .bind(user_id)
        .fetch_one(pool)
        .await?;

    let metal: i64 = row.try_get("metal").unwrap_or(0);
    let crystal: i64 = row.try_get("crystal").unwrap_or(0);
    let deuterium: i64 = row.try_get("deuterium").unwrap_or(0);
    let points = (metal + crystal + deuterium) / 1000;

    Ok(ActivityStats {
        count: row.try_get("count").unwrap_or(0),
        count_24h: row.try_get("count_24h").unwrap_or(0),
        metal,
        crystal,
        deuterium,
        points,
    })
}

async fn get_raid_stats(pool: &sqlx::SqlitePool, user_id: i64, last_24h: bool) -> Result<ActivityStats, sqlx::Error> {
    let time_filter = if last_24h {
        "AND created_at > datetime('now', '-24 hours')"
    } else {
        ""
    };

    let query = format!(
        r#"SELECT
            COUNT(*) as count,
            COALESCE(SUM(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END), 0) as count_24h,
            COALESCE(SUM(metal), 0) as metal,
            COALESCE(SUM(crystal), 0) as crystal,
            COALESCE(SUM(deuterium), 0) as deuterium
           FROM battle_reports
           WHERE reported_by = ? {}"#,
        time_filter
    );

    let row = sqlx::query(&query)
        .bind(user_id)
        .fetch_one(pool)
        .await?;

    let metal: i64 = row.try_get("metal").unwrap_or(0);
    let crystal: i64 = row.try_get("crystal").unwrap_or(0);
    let deuterium: i64 = row.try_get("deuterium").unwrap_or(0);
    let points = (metal + crystal + deuterium) / 1000;

    Ok(ActivityStats {
        count: row.try_get("count").unwrap_or(0),
        count_24h: row.try_get("count_24h").unwrap_or(0),
        metal,
        crystal,
        deuterium,
        points,
    })
}

async fn get_recycle_stats(pool: &sqlx::SqlitePool, user_id: i64, last_24h: bool) -> Result<ActivityStats, sqlx::Error> {
    let time_filter = if last_24h {
        "AND created_at > datetime('now', '-24 hours')"
    } else {
        ""
    };

    let query = format!(
        r#"SELECT
            COUNT(*) as count,
            COALESCE(SUM(CASE WHEN created_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END), 0) as count_24h,
            COALESCE(SUM(metal), 0) as metal,
            COALESCE(SUM(crystal), 0) as crystal
           FROM recycle_reports
           WHERE reported_by = ? {}"#,
        time_filter
    );

    let row = sqlx::query(&query)
        .bind(user_id)
        .fetch_one(pool)
        .await?;

    let metal: i64 = row.try_get("metal").unwrap_or(0);
    let crystal: i64 = row.try_get("crystal").unwrap_or(0);
    let points = (metal + crystal) / 1000;

    Ok(ActivityStats {
        count: row.try_get("count").unwrap_or(0),
        count_24h: row.try_get("count_24h").unwrap_or(0),
        metal,
        crystal,
        deuterium: 0,
        points,
    })
}

/// GET /api/hub/overview - Planet overview with player data for filtering
pub async fn get_overview(
    Extension(AuthUser(_user)): Extension<AuthUser>,
) -> Result<Json<HubOverviewResponse>, AppError> {
    let pool = get_pool().await;

    // Query planets with score diffs calculated from player_scores
    let rows = sqlx::query(
        r#"SELECT
            p.id,
            p.planet_id,
            p.coordinates,
            p.galaxy,
            p.system,
            p.planet,
            p.player_id,
            pl.name as player_name,
            pl.alliance_id,
            a.tag as alliance_tag,
            pl.notice,
            pl.score_total,
            pl.score_buildings,
            pl.score_research,
            pl.score_fleet,
            pl.score_defense,
            -- Score 6 hours ago
            (SELECT ps.score_total FROM player_scores ps
             WHERE ps.player_id = pl.id
             AND ps.recorded_at <= datetime('now', '-6 hours')
             ORDER BY ps.recorded_at DESC LIMIT 1) as score_6h,
            -- Score 12 hours ago
            (SELECT ps.score_total FROM player_scores ps
             WHERE ps.player_id = pl.id
             AND ps.recorded_at <= datetime('now', '-12 hours')
             ORDER BY ps.recorded_at DESC LIMIT 1) as score_12h,
            -- Score 18 hours ago
            (SELECT ps.score_total FROM player_scores ps
             WHERE ps.player_id = pl.id
             AND ps.recorded_at <= datetime('now', '-18 hours')
             ORDER BY ps.recorded_at DESC LIMIT 1) as score_18h,
            -- Score 24 hours ago
            (SELECT ps.score_total FROM player_scores ps
             WHERE ps.player_id = pl.id
             AND ps.recorded_at <= datetime('now', '-24 hours')
             ORDER BY ps.recorded_at DESC LIMIT 1) as score_24h,
            pl.inactive_since,
            pl.vacation_since,
            (SELECT MAX(created_at) FROM spy_reports sr
             WHERE sr.galaxy = p.galaxy AND sr.system = p.system AND sr.planet = p.planet
             AND sr.type = 'PLANET') as last_spy_report,
            (SELECT MAX(created_at) FROM battle_reports br
             WHERE br.galaxy = p.galaxy AND br.system = p.system AND br.planet = p.planet) as last_battle_report,
            (SELECT json_extract(resources, '$.901') FROM spy_reports sr
             WHERE sr.galaxy = p.galaxy AND sr.system = p.system AND sr.planet = p.planet
             AND sr.type = 'PLANET' ORDER BY created_at DESC LIMIT 1) as spy_metal,
            (SELECT json_extract(resources, '$.902') FROM spy_reports sr
             WHERE sr.galaxy = p.galaxy AND sr.system = p.system AND sr.planet = p.planet
             AND sr.type = 'PLANET' ORDER BY created_at DESC LIMIT 1) as spy_crystal,
            (SELECT json_extract(resources, '$.903') FROM spy_reports sr
             WHERE sr.galaxy = p.galaxy AND sr.system = p.system AND sr.planet = p.planet
             AND sr.type = 'PLANET' ORDER BY created_at DESC LIMIT 1) as spy_deuterium
        FROM planets p
        JOIN players pl ON p.player_id = pl.id
        LEFT JOIN alliances a ON pl.alliance_id = a.id
        WHERE p.type = 'PLANET'
          AND pl.name != 'System'
          AND pl.id != 0
        ORDER BY p.galaxy, p.system, p.planet"#
    )
    .fetch_all(pool)
    .await?;

    let planets: Vec<HubOverviewPlanet> = rows.into_iter().map(|row| {
        let score_total: Option<i64> = row.get("score_total");
        let score_6h: Option<i64> = row.get("score_6h");
        let score_12h: Option<i64> = row.get("score_12h");
        let score_18h: Option<i64> = row.get("score_18h");
        let score_24h: Option<i64> = row.get("score_24h");

        // Calculate diffs: current - historical score
        let diff06 = match (score_total, score_6h) {
            (Some(curr), Some(old)) => Some(curr - old),
            _ => None,
        };
        let diff12 = match (score_total, score_12h) {
            (Some(curr), Some(old)) => Some(curr - old),
            _ => None,
        };
        let diff18 = match (score_total, score_18h) {
            (Some(curr), Some(old)) => Some(curr - old),
            _ => None,
        };
        let diff24 = match (score_total, score_24h) {
            (Some(curr), Some(old)) => Some(curr - old),
            _ => None,
        };

        HubOverviewPlanet {
            id: row.get("id"),
            planet_id: row.get("planet_id"),
            coordinates: row.get("coordinates"),
            galaxy: row.get("galaxy"),
            system: row.get("system"),
            planet: row.get("planet"),
            player_id: row.get("player_id"),
            player_name: row.get("player_name"),
            alliance_id: row.get("alliance_id"),
            alliance_tag: row.get("alliance_tag"),
            notice: row.get("notice"),
            score_total,
            score_buildings: row.get("score_buildings"),
            score_research: row.get("score_research"),
            score_fleet: row.get("score_fleet"),
            score_defense: row.get("score_defense"),
            diff06,
            diff12,
            diff18,
            diff24,
            inactive_since: row.get("inactive_since"),
            vacation_since: row.get("vacation_since"),
            last_spy_report: row.get("last_spy_report"),
            last_battle_report: row.get("last_battle_report"),
            spy_metal: row.try_get::<Option<i64>, _>("spy_metal").unwrap_or(None),
            spy_crystal: row.try_get::<Option<i64>, _>("spy_crystal").unwrap_or(None),
            spy_deuterium: row.try_get::<Option<i64>, _>("spy_deuterium").unwrap_or(None),
        }
    }).collect();

    Ok(Json(HubOverviewResponse { planets }))
}
