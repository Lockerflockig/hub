use crate::db::models::{PlanetRow, PlayerRow, PlayerScoreRow, PlayerWithAlliance};
use crate::get_pool;
use tracing::debug;

pub async fn  get_by_id(player_id: i64) -> Result<Option<PlayerWithAlliance>, sqlx::Error> {
    debug!(player_id, "DB: get_by_id");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlayerWithAlliance>(
        r#"SELECT
            p.id, p.name, p.alliance_id, p.main_coordinates, p.is_deleted,
            p.inactive_since, p.vacation_since, p.research, p.scores,
            p.combats_total, p.combats_won, p.combats_draw, p.combats_lost,
            p.units_shot, p.units_lost, p.notice, p.status, p.created_at, p.updated_at,
            a.name as alliance_name, a.tag as alliance_tag,
            p.score_buildings, p.score_buildings_rank,
            p.score_research, p.score_research_rank,
            p.score_fleet, p.score_fleet_rank,
            p.score_defense, p.score_defense_rank,
            p.score_total, p.score_total_rank,
            p.honorpoints, p.honorpoints_rank,
            p.fights_honorable, p.fights_dishonorable, p.fights_neutral,
            p.destruction_units_killed, p.destruction_units_lost,
            p.destruction_recycled_metal, p.destruction_recycled_crystal,
            p.real_destruction_units_killed, p.real_destruction_units_lost,
            p.real_destruction_recycled_metal, p.real_destruction_recycled_crystal
        FROM players p
        LEFT JOIN alliances a ON p.alliance_id = a.id
        WHERE p.id = ?"#
    )
        .bind(player_id)
        .fetch_optional(pool)
        .await
}

pub async fn get_by_name(name: &str) -> Result<Option<PlayerWithAlliance>, sqlx::Error> {
    debug!(name, "DB: get_by_name");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlayerWithAlliance>(
        r#"SELECT
            p.id, p.name, p.alliance_id, p.main_coordinates, p.is_deleted,
            p.inactive_since, p.vacation_since, p.research, p.scores,
            p.combats_total, p.combats_won, p.combats_draw, p.combats_lost,
            p.units_shot, p.units_lost, p.notice, p.status, p.created_at, p.updated_at,
            a.name as alliance_name, a.tag as alliance_tag,
            p.score_buildings, p.score_buildings_rank,
            p.score_research, p.score_research_rank,
            p.score_fleet, p.score_fleet_rank,
            p.score_defense, p.score_defense_rank,
            p.score_total, p.score_total_rank,
            p.honorpoints, p.honorpoints_rank,
            p.fights_honorable, p.fights_dishonorable, p.fights_neutral,
            p.destruction_units_killed, p.destruction_units_lost,
            p.destruction_recycled_metal, p.destruction_recycled_crystal,
            p.real_destruction_units_killed, p.real_destruction_units_lost,
            p.real_destruction_recycled_metal, p.real_destruction_recycled_crystal
        FROM players p
        LEFT JOIN alliances a ON p.alliance_id = a.id
        WHERE LOWER(p.name) = LOWER(?)"#
    )
        .bind(name)
        .fetch_optional(pool)
        .await
}

pub async fn get_planets(player_id: i64) -> Result<Vec<PlanetRow>, sqlx::Error> {
    debug!(player_id, "DB: get_planets");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlanetRow>(
        "SELECT id, name, player_id, coordinates, galaxy, system, planet,
                type, buildings, fleet, defense, resources, prod_h,
                status, created_at, updated_at
         FROM planets
         WHERE player_id = ?
         ORDER BY galaxy, system, planet"
    )
        .bind(player_id)
        .fetch_all(pool)
        .await
}

pub async fn get_chart(player_id: i64) -> Result<Vec<PlayerScoreRow>, sqlx::Error> {
    debug!(player_id, "DB: get_chart");
    let pool = get_pool().await;
    sqlx::query_file_as!(PlayerScoreRow, "queries/players/get_chart.sql", player_id)
        .fetch_all(pool)
        .await
}

pub async fn get_chart_7days(player_id: i64) -> Result<Vec<PlayerScoreRow>, sqlx::Error> {
    debug!(player_id, "DB: get_chart_7days");
    let pool = get_pool().await;
    sqlx::query_file_as!(PlayerScoreRow, "queries/players/get_chart_7days.sql", player_id)
        .fetch_all(pool)
        .await
}

pub async fn upsert(
    id: i64,
    name: &str,
    alliance_id: Option<i64>,
    main_coordinates: Option<&str>,
    notice: Option<&str>,
) -> Result<(), sqlx::Error> {
    debug!(id, name, ?alliance_id, "DB: upsert player");
    let pool = get_pool().await;
    sqlx::query_file!(
        "queries/players/upsert.sql",
        id,
        name,
        alliance_id,
        main_coordinates,
        notice
    )
        .execute(pool)
        .await?;
    Ok(())
}

/// Full upsert from PlayerCard with all stats
pub async fn upsert_full(req: &crate::api::handlers::players::UpsertPlayerRequest) -> Result<(), sqlx::Error> {
    debug!(req.id, req.name, "DB: upsert_full player");
    let pool = get_pool().await;
    // Use COALESCE for NOT NULL combat columns to handle null values from frontend
    sqlx::query(
        r#"INSERT INTO players (
            id, name, alliance_id, main_coordinates, notice,
            score_buildings, score_buildings_rank,
            score_research, score_research_rank,
            score_fleet, score_fleet_rank,
            score_defense, score_defense_rank,
            score_total, score_total_rank,
            combats_won, combats_draw, combats_lost, combats_total,
            honorpoints, honorpoints_rank,
            fights_honorable, fights_dishonorable, fights_neutral,
            destruction_units_killed, destruction_units_lost,
            destruction_recycled_metal, destruction_recycled_crystal,
            real_destruction_units_killed, real_destruction_units_lost,
            real_destruction_recycled_metal, real_destruction_recycled_crystal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 0), COALESCE(?, 0), COALESCE(?, 0), COALESCE(?, 0), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            alliance_id = excluded.alliance_id,
            main_coordinates = excluded.main_coordinates,
            notice = excluded.notice,
            score_buildings = excluded.score_buildings,
            score_buildings_rank = excluded.score_buildings_rank,
            score_research = excluded.score_research,
            score_research_rank = excluded.score_research_rank,
            score_fleet = excluded.score_fleet,
            score_fleet_rank = excluded.score_fleet_rank,
            score_defense = excluded.score_defense,
            score_defense_rank = excluded.score_defense_rank,
            score_total = excluded.score_total,
            score_total_rank = excluded.score_total_rank,
            combats_won = excluded.combats_won,
            combats_draw = excluded.combats_draw,
            combats_lost = excluded.combats_lost,
            combats_total = excluded.combats_total,
            honorpoints = excluded.honorpoints,
            honorpoints_rank = excluded.honorpoints_rank,
            fights_honorable = excluded.fights_honorable,
            fights_dishonorable = excluded.fights_dishonorable,
            fights_neutral = excluded.fights_neutral,
            destruction_units_killed = excluded.destruction_units_killed,
            destruction_units_lost = excluded.destruction_units_lost,
            destruction_recycled_metal = excluded.destruction_recycled_metal,
            destruction_recycled_crystal = excluded.destruction_recycled_crystal,
            real_destruction_units_killed = excluded.real_destruction_units_killed,
            real_destruction_units_lost = excluded.real_destruction_units_lost,
            real_destruction_recycled_metal = excluded.real_destruction_recycled_metal,
            real_destruction_recycled_crystal = excluded.real_destruction_recycled_crystal,
            updated_at = CURRENT_TIMESTAMP"#
    )
        .bind(req.id)
        .bind(&req.name)
        .bind(req.alliance_id)
        .bind(&req.main_coordinates)
        .bind(&req.notice)
        .bind(req.score_buildings)
        .bind(req.score_buildings_rank)
        .bind(req.score_research)
        .bind(req.score_research_rank)
        .bind(req.score_fleet)
        .bind(req.score_fleet_rank)
        .bind(req.score_defense)
        .bind(req.score_defense_rank)
        .bind(req.score_total)
        .bind(req.score_total_rank)
        .bind(req.combats_won)
        .bind(req.combats_draw)
        .bind(req.combats_lost)
        .bind(req.combats_total)
        .bind(req.honorpoints)
        .bind(req.honorpoints_rank)
        .bind(req.fights_honorable)
        .bind(req.fights_dishonorable)
        .bind(req.fights_neutral)
        .bind(req.destruction_units_killed)
        .bind(req.destruction_units_lost)
        .bind(req.destruction_recycled_metal)
        .bind(req.destruction_recycled_crystal)
        .bind(req.real_destruction_units_killed)
        .bind(req.real_destruction_units_lost)
        .bind(req.real_destruction_recycled_metal)
        .bind(req.real_destruction_recycled_crystal)
        .execute(pool)
        .await?;
    Ok(())
}

/// Ensure player exists (minimal insert from galaxy scan, does nothing if player exists)
pub async fn ensure_exists(id: i64, name: &str) -> Result<(), sqlx::Error> {
    debug!(id, name, "DB: ensure_exists player");
    let pool = get_pool().await;
    sqlx::query(
        "INSERT INTO players (id, name) VALUES (?, ?) ON CONFLICT(id) DO NOTHING"
    )
        .bind(id)
        .bind(name)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_research(player_id: i64, research_json: &str) -> Result<(), sqlx::Error> {
    debug!(player_id, "DB: update_research");
    let pool = get_pool().await;
    sqlx::query_file!(
        "queries/players/update_research.sql",
        research_json,
        player_id
    )
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_alliance(player_id: i64, alliance_id: i64) -> Result<(), sqlx::Error> {
    debug!(player_id, alliance_id, "DB: update_alliance");
    let pool = get_pool().await;
    // Only update if alliance exists (foreign key constraint)
    sqlx::query(
        "UPDATE players SET alliance_id = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND EXISTS (SELECT 1 FROM alliances WHERE id = ?)"
    )
        .bind(alliance_id)
        .bind(player_id)
        .bind(alliance_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn mark_deleted(player_id: i64) -> Result<(), sqlx::Error> {
    debug!(player_id, "DB: mark_deleted");
    let pool = get_pool().await;
    sqlx::query_file!("queries/players/mark_deleted.sql", player_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_by_ids(ids: &[i64]) -> Result<Vec<PlayerRow>, sqlx::Error> {
    debug!(count = ids.len(), "DB: get_by_ids");
    if ids.is_empty() {
        return Ok(vec![]);
    }

    let pool = get_pool().await;

    // Placeholders: ?, ?, ?
    let placeholders: String = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let query = format!("SELECT * FROM players WHERE id IN ({})", placeholders);

    let mut q = sqlx::query_as::<_, PlayerRow>(&query);
    for id in ids {
        q = q.bind(id);
    }

    q.fetch_all(pool).await
}

pub struct PlayerStats {
    pub id: i64,
    pub name: String,
    pub alliance_id: Option<i64>,
    pub score_total: i64,
    pub score_economy: i64,
    pub score_research: i64,
    pub score_military: i64,
    pub score_defense: i64,
    pub rank: Option<i64>,
}

pub async fn upsert_stats(stats: &[PlayerStats]) -> Result<u64, sqlx::Error> {
    debug!(count = stats.len(), "DB: upsert_stats");
    let pool = get_pool().await;
    let mut count = 0u64;

    for s in stats {
        let scores_json = format!(
            r#"{{"total":{},"economy":{},"research":{},"military":{},"defense":{}}}"#,
            s.score_total, s.score_economy, s.score_research, s.score_military, s.score_defense
        );

        // Update player
        sqlx::query_file!("queries/players/upsert_stats.sql", s.id, s.name, s.alliance_id, scores_json)
            .execute(pool)
            .await?;

        // Insert score history
        sqlx::query_file!(
            "queries/players/insert_score.sql",
            s.id, s.score_total, s.score_economy, s.score_research, s.score_military, s.score_defense, s.rank
        )
            .execute(pool)
            .await?;

        count += 1;
    }

    Ok(count)
}
