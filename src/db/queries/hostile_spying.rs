use crate::db::models::{HostileSpyingRow, HostileSpyingOverviewRow};
use crate::get_pool;
use super::sql;
use tracing::debug;

pub async fn upsert(
    external_id: i64,
    attacker_coordinates: Option<&str>,
    target_coordinates: Option<&str>,
    report_time: Option<&str>,
) -> Result<(), sqlx::Error> {
    debug!(external_id, ?attacker_coordinates, ?target_coordinates, "DB: hostile_spying::upsert");
    let pool = get_pool().await;
    sqlx::query(sql!(hostile_spying, upsert))
        .bind(external_id)
        .bind(attacker_coordinates)
        .bind(target_coordinates)
        .bind(report_time)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get(
    search: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<Vec<HostileSpyingRow>, sqlx::Error> {
    debug!(?search, limit, offset, "DB: hostile_spying::get");
    let pool = get_pool().await;
    sqlx::query_as::<_, HostileSpyingRow>(sql!(hostile_spying, get))
        .bind(search)
        .bind(search)
        .bind(search)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
}

pub async fn count(search: Option<&str>) -> Result<i64, sqlx::Error> {
    debug!(?search, "DB: hostile_spying::count");
    let pool = get_pool().await;

    #[derive(sqlx::FromRow)]
    struct CountResult {
        total: i64,
    }

    let result = sqlx::query_as::<_, CountResult>(sql!(hostile_spying, count))
        .bind(search)
        .bind(search)
        .bind(search)
        .fetch_one(pool)
        .await?;

    Ok(result.total)
}

/// Get aggregated hostile spying overview with filters
pub async fn get_overview(
    attacker_filter: Option<&str>,
    target_filter: Option<&str>,
    time_from: Option<&str>,
    time_to: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<Vec<HostileSpyingOverviewRow>, sqlx::Error> {
    debug!(
        ?attacker_filter, ?target_filter, ?time_from, ?time_to,
        limit, offset, "DB: hostile_spying::get_overview"
    );
    let pool = get_pool().await;
    sqlx::query_as::<_, HostileSpyingOverviewRow>(sql!(hostile_spying, get_overview))
        .bind(attacker_filter)
        .bind(attacker_filter)
        .bind(attacker_filter)
        .bind(target_filter)
        .bind(target_filter)
        .bind(time_from)
        .bind(time_from)
        .bind(time_to)
        .bind(time_to)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
}

/// Count unique attackers for pagination (with filters)
pub async fn count_overview(
    attacker_filter: Option<&str>,
    target_filter: Option<&str>,
    time_from: Option<&str>,
    time_to: Option<&str>,
) -> Result<i64, sqlx::Error> {
    debug!(
        ?attacker_filter, ?target_filter, ?time_from, ?time_to,
        "DB: hostile_spying::count_overview"
    );
    let pool = get_pool().await;

    #[derive(sqlx::FromRow)]
    struct CountResult {
        total: i64,
    }

    let result = sqlx::query_as::<_, CountResult>(sql!(hostile_spying, count_overview))
        .bind(attacker_filter)
        .bind(attacker_filter)
        .bind(attacker_filter)
        .bind(target_filter)
        .bind(target_filter)
        .bind(time_from)
        .bind(time_from)
        .bind(time_to)
        .bind(time_to)
        .fetch_one(pool)
        .await?;

    Ok(result.total)
}
