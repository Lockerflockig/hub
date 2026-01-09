use crate::db::models::{PlanetRow, PlayerRow, PlayerScoreRow, PlayerWithAlliance};
use crate::get_pool;
use super::sql;
use tracing::debug;

pub async fn get_by_id(player_id: i64) -> Result<Option<PlayerWithAlliance>, sqlx::Error> {
    debug!(player_id, "DB: get_by_id");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlayerWithAlliance>(sql!(players, get_by_id))
        .bind(player_id)
        .fetch_optional(pool)
        .await
}

pub async fn get_by_name(name: &str) -> Result<Option<PlayerWithAlliance>, sqlx::Error> {
    debug!(name, "DB: get_by_name");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlayerWithAlliance>(sql!(players, get_by_name))
        .bind(name)
        .fetch_optional(pool)
        .await
}

pub async fn get_planets(player_id: i64) -> Result<Vec<PlanetRow>, sqlx::Error> {
    debug!(player_id, "DB: get_planets");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlanetRow>(sql!(players, get_player_planets))
        .bind(player_id)
        .fetch_all(pool)
        .await
}

pub async fn get_chart(player_id: i64) -> Result<Vec<PlayerScoreRow>, sqlx::Error> {
    debug!(player_id, "DB: get_chart");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlayerScoreRow>(sql!(players, get_chart))
        .bind(player_id)
        .fetch_all(pool)
        .await
}

pub async fn get_chart_7days(player_id: i64) -> Result<Vec<PlayerScoreRow>, sqlx::Error> {
    debug!(player_id, "DB: get_chart_7days");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlayerScoreRow>(sql!(players, get_chart_7days))
        .bind(player_id)
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
    sqlx::query(sql!(players, upsert))
        .bind(id)
        .bind(name)
        .bind(alliance_id)
        .bind(main_coordinates)
        .bind(notice)
        .execute(pool)
        .await?;
    Ok(())
}

/// Full upsert from PlayerCard with all stats
pub async fn upsert_full(req: &crate::api::handlers::players::UpsertPlayerRequest) -> Result<(), sqlx::Error> {
    debug!(req.id, req.name, "DB: upsert_full player");
    let pool = get_pool().await;
    sqlx::query(sql!(players, upsert_full))
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
    sqlx::query(sql!(players, ensure_exists))
        .bind(id)
        .bind(name)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_research(player_id: i64, research_json: &str) -> Result<(), sqlx::Error> {
    debug!(player_id, "DB: update_research");
    let pool = get_pool().await;
    sqlx::query(sql!(players, update_research))
        .bind(research_json)
        .bind(player_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_alliance(player_id: i64, alliance_id: i64) -> Result<(), sqlx::Error> {
    debug!(player_id, alliance_id, "DB: update_alliance");
    let pool = get_pool().await;
    sqlx::query(sql!(players, update_alliance))
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
    sqlx::query(sql!(players, mark_deleted))
        .bind(player_id)
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
        sqlx::query(sql!(players, upsert_stats))
            .bind(s.id)
            .bind(&s.name)
            .bind(s.alliance_id)
            .bind(&scores_json)
            .execute(pool)
            .await?;

        // Insert score history
        sqlx::query(sql!(players, insert_score))
            .bind(s.id)
            .bind(s.score_total)
            .bind(s.score_economy)
            .bind(s.score_research)
            .bind(s.score_military)
            .bind(s.score_defense)
            .bind(s.rank)
            .execute(pool)
            .await?;

        count += 1;
    }

    Ok(count)
}
