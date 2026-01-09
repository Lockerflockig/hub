use crate::get_pool;
use tracing::debug;

#[derive(sqlx::FromRow)]
pub struct ConfigRow {
    pub key: String,
    pub value: String,
}

pub async fn get_universe_config() -> Result<Vec<ConfigRow>, sqlx::Error> {
    debug!("DB: config::get_universe_config");
    let pool = get_pool().await;
    sqlx::query_as::<_, ConfigRow>(
        "SELECT key, value FROM config WHERE key IN ('galaxies', 'systems', 'galaxy_wrapped')"
    )
    .fetch_all(pool)
    .await
}

pub async fn set_config(key: &str, value: &str) -> Result<(), sqlx::Error> {
    debug!(key, value, "DB: config::set_config");
    let pool = get_pool().await;
    sqlx::query(
        "INSERT INTO config (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}
