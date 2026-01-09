use crate::get_pool;
use tracing::debug;

/// Returns which of the given IDs already exist in the database
pub async fn get_existing_ids(ids: &[i64]) -> Result<Vec<i64>, sqlx::Error> {
    debug!(count = ids.len(), "DB: messages::get_existing_ids");
    if ids.is_empty() {
        return Ok(vec![]);
    }

    let pool = get_pool().await;
    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let query = format!(
        "SELECT external_id FROM messages WHERE external_id IN ({})",
        placeholders
    );

    let mut q = sqlx::query_scalar::<_, i64>(&query);
    for id in ids {
        q = q.bind(id);
    }

    q.fetch_all(pool).await
}

/// Inserts new message IDs
pub async fn insert_batch(ids: &[i64]) -> Result<u64, sqlx::Error> {
    debug!(count = ids.len(), "DB: messages::insert_batch");
    if ids.is_empty() {
        return Ok(0);
    }

    let pool = get_pool().await;
    let values = ids.iter().map(|_| "(?)").collect::<Vec<_>>().join(",");
    let query = format!(
        "INSERT OR IGNORE INTO messages (external_id) VALUES {}",
        values
    );

    let mut q = sqlx::query(&query);
    for id in ids {
        q = q.bind(id);
    }

    let result = q.execute(pool).await?;
    Ok(result.rows_affected())
}
