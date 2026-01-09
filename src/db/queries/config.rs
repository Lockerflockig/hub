use crate::get_pool;
use super::sql;
use tracing::debug;

#[derive(sqlx::FromRow)]
pub struct ConfigRow {
    pub key: String,
    pub value: String,
}

pub async fn get_universe_config() -> Result<Vec<ConfigRow>, sqlx::Error> {
    debug!("DB: config::get_universe_config");
    let pool = get_pool().await;
    sqlx::query_as::<_, ConfigRow>(sql!(config, get_universe_config))
        .fetch_all(pool)
        .await
}

pub async fn set_config(key: &str, value: &str) -> Result<(), sqlx::Error> {
    debug!(key, value, "DB: config::set_config");
    let pool = get_pool().await;
    sqlx::query(sql!(config, set_config))
        .bind(key)
        .bind(value)
        .execute(pool)
        .await?;
    Ok(())
}
