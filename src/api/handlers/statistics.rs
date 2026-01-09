use axum::{Extension, Json};
use serde::Deserialize;
use crate::api::auth::AuthUser;
use crate::api::error::AppError;
use crate::api::response::SuccessResponse;
use crate::get_pool;
use tracing::debug;

#[derive(Debug, Deserialize)]
pub struct PlayerStatRow {
    pub player_id: i64,
    pub player_name: String,
    pub alliance_tag: Option<String>,
    pub rank: i64,
    pub score: i64,
    // Optional - not sent anymore (forbidden by pr0game rules)
    #[serde(default)]
    pub is_inactive: bool,
    #[serde(default)]
    pub is_long_inactive: bool,
}

#[derive(Debug, Deserialize)]
pub struct StatsSyncRequest {
    pub stat_type: String, // total, fleet, research, buildings, defense, honor
    pub players: Vec<PlayerStatRow>,
}

/// POST /api/statistics/sync
pub async fn sync_statistics(
    Extension(AuthUser(_user)): Extension<AuthUser>,
    Json(req): Json<StatsSyncRequest>,
) -> Result<Json<SuccessResponse>, AppError> {
    debug!(stat_type = %req.stat_type, count = req.players.len(), "Syncing statistics");

    let pool = get_pool().await;

    for player in &req.players {
        // First ensure player exists
        sqlx::query(
            "INSERT INTO players (id, name) VALUES (?, ?)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = CURRENT_TIMESTAMP"
        )
            .bind(player.player_id)
            .bind(&player.player_name)
            .execute(pool)
            .await?;

        // Update inactive status
        if player.is_long_inactive {
            sqlx::query(
                "UPDATE players SET inactive_since = COALESCE(inactive_since, CURRENT_TIMESTAMP)
                 WHERE id = ? AND inactive_since IS NULL"
            )
                .bind(player.player_id)
                .execute(pool)
                .await?;
        } else if !player.is_inactive {
            // Clear inactive if player is no longer inactive
            sqlx::query(
                "UPDATE players SET inactive_since = NULL WHERE id = ?"
            )
                .bind(player.player_id)
                .execute(pool)
                .await?;
        }

        // Update score based on stat_type
        let query = match req.stat_type.as_str() {
            "total" => {
                "UPDATE players SET score_total = ?, score_total_rank = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            }
            "fleet" => {
                "UPDATE players SET score_fleet = ?, score_fleet_rank = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            }
            "research" => {
                "UPDATE players SET score_research = ?, score_research_rank = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            }
            "buildings" => {
                "UPDATE players SET score_buildings = ?, score_buildings_rank = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            }
            "defense" => {
                "UPDATE players SET score_defense = ?, score_defense_rank = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            }
            "honor" => {
                "UPDATE players SET honorpoints = ?, honorpoints_rank = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            }
            _ => continue,
        };

        sqlx::query(query)
            .bind(player.score)
            .bind(player.rank)
            .bind(player.player_id)
            .execute(pool)
            .await?;

        // Insert into player_scores history (only for total score to avoid too many entries)
        if req.stat_type == "total" {
            sqlx::query(
                "INSERT INTO player_scores (player_id, score_total, rank_total, recorded_at)
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
            )
                .bind(player.player_id)
                .bind(player.score)
                .bind(player.rank)
                .execute(pool)
                .await?;
        }
    }

    debug!("Statistics sync complete");
    Ok(Json(SuccessResponse { success: true }))
}
