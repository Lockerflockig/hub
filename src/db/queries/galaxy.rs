use crate::db::models::PlanetRow;
use crate::get_pool;
use tracing::debug;
use super::sql;

pub async fn get_system(galaxy: i64, system: i64) -> Result<Vec<PlanetRow>, sqlx::Error> {
    debug!(galaxy, system, "DB: get_system");
    let pool = get_pool().await;
    sqlx::query_as::<_, PlanetRow>(sql!(galaxy, get_system))
        .bind(galaxy)
        .bind(system)
        .fetch_all(pool)
        .await
}
